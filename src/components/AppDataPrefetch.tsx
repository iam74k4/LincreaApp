// 近道のための下準備: 見えないところでアプリのメニューの画面を読み込み、App.data（ログインした人など）を控えておく。
// 控えがあれば、近道はメニューを開かずに行き先の画面を直接開ける（src/shortcuts.ts・src/webview/appDataCache.ts）。
//
// マイアプリを見ているあいだに裏で読むので、近道を押したときには、たいてい準備ができている。
// メニューの画面は、読み込むときにデータを読むだけ（書き込まない）。
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { pathOf } from '../api/http';
import { SERVER_URL } from '../config';
import { appDataKey, rememberAppData } from '../webview/appDataCache';

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

  return (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView
        source={{ uri: `${SERVER_URL}/runapp/${encodeURIComponent(app)}/${encodeURIComponent(form)}/` }}
        sharedCookiesEnabled
        injectedJavaScript={prefetchJs(ready)}
        onMessage={(e) => {
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
