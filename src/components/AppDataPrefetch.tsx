// 近道のための下準備: 見えないところでアプリのメニューの画面を読み込み、App.data（ログインした人など）を控えておく。
// 控えがあれば、近道はメニューを開かずに行き先の画面を直接開ける（src/shortcuts.ts・src/webview/appDataCache.ts）。
//
// マイアプリを見ているあいだに裏で読むので、近道を押したときには、たいてい準備ができている。
// メニューの画面は、読み込むときにデータを読むだけ（書き込まない）。
//
// 画面の定義（initApp。1MB ほど）と参照モードの返事は、見える画面と同じ控えを使い、なければ読んで控えに入れる
// （src/webview/initAppCache.ts・src/webview/refModeCache.ts）。マイアプリが裏で読む画面の定義（prefetchInitApps）は、
// この下準備が終わってから始めるので、同じメニューの定義を2回読まない（src/app/(app)/index.tsx）。
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { pathOf } from '../api/http';
import { SERVER_URL } from '../config';
import { isServerUrl, mayNavigate } from '../webview/origin';
import { appDataKey, rememberAppData } from '../webview/appDataCache';
import { joinScripts, parseBridgeMessage } from '../webview/bridge';
import { initAppJs, refModeJs } from '../webview/initApp';
import { recallInitApp, rememberInitApp } from '../webview/initAppCache';
import { recallRefModes, rememberRefMode } from '../webview/refModeCache';

type Props = {
  app: string;
  form: string;
  /** 準備ができたしるし（App.data にこのデータが入ったら控える） */
  ready: string;
  /** 終わったら（控えができた: true / できなかった: false） */
  onDone: (ok: boolean) => void;
};

const GIVE_UP_MS = 30000;

export function AppDataPrefetch({ app, form, ready, onDone }: Props) {
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const finish = (ok: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onDoneRef.current(ok);
  };

  useEffect(() => {
    const timer = setTimeout(() => finish(false), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, []);
  // ページが動き出す前に入れるもの。開いたときに決めて、そのあいだは変えない（変えると、入れ直しになる）
  const [beforeLoadJs] = useState(() => {
    const cached = recallInitApp({ app, form });
    return joinScripts([initAppJs(cached ? { app, form, ...cached } : null), refModeJs(recallRefModes())]);
  });

  return (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView
        source={{ uri: `${SERVER_URL}/runapp/${encodeURIComponent(app)}/${encodeURIComponent(form)}/` }}
        sharedCookiesEnabled
        injectedJavaScriptBeforeContentLoaded={beforeLoadJs}
        injectedJavaScript={prefetchJs(ready)}
        // 会社のサイトのページだけを開き、そこからの知らせだけを受け付ける（src/webview/origin.ts）
        onShouldStartLoadWithRequest={(req) => mayNavigate(req.url, req.isTopFrame)}
        onMessage={(e) => {
          if (!isServerUrl(e.nativeEvent.url)) return;
          // 読んだ画面の定義と参照モードの返事は、控えに入れる（見える画面と同じ。次に開くときに速い）
          const parsed = parseBridgeMessage(e.nativeEvent.data);
          if (parsed?.type === 'initApp') {
            rememberInitApp({ app: parsed.app, form: parsed.form }, parsed.id, parsed.text);
            return;
          }
          if (parsed?.type === 'refMode') {
            rememberRefMode(parsed.key, { text: parsed.text, type: parsed.contentType });
            return;
          }
          try {
            const message = JSON.parse(e.nativeEvent.data) as { type?: string; data?: unknown };
            if (message.type !== 'appData') return;
            if (typeof message.data === 'string' && message.data.length > 2) {
              rememberAppData(appDataKey(app, form), message.data);
              finish(true);
            } else {
              finish(false);
            }
          } catch {
            finish(false);
          }
        }}
        onError={(e) => {
          e.preventDefault(); // 見えない WebView なので、WebView の失敗の表示は要らない
          finish(false);
        }}
        onHttpError={() => finish(false)}
        onContentProcessDidTerminate={() => finish(false)} // iOS がページの中身を捨てた
        onNavigationStateChange={(nav) => {
          // ログインが切れていた（ログイン画面に飛ばされた）。見える画面のほうで気づいて知らせるので、ここではやめるだけ
          if (pathOf(nav.url).startsWith('/login')) finish(false);
        }}
      />
    </View>
  );
}

/** App.data に ready のデータが入り、EZCraft の読み込み中の表示が消えて落ち着いたら、App.data を知らせる */
function prefetchJs(readyKey: string): string {
  return `
(function () {
  var tries = 0;
  var stable = 0;
  var post = function (message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); };
  var timer = setInterval(function () {
    tries++;
    if (tries > 160) { clearInterval(timer); post({ type: 'appData', data: null }); return; }
    var P = window.FALCON && FALCON.apps && FALCON.apps.procedure;
    var data = P && P.App && P.App.data;
    if (!(data && data[${JSON.stringify(readyKey)}])) { stable = 0; return; }
    var loading = document.getElementById('loadingIcon');
    if (loading && loading.offsetParent !== null) { stable = 0; return; }
    if (++stable < 3) return;
    clearInterval(timer);
    var text = null;
    try { text = JSON.stringify(data); } catch (e) {}
    post({ type: 'appData', data: text });
  }, 150);
})();
true;
`;
}

const styles = StyleSheet.create({
  // 画面の外に置いて見えなくする（大きさは普通にしておく。0 にすると EZCraft の描き方が変わることがある）
  hidden: {
    position: 'absolute',
    left: -2000,
    top: 0,
    width: 400,
    height: 800,
    opacity: 0,
  },
});
