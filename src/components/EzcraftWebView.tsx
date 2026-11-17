// EZCraft の画面を1つ表示する WebView。アプリの起動画面と、そこから開いた画面の両方で使う。
//
// 中身は EZCraft で作られた Web のアプリなので、ネイティブで作り直さず、そのまま見せる。
//   - ログイン: アプリの通信がもらった Cookie を WebView にも使わせて引き継ぐ（sharedCookiesEnabled）
//   - 見た目:   このアプリに合わせたスタイルをかぶせる（src/webview/ezcraftSkin.ts）
//   - 操作:     1回のタップで押せる・「閉じる」で戻れるようにする（src/webview/bridge.ts）
//   - 画面の移り: 新しいウインドウで開く画面は、アプリの画面として上に重ねる（戻るボタンで戻れる）。
//                開いた元の App.data と、画面に渡す引数も渡す（src/webview/bridge.ts の 2）
//   - その場で申請: ページが知らせた申請の画面を、シートで重ねる（src/webview/bridge.ts の 7・src/openShortcut.ts）
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, usePreventRemove } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { pathOf } from '../api/http';
import { SERVER_URL } from '../config';
import { fileName, openFile, saveIncoming } from '../files';
import { advanceApplyQueue, applyQueueActive, openApplication, startApplyQueue } from '../openShortcut';
import { useSession } from '../session/SessionContext';
import { useColors } from '../theme';
import { autoClickJs, BRIDGE_JS, childClosedJs, openerStubJs, parseBridgeMessage, restoreScrollJs } from '../webview/bridge';
import { bootJs, buildSkinScript, SHOW_PAGE_JS } from '../webview/ezcraftSkin';
import { appDataKeyOfUrl, rememberAppData } from '../webview/appDataCache';
import { depositHandoff, type Handoff } from '../webview/handoff';
import { initAppJs } from '../webview/initApp';
import { initAppFormOfUrl, recallInitApp, rememberInitApp } from '../webview/initAppCache';
import { noteClosedByPage, noteWrite, takeChildResult, writeCount } from '../webview/writes';

type Props = {
  /** 開く URL（このサーバーの中のもの） */
  uri: string;
  /** アプリケーション ID。アプリごとの見た目の調整に使う（分からなければ空） */
  appId: string;
  /** 上のヘッダーに出す名前。なければページの名前を使う */
  title?: string;
  /** 開いた元の画面から受け取ったもの（App.data・ウインドウの名前・引数）。あれば「元のウインドウの代わり」に持たせる */
  handoff?: Handoff | null;
  /**
   * 近道: ページの準備ができたら、steps の最初のボタンを押して次の画面へ進む（メニューを飛ばす）。
   * 進んだ先の画面は、この画面と入れ替えて出し、残りの steps はその画面で押す（戻るとマイアプリに戻る）。
   * ready は、最初の画面で App.data に入るのを待つデータの名前。待つあいだはページを隠し、label を出しておく。
   */
  autoClick?: { steps: string[]; ready: string; label: string } | null;
  /** 入力欄に入れておく値（ページの側で window.__myappPrefill として受け取る。src/openShortcut.ts） */
  prefill?: Record<string, string> | null;
  /** シートで重ねて開いた画面か（近道で進んだ先の画面も、シートのまま入れ替える） */
  sheet?: boolean;
};

/** 登録のあとに自動で開く申請の画面を、少し待ってから開く（待つあいだにページが閉じたら、閉じてから開く） */
const APPLY_DELAY_MS = 700;
// 戻ってきた画面に、データだけの読み直しを頼んでから、返事を待つ長さ（来なければ、丸ごと読み直す）
const REFRESH_REPLY_MS = 1500;

/** ダイアログの後ろの暗さ（ページの .tcc-modal-back などと同じ。src/webview/ezcraftSkin.ts） */
const DIM = 0.28;
/** #RRGGBB の色に、黒を DIM だけ重ねた色 */
function dimmed(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(v * (1 - DIM));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

export function EzcraftWebView({ uri, appId, title, handoff = null, autoClick = null, prefill = null, sheet = false }: Props) {
  const { signOut } = useSession();
  const c = useColors();
  const insets = useSafeAreaInsets(); // 画面の下の、ホームに戻るバーの高さ。ページの下に固定するものを、その上に置く
  const expiredShown = useRef(false);
  const openedChild = useRef(false);
  // 書き込みの回数（この画面のぶんを除く）。重ねて開いた画面から戻ったとき、増えていたら読み直す
  const ownWrites = useRef(0);
  const othersWritesAtOpen = useRef(0);
  const [pageTitle, setPageTitle] = useState('');
  const [reloadKey, setReloadKey] = useState(0); // 変えると WebView を作り直す（= 読み直す）
  // ページの中でダイアログが開いているか（bridge の 8）。開いているあいだは、‹ やスワイプで戻らず、まずダイアログを閉じる
  const [modalOpen, setModalOpen] = useState(false);
  usePreventRemove(modalOpen, () => {
    webRef.current?.injectJavaScript('window.__myappCloseModal && window.__myappCloseModal(); true;');
  });
  // この画面の定義（initApp）の控え。あれば、ページは読まずにこれを使う（src/webview/initAppCache.ts）。
  // 開いたとき（と読み直すとき）に決めて、そのあいだは変えない（変えると、ページに入れるスクリプトが入れ替わる）
  const [initApp, setInitApp] = useState(() => cachedInitApp(uri));
  // ページが整ったか。整うまでは中身を隠し（bootJs）、読み込み中の印を出しておく（整える前の見た目が一瞬見えないように）
  const [shown, setShown] = useState(false);
  const webRef = useRef<ComponentRef<typeof WebView>>(null);
  const scroll = useRef({ y: 0, target: '' }); // いまのスクロール位置（ページが知らせてくる。target は動いた箱）
  const [restoreTo, setRestoreTo] = useState({ y: 0, target: '' }); // 読み直したあとに戻すスクロール位置
  const [launching, setLaunching] = useState(autoClick !== null); // 近道で、ボタンを押して次へ進むのを待っている
  const launchingRef = useRef(launching);
  // 登録のあとに自動で開く申請（ページが閉じるかもしれないので、少し待ってから開く）
  const pendingApply = useRef<{ form: string; prefill: Record<string, string>; timer: ReturnType<typeof setTimeout> } | null>(null);

  const apply = (form: string, values: Record<string, string>, auto: boolean) => {
    if (!auto) {
      openApplication(form, values);
      return;
    }
    if (pendingApply.current) clearTimeout(pendingApply.current.timer);
    const timer = setTimeout(() => {
      pendingApply.current = null;
      openApplication(form, values);
    }, APPLY_DELAY_MS);
    pendingApply.current = { form, prefill: values, timer };
  };
  // ページが閉じた（登録のあと EZCraft が画面を閉じた）。待っている申請があれば、戻ってから開く。
  // まとめて申請の途中で、このシートで申請して閉じたのなら、次の1件を開く（src/openShortcut.ts）
  const close = () => {
    const waiting = pendingApply.current;
    if (waiting) {
      clearTimeout(waiting.timer);
      pendingApply.current = null;
    }
    const nextInQueue = !waiting && sheet && ownWrites.current > 0 && applyQueueActive();
    noteClosedByPage(); // 元の画面は、これを見て、丸ごと読み直さずにデータだけ読み直す
    // ページが自分で閉じるときは、ダイアログが開いていても止めない（止める設定を外してから戻る）
    setModalOpen(false);
    setTimeout(() => {
      if (router.canGoBack()) router.back();
    }, 0);
    if (waiting) setTimeout(() => openApplication(waiting.form, waiting.prefill), 450);
    else if (nextInQueue) setTimeout(() => advanceApplyQueue(), 450);
  };

  // 近道がうまく進まなかったら（ボタンが見つからないなど）、隠していたページをそのまま見せる
  useEffect(() => {
    if (!launching) return;
    const timer = setTimeout(() => {
      launchingRef.current = false;
      setLaunching(false);
    }, 15000);
    return () => clearTimeout(timer);
  }, [launching]);

  // 整った合図（ready）が来なくても、8 秒たったら見せる（ページの側で何かがうまく動かなかったときのため）
  useEffect(() => {
    if (shown) return;
    const timer = setTimeout(() => {
      webRef.current?.injectJavaScript(SHOW_PAGE_JS);
      setShown(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [shown, reloadKey]);

  // ページを丸ごと読み直す（白い画面と読み込み中の印が、数秒出る）
  const reloadPage = useCallback(() => {
    setRestoreTo(scroll.current); // 読み直しても、見ていた位置に戻す
    setShown(false);
    setInitApp(cachedInitApp(uri));
    setReloadKey((k) => k + 1);
  }, [uri]);
  // データだけの読み直しを頼んで、返事を待っているあいだのタイマー（返事がなければ、丸ごと読み直す）
  const refreshWait = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (refreshWait.current) clearTimeout(refreshWait.current);
  }, []);

  // 重ねて開いた画面から戻ってきたら、その画面（とその先）でデータを書き込んだときだけ、この画面を新しくする
  // （何も変えずに戻ったときは、そのまま見せる）。
  // その画面が「登録」などを終えて自分で閉じたときは、Web 版と同じく、閉じたあとの処理（データだけ読み直す）を
  // ページで走らせる。一覧はそのまま見えていて、変わった行だけが少しあとで新しくなる（丸ごと読み直すより待たない）。
  // できない画面（処理を用意していない・ページが消えていた）や、閉じ方が違うときは、今までどおり丸ごと読み直す
  useFocusEffect(
    useCallback(() => {
      if (openedChild.current) {
        const wrote = writeCount() - ownWrites.current !== othersWritesAtOpen.current;
        const child = takeChildResult();
        // まとめて申請の途中なら、次の1件から戻ってきたときも見る（src/openShortcut.ts）
        openedChild.current = applyQueueActive();
        othersWritesAtOpen.current = writeCount() - ownWrites.current;
        // 重ねて開いた画面（とその先）で書き込みがなければ、そのまま見せる（読み直すと数秒かかる）
        if (!wrote) return;
        if (!child.closedByPage || !child.label || !webRef.current) {
          reloadPage();
          return;
        }
        if (refreshWait.current) clearTimeout(refreshWait.current);
        refreshWait.current = setTimeout(() => {
          refreshWait.current = null;
          reloadPage();
        }, REFRESH_REPLY_MS);
        webRef.current.injectJavaScript(childClosedJs(child.label));
      }
    }, [reloadPage]),
  );

  // ページが作った PDF・CSV・Excel を受け取り、一時的な場所に置いて見せる。PDF はアプリの画面、ほかは iPhone の標準のプレビュー
  // （どちらも共有のボタンから「ファイル」に保存・プリントなどができる。src/files.ts）
  const receiveFile = async (base64: string, name: string, mime: string) => {
    const screenName = title || pageTitle || 'ファイル';
    const d = new Date();
    const two = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}_${two(d.getHours())}${two(d.getMinutes())}`; // 20261116_1240
    const saved = fileName(name, mime, `${screenName}_${stamp}`);
    try {
      const file = await saveIncoming(base64, saved);
      // PDF は、アプリの画面で見せる（左上で戻れる。src/app/(app)/file.tsx）。ほかは iPhone の標準のプレビューで
      if (mime === 'application/pdf' || /\.pdf$/i.test(saved)) {
        router.push({ pathname: '/file', params: { uri: file.uri, title: saved.replace(/\.pdf$/i, ''), mime: 'application/pdf' } });
        return;
      }
      await openFile(file, saved.replace(/\.[a-z0-9]+$/i, ''), mime);
    } catch (e) {
      Alert.alert('ファイルを開けませんでした', e instanceof Error ? e.message : String(e));
    }
  };

  const openWindow = (targetUrl: string, childHandoff: Handoff | null = null) => {
    const next = resolveTarget(targetUrl);
    if (!next) return;
    if (next.kind === 'external') {
      Linking.openURL(next.url);
      return;
    }
    // この画面の App.data を控えておく（次から近道が、この画面を開かずに行き先を直接開けるように）
    const pageKey = appDataKeyOfUrl(uri);
    if (pageKey && childHandoff?.appData) rememberAppData(pageKey, childHandoff.appData);
    const data = childHandoff ? depositHandoff(childHandoff) : undefined;
    // 近道で押したボタンが開いた画面は、この画面と入れ替える。ふだんは上に重ねる
    const replace = launchingRef.current;
    launchingRef.current = false;
    if (!replace) {
      openedChild.current = true;
      othersWritesAtOpen.current = writeCount() - ownWrites.current;
    }
    // 近道の途中なら、残りの段を次の画面に引き継ぐ
    const rest = replace && autoClick ? autoClick.steps.slice(1) : [];
    const chain = rest.length > 0 && autoClick ? { auto: rest.join(','), ready: '', label: autoClick.label } : {};
    // 近道で進んだ先の画面にも、入れておく値を引き継ぐ。シートの中なら、シートのまま入れ替える
    const carry = replace && prefill ? { prefill: JSON.stringify(prefill) } : {};
    const runPath = replace && sheet ? ('/sheet/[app]/[form]' as const) : ('/run/[app]/[form]' as const);
    const href =
      next.kind === 'runapp'
        ? { pathname: runPath, params: { app: next.app, form: next.form, q: next.query, data, ...chain, ...carry } }
        : { pathname: '/page' as const, params: { path: next.path, app: appId, data } };
    if (replace) router.replace(href);
    else router.push(href);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: title || pageTitle,
          // ページの中でダイアログやシートが開いているあいだは、上のヘッダーも、ページの後ろと同じだけ暗くする
          // （ページの暗い面はヘッダーの下からしか届かないので、ヘッダーだけ明るく浮いて見えないように）
          headerStyle: { backgroundColor: modalOpen ? dimmed(c.background) : c.background },
          headerTitleStyle: { color: modalOpen ? dimmed(c.text) : c.text },
        }}
      />
      <WebView
        ref={webRef}
        key={reloadKey}
        source={{ uri }}
        style={[styles.web, { backgroundColor: c.background }]}
        sharedCookiesEnabled // iOS: アプリの fetch が保存した Cookie（ログイン）を WebView でも使う
        // 余白の自動調整はしない。ヘッダーは塗ってあり、WebView はその下から始まる（src/app/(app)/_layout.tsx）。
        // 自動にすると、ページの長さによって画面の下（ホームに戻るバー）のぶんを引いたり引かなかったりして、
        // 下に固定したボタンの位置がずれる。下の余白は、ページの側で --myapp-safe-bottom を使って空ける
        contentInsetAdjustmentBehavior="never"
        // 画面の端で引っぱっても、外（何もないところ）を出さない。横のスクロールは、ページの側で画面の幅に切る（ezcraftSkin の BASE_CSS）
        bounces={false}
        overScrollMode="never"
        injectedJavaScriptBeforeContentLoaded={bootJs(c.background) + openerStubJs(handoff) + prefillJs(prefill) + initAppJs(initApp)}
        injectedJavaScript={safeAreaJs(insets.bottom) + BRIDGE_JS + buildSkinScript(appId) + (autoClick && autoClick.steps.length > 0 ? autoClickJs(autoClick.steps[0], autoClick.ready) : '') + restoreScrollJs(restoreTo)}
        // iOS では onMessage を渡さないと injectedJavaScript が実行されない（react-native-webview の既知の動き）
        onMessage={(e) => {
          const message = parseBridgeMessage(e.nativeEvent.data);
          if (message?.type === 'scroll') scroll.current = { y: message.y, target: message.target };
          if (message?.type === 'ready') setShown(true);
          if (message?.type === 'modal') setModalOpen(message.open);
          // 時刻のダイヤルを回したときの、カチッという小さな手ごたえ（iOS の時刻の選び方と同じ）
          if (message?.type === 'tick') Haptics.selectionAsync().catch(() => {});
          if (message?.type === 'file') receiveFile(message.base64, message.name, message.mime);
          if (message?.type === 'childRefreshed' && refreshWait.current) {
            clearTimeout(refreshWait.current);
            refreshWait.current = null;
            if (!message.ok) reloadPage();
          }
          if (message?.type === 'write') {
            noteWrite(message.label);
            ownWrites.current += 1;
          }
          if (message?.type === 'close') close();
          if (message?.type === 'open') openWindow(message.url, message.handoff);
          if (message?.type === 'apply') apply(message.form, message.prefill, message.auto);
          if (message?.type === 'initApp') rememberInitApp({ app: message.app, form: message.form }, message.id, message.text);
          if (message?.type === 'applyQueue' && startApplyQueue(message.form, message.items)) {
            // 申請して戻ってきたら、この画面（勤務表）を読み直す
            openedChild.current = true;
            othersWritesAtOpen.current = writeCount() - ownWrites.current;
          }
        }}
        onLoadStart={() => setModalOpen(false)} // 読み直したら、ダイアログは閉じている
        onOpenWindow={(e) => openWindow(e.nativeEvent.targetUrl)} // target="_blank" のリンクなど
        onNavigationStateChange={(nav) => {
          // ログイン画面に飛ばされた = ログインが切れた。アプリ側もログアウトして、ログイン画面に戻す
          if (!expiredShown.current && pathOf(nav.url).startsWith('/login')) {
            expiredShown.current = true;
            Alert.alert('ログインが切れました', 'もう一度ログインしてください。');
            signOut();
            return;
          }
          // ページの名前（「〇〇 - EZCraft」）から、末尾の「 - EZCraft」を外してヘッダーに出す
          const name = (nav.title ?? '').replace(/\s*-\s*EZCraft$/, '');
          if (name && name !== 'EZCraft' && !name.startsWith('http')) setPageTitle(name);
        }}
      />
      {/* ページが整うまで（近道でメニューを開いているあいだは、下の「〜を開いています」を出す） */}
      {!shown && !launching && (
        <View style={[StyleSheet.absoluteFill, styles.booting, { backgroundColor: c.background }]} pointerEvents="none">
          <ActivityIndicator color={c.textSecondary} />
        </View>
      )}
      {launching && (
        <View style={[StyleSheet.absoluteFill, styles.launching, { backgroundColor: c.background }]}>
          <ActivityIndicator color={c.textSecondary} />
          <Text style={[styles.launchingText, { color: c.textSecondary }]}>
            {autoClick?.label ? `${autoClick.label}を開いています` : '開いています'}
          </Text>
        </View>
      )}
    </>
  );
}

type Target =
  | { kind: 'runapp'; app: string; form: string; query: string }
  | { kind: 'page'; path: string }
  | { kind: 'external'; url: string };

/** 開こうとしている URL が、どの種類の画面かを決める */
function resolveTarget(targetUrl: string): Target | null {
  let url: URL;
  try {
    url = new URL(targetUrl, SERVER_URL);
  } catch {
    return null;
  }
  if (url.host !== new URL(SERVER_URL).host) return { kind: 'external', url: url.toString() };
  const match = url.pathname.match(/^\/runapp\/([^/]+)\/([^/]+)\/?$/);
  if (match) {
    return {
      kind: 'runapp',
      app: decodeURIComponent(match[1]),
      form: decodeURIComponent(match[2]),
      query: url.search.replace(/^\?/, ''),
    };
  }
  return { kind: 'page', path: url.pathname + url.search };
}

const styles = StyleSheet.create({
  web: {
    flex: 1,
  },
  booting: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  launching: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  launchingText: {
    fontSize: 15,
  },
});

/** この URL の画面の定義の控え（なければ null） */
function cachedInitApp(uri: string): { app: string; form: string; text: string } | null {
  const form = initAppFormOfUrl(uri);
  const text = form ? recallInitApp(form) : null;
  return form && text ? { ...form, text } : null;
}

/** 入力欄に入れておく値を、ページに渡す（ページが動き出す前に。値は短い文字だけ: RunApp の parsePrefill） */
function prefillJs(prefill: Record<string, string> | null): string {
  return prefill ? `window.__myappPrefill = ${JSON.stringify(prefill)};\n` : '';
}

/** ページに、画面の下の空けておく高さ（ホームに戻るバー）を CSS の変数 --myapp-safe-bottom で伝える */
function safeAreaJs(bottom: number): string {
  return `document.documentElement.style.setProperty('--myapp-safe-bottom', '${Math.round(bottom)}px');\n`;
}
