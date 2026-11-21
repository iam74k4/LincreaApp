// EZCraft の画面を1つ表示する WebView。アプリの起動画面と、そこから開いた画面の両方で使う。
//
// 中身は EZCraft で作られた Web のアプリなので、ネイティブで作り直さず、そのまま見せる。
//   - ログイン: アプリの通信がもらった Cookie を WebView にも使わせて引き継ぐ（sharedCookiesEnabled）
//   - 見た目:   このアプリに合わせたスタイルをかぶせる（src/webview/ezcraftSkin.ts）
//   - 操作:     1回のタップで押せる・「閉じる」で戻れるようにする（src/webview/bridge.ts）
//   - 画面の移り: 新しいウインドウで開く画面は、アプリの画面として上に重ねる（戻るボタンで戻れる）。
//                開いた元の App.data と、画面に渡す引数も渡す（src/webview/bridge.ts の 2）
//   - その場で申請: ページが知らせた申請の画面を、シートで重ねる（src/webview/bridge.ts の 7・src/openShortcut.ts）
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useNavigation, usePreventRemove, useRoute } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { NativeStackNavigationProp } from 'expo-router/native-stack';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { pathOf } from '../api/http';
import type { Biometry } from '../auth/faceId';
import {
  declinePayslipFaceId,
  enablePayslipFaceId,
  payslipBiometry,
  payslipBiometryToOffer,
  readPayslipPassword,
  renewPayslipPassword,
} from '../auth/payslipPassword';
import { noteAttendanceDays } from '../attendanceReminder';
import { SERVER_URL } from '../config';
import { fileName, openFile, saveIncoming } from '../files';
import { depositLaunch } from '../launch';
import { advanceApplyQueue, applyQueueActive, openApplication, startApplyQueue } from '../openShortcut';
import { useSession } from '../session/SessionContext';
import { useColors } from '../theme';
import { GlassButton } from './GlassButton';
import { SaveProgress } from './SaveProgress';
import { healthAvailable, stepsOn } from '../health';
import {
  allowedFrom,
  autoClickJs,
  BRIDGE_JS,
  childClosedJs,
  healthFlagJs,
  joinScripts,
  NET_TRACE_JS,
  openerStubJs,
  parseBridgeMessage,
  prefillJs,
  pwBioJs,
  pwFillJs,
  restoreScrollJs,
  safeAreaJs,
  SAVE_WATCH_JS,
  stepsDayAllowed,
  stepsReplyJs,
} from '../webview/bridge';
import { bootJs, buildSkinScript, SHOW_PAGE_JS } from '../webview/ezcraftSkin';
import { CAN_PARK, Parkable } from '../webview/savePark';
import { appDataKeyOfUrl, rememberAppData } from '../webview/appDataCache';
import { depositHandoff, type Handoff } from '../webview/handoff';
import { initAppJs, refModeJs } from '../webview/initApp';
import { isServerUrl, mayNavigate, mayOpenOutside } from '../webview/origin';
import { initAppFormOfUrl, recallInitApp, rememberInitApp } from '../webview/initAppCache';
import { recallRefModes, rememberRefMode } from '../webview/refModeCache';
import {
  attachApply,
  backgroundSavePendingFor,
  beginSave,
  endSave,
  moveSaveToBackground,
  onBackgroundSaveDone,
  savingElsewhere,
  savingSamePage,
  subscribeSaves,
  updateSave,
  type PendingApply,
} from '../webview/backgroundSaves';
import { clockOf } from '../clock';
import { describeNet, describeSave, loadSaveSizes, rememberSaveSize, saveKey, saveSizeOf, savingText, type SaveSize } from '../webview/saveSizes';
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
// 保存の途中で戻ろうとしたとき、保存が終わってから、ページが自分で閉じるのを待つ長さ（閉じなければ、アプリが戻る）
const BACK_AFTER_SAVE_MS = 800;
// 裏で続けた保存が終わってから、ページが自分で閉じるのを待つ長さ（閉じなければ、アプリが片づける）。
// EZCraft は保存（commit）のあとも、閉じるまでにサーバーとやりとりすることがある。途中でページを消すと、
// サーバーに書きかけのやりとりが残り、次の保存が「Lock wait timeout」で待ちきれなくなるおそれがあるので、長めに待つ
const BACKGROUND_CLOSE_WAIT_MS = 10_000;
// 前の保存を待っているあいだに戻ろうとしたとき、待たせていた「登録」を押し直してから、保存が始まるのを待つ長さ
// （始まらなければ、押し直しで確かめの知らせなどが出たので、戻らずにこの画面のままにする）
const LEAVE_AFTER_START_WAIT_MS = 3000;
// 保存の通信がこれだけ止まったら、見張りをやめる（ページの側で何かが止まった。戻れないままにしない）
const SAVE_STALL_MS = 60_000;
// 裏で続けている保存は、もっと長く待つ。見張りをやめるとページごと片づけるので、通信の途中で消すと、
// サーバーに書きかけのやりとりが残る（次の保存が「Lock wait timeout」になる）。EZCraft は 100 秒を超えたやりとりを
// 取り消すので、それより十分長く待ってから片づける
const BACKGROUND_STALL_MS = 180_000;
// 裏の保存に失敗したとき、ページが出すエラーの文（saveError）を待つ長さ
// （SAVE_WATCH_JS は、失敗を知らせてから 0.4 秒ほどあとに、EZCraft が出したエラーの文を送ってくる）
const ERROR_WAIT_MS = 2000;
/** 画面が横へ去る動きが終わったと知らせが来なくても、これだけたったらページを置き場へ移す */
const PARK_FALLBACK_MS = 1000;

/** 保存（登録・削除など）のいま（bridge の 9） */
type SaveRun = {
  /** 画面と押したボタン（src/webview/saveSizes.ts） */
  key: string;
  startedAt: number;
  writes: number;
  steps: number;
  /** 前に同じ保存をしたときの数（知らなければ null） */
  size: SaveSize | null;
  /** 保存のあいだに戻ろうとした（終わったら戻る） */
  backAfter: boolean;
  lastAt: number;
};

/** ダイアログの後ろの暗さ（ページの .tcc-modal-back などと同じ。src/webview/ezcraftSkin.ts） */
const DIM = 0.28;
/** #RRGGBB の色に、黒を DIM だけ重ねた色 */
function dimmed(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(v * (1 - DIM));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

export function EzcraftWebView({ uri, appId, title, handoff = null, autoClick = null, prefill = null, sheet = false }: Props) {
  const { session, signOut, reauthenticate } = useSession();
  const c = useColors();
  const insets = useSafeAreaInsets(); // 画面の下の、ホームに戻るバーの高さ。ページの下に固定するものを、その上に置く
  const expiredShown = useRef(false);
  const openedChild = useRef(false);
  // 書き込みの回数（この画面のぶんを除く）。重ねて開いた画面から戻ったとき、増えていたら読み直す
  const ownWrites = useRef(0);
  const othersWritesAtOpen = useRef(0);
  const [pageTitle, setPageTitle] = useState('');
  const [heading, setHeading] = useState(''); // ページが知らせてきた、いまの画面の名前（勤務表のタブなど）
  const [reloadKey, setReloadKey] = useState(0); // 変えると WebView を作り直す（= 読み直す）
  // ページの中でダイアログが開いているか（bridge の 8）。開いているあいだは、‹ やスワイプで戻らず、まずダイアログを閉じる
  const [modalOpen, setModalOpen] = useState(false);
  const allowModalRemove = usePreventRemove(modalOpen, () => {
    webRef.current?.injectJavaScript('window.__myappCloseModal && window.__myappCloseModal(); true;');
  });
  // この画面の定義（initApp）の控え。あれば、ページは読まずにこれを使う（src/webview/initAppCache.ts）。
  // 開いたとき（と読み直すとき）に決めて、そのあいだは変えない（変えると、ページに入れるスクリプトが入れ替わる）
  const [initApp, setInitApp] = useState(() => cachedInitApp(uri));
  // ログインした人の「参照モード」の返事の控え（src/webview/refModeCache.ts）。開いたとき（と読み直すとき）に決める
  const [refModes, setRefModes] = useState(() => recallRefModes());
  // ページが整ったか。整うまでは中身を隠し（bootJs）、読み込み中の印を出しておく（整える前の見た目が一瞬見えないように）
  const [shown, setShown] = useState(false);
  // ページを読み込めなかったときに出す文（通信できない・サーバーが答えない）。「もう一度読み込む」で消す
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const webRef = useRef<ComponentRef<typeof WebView>>(null);
  // この画面（重ねた画面の1枚）。裏で保存を続けるとき、重ねる順を入れ替えるのに使う（src/webview/backgroundSaves.ts）
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const routeKey = useRoute().key;
  // 保存（登録・削除など）のあいだ（bridge の 9）。「保存しています（n/m）」を出す。
  // 途中で画面が消えると、確定（commit）が送られず、保存が切れる（2026-11-18 に確かめた）。戻り方は下の canLeave
  const [saving, setSaving] = useState<SaveRun | null>(null);
  const savingRef = useRef<SaveRun | null>(null);
  const updateSaving = useCallback((next: SaveRun | null | ((current: SaveRun) => SaveRun)) => {
    const value = typeof next === 'function' ? (savingRef.current ? next(savingRef.current) : null) : next;
    savingRef.current = value;
    setSaving(value);
  }, []);
  const inBackground = useRef(false); // 保存を裏で続けている（この画面は見えない）
  // ページを画面の後ろの置き場へ移したか（src/webview/savePark.tsx）。移しても読み込み直さず、保存はそのまま続く
  const [parked, setParked] = useState(false);
  // 置き場へ移すのを待っているあいだの片づけ（タイマーと、動きの終わりの知らせを外す）。待っていなければ null
  const cancelParkWait = useRef<(() => void) | null>(null);
  const backgroundWait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundApply = useRef<PendingApply | null>(null); // 裏の保存のあとに、ページが開こうとした申請
  // ほかの画面の保存が終わるのを待っている（「登録」などを押したが、まだ始めていない）
  const [waitingSave, setWaitingSave] = useState(false);
  // --- 重ねた画面の順の入れ替え（裏の保存） ---
  // 保存の途中で戻る: この画面を一番下に移して、ひとつ前の画面を見せる。ページは画面の後ろの置き場へ移す（保存は続く）。
  // 一番下はマイアプリの下なので、戻る操作で出てくることはない（マイアプリでは戻れない。src/app/(app)/_layout.tsx）
  const moveToBackground = useCallback((): boolean => {
    const state = navigation.getState();
    const routes = state?.routes ?? [];
    const me = routes.findIndex((r) => r.key === routeKey);
    if (!state || me < 1 || me !== routes.length - 1) return false;
    const others = routes.filter((r) => r.key !== routeKey);
    inBackground.current = true;
    moveSaveToBackground(routeKey, routes[me - 1].key);
    navigation.dispatch({ type: 'RESET', payload: { ...state, routes: [routes[me], ...others], index: others.length } });
    // ページを、画面の後ろの置き場へ移す。この画面が横へ去る動きが終わってから移す
    // （先に移すと、去っていく画面が空になって見える。動き終わってから移すまでの一瞬なら、iOS はページを止めない）
    const park = () => {
      cancelParkWait.current?.();
      setParked(true);
    };
    const timer = setTimeout(park, PARK_FALLBACK_MS);
    const off = navigation.addListener('transitionEnd', park);
    cancelParkWait.current = () => {
      clearTimeout(timer);
      off();
      cancelParkWait.current = null;
    };
    return true;
  }, [navigation, routeKey]);
  // 保存の途中で戻る。ページを置き場へ移せるなら、すぐに戻る（保存は裏で続く。なぜ置き場が要るかは src/webview/savePark.tsx）。
  // 置き場を使えないとき（Expo Go・Android）とシートの画面では、保存が終わってから戻る
  const canLeave = CAN_PARK && !sheet;
  // 前の保存を待っているあいだに戻ろうとした（待たせていた「登録」が始まったら戻る）。
  // 待っているあいだに画面を消すと、待たせていた「登録」は押されないまま消えるため（2026-11-18 のレビュー）
  const [leaveAfterStart, setLeaveAfterStart] = useState(false);
  const leaveAfterStartRef = useRef(false);
  const leaveAfterStartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestLeaveAfterStart = useCallback((on: boolean) => {
    leaveAfterStartRef.current = on;
    setLeaveAfterStart(on);
    if (leaveAfterStartTimer.current) clearTimeout(leaveAfterStartTimer.current);
    leaveAfterStartTimer.current = null;
  }, []);
  const leaveDuringSave = useCallback(() => {
    // 保存の途中で、ページが確かめのダイアログ（承認者確認フォームなど）を開いて答えを待っている。
    // 戻る代わりにダイアログを閉じる（ページが保存を取り消す）。裏へ回すと、見えないダイアログが答えを待ったまま止まるため
    if (savingRef.current && modalOpen) {
      webRef.current?.injectJavaScript('window.__myappCloseModal && window.__myappCloseModal(); true;');
      return;
    }
    if (savingRef.current) {
      if (canLeave && moveToBackground()) return;
      updateSaving((run) => ({ ...run, backAfter: true }));
      return;
    }
    if (waitingSave) {
      requestLeaveAfterStart(true);
      return;
    }
    // 保存も待ちもない（保存が終わった直後に、まだ出ていた ‹ を押した）: ふつうに戻る
    if (navigation.canGoBack()) navigation.goBack();
  }, [canLeave, modalOpen, moveToBackground, navigation, requestLeaveAfterStart, updateSaving, waitingSave]);
  // 保存のあいだと、前の保存を待っているあいだは、iOS の戻る動き（‹ とスワイプ）を止める（途中で画面が消えると、保存が切れる）。
  // 裏で続けられるときは、‹ を同じ見た目のボタンに替え、スワイプは保存の知らせの上で受けて、アプリが自分で戻る
  // （iOS の戻る動きを止めると、iOS がいったん動きを取り消すので、画面が一瞬戻ってから去って見える。2026-11-18、実機）。
  // ここで止めるのは、それ以外の戻り方（ページの中から閉じるなど）
  const busy = saving !== null || waitingSave;
  const allowSaveRemove = usePreventRemove(busy, leaveDuringSave);
  const lastWriteLabel = useRef(''); // 最後に押した書き込みのボタン（「登録」など）
  const saveLog = useRef<{ cmd: string; ms: number }[]>([]); // いまの保存の、通信ごとの時間（開発中に Metro へ出す）
  const backAfterSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByPageRef = useRef(false);
  useEffect(() => {
    loadSaveSizes();
    return () => {
      if (backAfterSave.current) clearTimeout(backAfterSave.current);
      if (backgroundWait.current) clearTimeout(backgroundWait.current);
      if (leaveAfterStartTimer.current) clearTimeout(leaveAfterStartTimer.current);
      cancelParkWait.current?.();
      // 保存の途中で画面が消えた（ログアウトなど）。ほかの画面の保存を待たせたままにしない
      endSave(routeKey, false);
    };
  }, [routeKey]);

  // 裏の保存が終わった: 見えないところに残していたこの画面を片づける
  const removeSelf = () => {
    const state = navigation.getState();
    const routes = state?.routes ?? [];
    const me = routes.findIndex((r) => r.key === routeKey);
    if (!state || me < 0) return;
    allowSaveRemove();
    allowModalRemove();
    const rest = routes.filter((r) => r.key !== routeKey);
    const index = state.index > me ? state.index - 1 : Math.min(state.index, rest.length - 1);
    navigation.dispatch({ type: 'RESET', payload: { ...state, routes: rest, index } });
  };
  // 裏の保存に失敗した: 保存は取り消されているので、この画面も片づけて、上の知らせに理由と「開き直す」を出す。
  // （この画面を前に戻すことはしない。重ねる順を入れ替えて戻すと、画面が止まった絵のままになった。2026-11-18）
  const failedInBackground = useRef(false);
  const saveErrorText = useRef('');
  const completeBackground = (ok: boolean) => {
    if (!inBackground.current) return;
    inBackground.current = false;
    failedInBackground.current = false;
    if (backgroundWait.current) clearTimeout(backgroundWait.current);
    backgroundWait.current = null;
    if (!ok) {
      const me = navigation.getState()?.routes.find((r) => r.key === routeKey);
      const params = Object.fromEntries(
        Object.entries((me?.params ?? {}) as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      );
      endSave(routeKey, false, { error: saveErrorText.current || null, reopen: me ? { pathname: `/${me.name}`, params } : null });
      removeSelf();
      return;
    }
    const next = backgroundApply.current;
    backgroundApply.current = null;
    if (next) attachApply(routeKey, next);
    endSave(routeKey, true); // 戻った先の画面が、これを見てデータを新しくする
    removeSelf();
  };

  // 保存の通信が長く止まったら、見張りをやめる（戻れるようにする。裏で続けていたなら、片づけて知らせに失敗を出す）。
  // 裏で続けている保存は BACKGROUND_STALL_MS まで待つ（待つあいだは、知らせに「返事を待っています」と出す）
  const savingLastAt = saving?.lastAt ?? null;
  useEffect(() => {
    if (savingLastAt === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const quiet = Date.now() - savingLastAt;
      if (inBackground.current && quiet < BACKGROUND_STALL_MS) {
        updateSave(routeKey, '保存しています（返事を待っています）');
        timer = setTimeout(check, BACKGROUND_STALL_MS - quiet);
        return;
      }
      updateSaving(null);
      if (inBackground.current) completeBackground(false);
      else endSave(routeKey, false);
    };
    timer = setTimeout(check, SAVE_STALL_MS);
    return () => clearTimeout(timer);
    // completeBackground は、そのときの画面の重なりを読むので、最新のものでなくてよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savingLastAt, updateSaving, routeKey]);
  const finishSave = (end: { ok: boolean; steps: number; writes: number; ms: number }) => {
    const run = savingRef.current;
    updateSaving(null);
    if (run) {
      if (__DEV__) console.log(describeSave(run.key, end, saveLog.current) + (inBackground.current ? '（裏で保存）' : ''));
      if (end.ok) rememberSaveSize(run.key, { writes: end.writes, steps: end.steps });
    }
    if (inBackground.current) {
      if (!end.ok) {
        // ページが出すエラーの文（saveError）を少し待ってから片づける
        failedInBackground.current = true;
        saveErrorText.current = '';
        backgroundWait.current = setTimeout(() => completeBackground(false), ERROR_WAIT_MS);
        return;
      }
      // ページは保存が終わると自分で閉じる（EZCraft の form.close → close）。閉じるのを待ってから片づける。閉じなければ、しばらく待って片づける
      backgroundWait.current = setTimeout(() => {
        if (__DEV__) console.log(`[保存] ページが ${BACKGROUND_CLOSE_WAIT_MS / 1000} 秒たっても閉じなかったので、片づけた`);
        completeBackground(true);
      }, BACKGROUND_CLOSE_WAIT_MS);
      return;
    }
    endSave(routeKey, end.ok);
    if (!run) return;
    // シートの画面で、保存のあいだに戻ろうとしていた。ページは保存が終わると自分で閉じることが多い（EZCraft の form.close）。
    // 閉じなければ、アプリが戻る。保存に失敗したら戻らない（ページが出す知らせを見てもらう）
    if (run.backAfter && end.ok) {
      backAfterSave.current = setTimeout(() => {
        backAfterSave.current = null;
        if (!closedByPageRef.current && router.canGoBack()) router.back();
      }, BACK_AFTER_SAVE_MS);
    }
  };
  const scroll = useRef({ y: 0, target: '' }); // いまのスクロール位置（ページが知らせてくる。target は動いた箱）
  const [restoreTo, setRestoreTo] = useState({ y: 0, target: '' }); // 読み直したあとに戻すスクロール位置
  const [launching, setLaunching] = useState(autoClick !== null); // 近道で、ボタンを押して次へ進むのを待っている
  const launchingRef = useRef(launching);
  // 登録のあとに自動で開く申請（ページが閉じるかもしれないので、少し待ってから開く）
  const pendingApply = useRef<{ form: string; prefill: Record<string, string>; timer: ReturnType<typeof setTimeout> } | null>(null);

  const apply = (form: string, values: Record<string, string>, auto: boolean) => {
    // 裏で保存していた画面: いきなり開かず、上の知らせのボタンで開けるようにする
    if (auto && inBackground.current) {
      backgroundApply.current = { form, prefill: values };
      return;
    }
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
    closedByPageRef.current = true;
    updateSaving(null);
    // ページが自分で閉じるときは、ダイアログが開いていても止めない（止める設定を外してから戻る）
    setModalOpen(false);
    // 裏で保存していた画面: いま見ている画面は戻さず、この画面だけを片づける
    if (inBackground.current) {
      if (waiting) backgroundApply.current = { form: waiting.form, prefill: waiting.prefill };
      completeBackground(true);
      return;
    }
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
    setFailure(null);
    setShown(false);
    setInitApp(cachedInitApp(uri));
    setRefModes(recallRefModes());
    setReloadKey((k) => k + 1);
  }, [uri]);
  // データだけの読み直しを頼んで、返事を待っているあいだのタイマー（返事がなければ、丸ごと読み直す）
  const refreshWait = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (refreshWait.current) clearTimeout(refreshWait.current);
  }, []);

  // 重ねて開いた画面の結果と、そのあいだの書き込みを受け取って、数え直す（読み直すと、それまでの書き込みも反映されるので）。
  // まとめて申請の途中なら、次の1件から戻ってきたときも見る（src/openShortcut.ts）
  const takeChildChanges = useCallback(() => {
    const wrote = writeCount() - ownWrites.current !== othersWritesAtOpen.current;
    const child = takeChildResult();
    openedChild.current = applyQueueActive();
    othersWritesAtOpen.current = writeCount() - ownWrites.current;
    return { wrote, child };
  }, []);
  // この画面のデータを新しくする。押したボタン（「登録」「削除」）が分かれば、Web 版と同じく、閉じたあとの処理
  // （データだけ読み直す）をページで走らせる。一覧はそのまま見えていて、変わった行だけが少しあとで新しくなる
  // （読み込み中の印・ページの高さ・見ていた位置の保ち方は src/webview/bridge.ts の childClosedJs）。
  // できない画面（処理を用意していない・ページが消えていた）や、ボタンが分からないときは、丸ごと読み直す
  const refreshData = useCallback(
    (label: string | null) => {
      if (!label || !webRef.current) {
        if (__DEV__) console.log('[読み直し] 丸ごと');
        reloadPage();
        return;
      }
      if (__DEV__) console.log(`[読み直し] データだけ（${label}）`);
      if (refreshWait.current) clearTimeout(refreshWait.current);
      refreshWait.current = setTimeout(() => {
        refreshWait.current = null;
        reloadPage();
      }, REFRESH_REPLY_MS);
      webRef.current.injectJavaScript(childClosedJs(label, scroll.current));
    },
    [reloadPage],
  );
  // 重ねて開いた画面から戻ってきたら、その画面（とその先）でデータを書き込んだときだけ、この画面を新しくする
  // （何も変えずに戻ったときは、そのまま見せる。読み直すと数秒かかる）。
  // データだけ読み直すのは、その画面が「登録」などを終えて自分で閉じたときだけ（閉じ方が違うときは、丸ごと読み直す）
  const refreshAfterChild = useCallback(() => {
    if (!openedChild.current) return;
    const { wrote, child } = takeChildChanges();
    if (wrote) refreshData(child.closedByPage ? child.label : null);
  }, [refreshData, takeChildChanges]);
  // 重ねた画面が裏で続けた保存が終わったのに、まだ読み直していない（その保存で押したボタンの名前。なければ null）。
  // 終わったときにこの画面が前に出ていない（ほかの日を開いていた）ことや、すぐ次の保存を裏に回したことがあるので、
  // 「前に出ていて、裏の保存を待っていない」ときになったら、必ず読み直す（読み直すきっかけは下の2つ）
  const pendingBackgroundRefresh = useRef<string | null>(null);
  const consumeBackgroundRefresh = useCallback((): boolean => {
    const label = pendingBackgroundRefresh.current;
    if (label === null) return false;
    pendingBackgroundRefresh.current = null;
    takeChildChanges();
    refreshData(label);
    return true;
  }, [refreshData, takeChildChanges]);
  // 隠れているあいだに iOS に中身を捨てられたページは、前に出てきたときに読み直す（onContentProcessDidTerminate）
  const reloadWhenShown = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!reloadWhenShown.current) return;
      reloadWhenShown.current = false;
      reloadPage();
    }, [reloadPage]),
  );
  // 重ねた画面が保存を裏で続けているあいだは、まだ新しくしない（保存が終わってから。下の onBackgroundSaveDone）
  useFocusEffect(
    useCallback(() => {
      if (backgroundSavePendingFor(routeKey)) return;
      if (!consumeBackgroundRefresh()) refreshAfterChild();
    }, [consumeBackgroundRefresh, refreshAfterChild, routeKey]),
  );
  useEffect(
    () =>
      onBackgroundSaveDone((save, ok) => {
        if (save.parentKey !== routeKey) return;
        if (ok) pendingBackgroundRefresh.current = save.label;
        // 失敗した保存の終わりでも、前に終わっていた保存の読み直しが残っていれば、ここで読み直す
        if (navigation.isFocused() && !backgroundSavePendingFor(routeKey)) consumeBackgroundRefresh();
      }),
    [consumeBackgroundRefresh, navigation, routeKey],
  );

  // ほかの画面が保存しているあいだは、この画面の「登録」などを待たせる（SAVE_WATCH_JS）。終わったら、待たせていたボタンを押す
  useEffect(() => {
    let busy = false;
    const sync = () => {
      const next = savingElsewhere(routeKey);
      if (next === busy) return;
      busy = next;
      webRef.current?.injectJavaScript(
        next ? 'window.__myappSaveBusy = true; true;' : 'window.__myappSaveBusy = false; window.__myappSaveFree && window.__myappSaveFree(); true;',
      );
      if (next) return;
      setWaitingSave(false);
      // 戻ろうとしていたのに、押し直した「登録」で保存が始まらない（確かめの知らせが出たなど）: 戻るのをやめる
      if (leaveAfterStartRef.current) leaveAfterStartTimer.current = setTimeout(() => requestLeaveAfterStart(false), LEAVE_AFTER_START_WAIT_MS);
    };
    sync();
    return subscribeSaves(sync);
  }, [requestLeaveAfterStart, routeKey]);

  // 同じページ（同じ日の勤怠実績登録など）を、ほかの画面が裏で保存しているあいだに開いた。保存する前の中身を見せているので、
  // 入力できないようにして待ち、終わったら新しい中身で開き直す（古い中身のまま「登録」すると、裏の保存を上書きしてしまう）
  const savePageKey = handoff?.params ? `${uri}|${handoff.params}` : null;
  const samePageSaving = useSyncExternalStore(subscribeSaves, () => savingSamePage(savePageKey, routeKey));
  const waitedSamePage = useRef(false);
  useEffect(() => {
    if (samePageSaving) {
      waitedSamePage.current = true;
      return;
    }
    if (!waitedSamePage.current) return;
    waitedSamePage.current = false;
    reloadPage();
  }, [samePageSaving, reloadPage]);

  // 給与・賞与明細: パスワードを Face ID で入れる（src/auth/payslipPassword.ts。ページの側は appStyles.ts の L_Payslip）。
  //   - Face ID で開けるなら、ページに伝える（ダイアログを開くと、ページが Face ID を頼んでくる）
  //   - 頼まれたら、Face ID で本人か確かめて、覚えておいたパスワードを欄に入れて開く
  //   - 手で入れて明細が開けたら、次から Face ID を使うか聞く（使っていれば、覚えているパスワードを入れ替える）
  const payslip = appId === PAYSLIP_APP;
  const username = session?.username ?? '';
  const [pwBio, setPwBio] = useState<Biometry | null>(null);
  /** 手で入れて「開く」を押したパスワードと、その時刻（明細が届いたら、正しかったと分かる） */
  const typedPassword = useRef<{ value: string; at: number } | null>(null);
  useEffect(() => {
    if (!payslip || !username) return;
    let alive = true;
    payslipBiometry(username).then((kind) => {
      if (alive) setPwBio(kind);
    });
    return () => {
      alive = false;
    };
  }, [payslip, username]);
  const tellPwBio = useCallback((kind: Biometry | null) => {
    webRef.current?.injectJavaScript(`${pwBioJs(kind)}window.__myappAppUpdate && window.__myappAppUpdate(); true;`);
  }, []);
  useEffect(() => {
    if (payslip) tellPwBio(pwBio);
  }, [payslip, pwBio, tellPwBio]);
  const fillPassword = async () => {
    typedPassword.current = null; // 前に手で入れたもの（違っていたかもしれない）は使わない
    const result = await readPayslipPassword(username);
    webRef.current?.injectJavaScript(pwFillJs(result.ok ? result.password : null));
    if (result.ok || result.reason === 'cancel') return;
    const kind = pwBio ?? 'Face ID';
    setPwBio(null);
    if (result.reason === 'reset') {
      Alert.alert(`${kind} の登録が変わりました`, `パスワードを入れて開いてください。開けたら、また ${kind} を使えるようにできます。`);
    }
  };
  /** 明細が届いた（パスワードが正しかった）。手で入れたものなら、Face ID で覚えるか聞く */
  const afterPayslipOpened = async () => {
    const typed = typedPassword.current;
    typedPassword.current = null;
    if (!typed || !username || Date.now() - typed.at > 60_000) return;
    if (await payslipBiometry(username)) {
      await renewPayslipPassword(username, typed.value);
      return;
    }
    const kind = await payslipBiometryToOffer(username);
    if (!kind) return;
    const use = await new Promise<boolean>((resolve) =>
      Alert.alert(
        `次から ${kind} で開きますか？`,
        `パスワードを、この iPhone に ${kind} 付きで覚えておきます。次からはパスワードを入れずに明細を開けます。`,
        [
          { text: '使わない', style: 'cancel', onPress: () => resolve(false) },
          { text: `${kind} を使う`, onPress: () => resolve(true) },
        ],
        { cancelable: false },
      ),
    );
    if (!use) {
      await declinePayslipFaceId(username);
      return;
    }
    if (await enablePayslipFaceId(username, typed.value, kind)) setPwBio(kind);
  };

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
      if (payslip) await afterPayslipOpened();
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

  // ログインが切れた（ログイン画面に飛ばされた・401 が返った）。Face ID で入り直せたら、この画面を読み直して続ける。
  // できなければ、アプリ側もログアウトして、ログイン画面に戻す
  const handleExpired = () => {
    if (expiredShown.current) return;
    expiredShown.current = true;
    setShown(false); // EZCraft のログイン画面や 401 のページは見せない（読み込み中の印を出しておく）
    reauthenticate().then((ok) => {
      if (ok) {
        expiredShown.current = false;
        reloadPage();
        return;
      }
      Alert.alert('ログインが切れました', 'もう一度ログインしてください。');
      signOut();
    });
  };

  const openWindow = (targetUrl: string, childHandoff: Handoff | null = null) => {
    const next = resolveTarget(targetUrl);
    if (!next) return;
    if (next.kind === 'external') {
      // ほかのサイトは、アプリの外（Safari）で開く。https のページだけ（電話・ほかのアプリなどのリンクは開かない）
      if (mayOpenOutside(next.url)) Linking.openURL(next.url).catch(() => {});
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
    // 近道の途中なら、残りの段と入れておく値を、次の画面に引き継ぐ（引数には書かずに預けて番号だけ渡す。src/launch.ts）。
    // シートの中なら、シートのまま入れ替える
    const rest = replace && autoClick ? autoClick.steps.slice(1) : [];
    const carried = replace && (rest.length > 0 || prefill);
    const orders = carried
      ? { launch: depositLaunch({ steps: rest, ready: '', label: autoClick?.label ?? '', prefill: prefill ?? undefined }) }
      : {};
    const runPath = replace && sheet ? ('/sheet/[app]/[form]' as const) : ('/run/[app]/[form]' as const);
    const href =
      next.kind === 'runapp'
        ? { pathname: runPath, params: { app: next.app, form: next.form, q: next.query, data, ...orders } }
        : { pathname: '/page' as const, params: { path: next.path, app: appId, data } };
    if (replace) router.replace(href);
    else router.push(href);
  };

  // ヘッダー。保存の一歩ごとに作り直さないように、変わるものだけで作る（作り直すたびに、ヘッダーが描き直される）
  const screenOptions = useMemo(
    () => ({
      // ページが名前を知らせてきたら（勤務表の「集計」タブなど）、それを出す
      title: heading || title || pageTitle,
      // ページの中でダイアログやシートが開いているあいだは、上のヘッダーも、ページの後ろと同じだけ暗くする
      // （ページの暗い面はヘッダーの下からしか届かないので、ヘッダーだけ明るく浮いて見えないように）
      headerStyle: { backgroundColor: modalOpen ? dimmed(c.background) : c.background },
      headerTitleStyle: { color: modalOpen ? dimmed(c.text) : c.text },
      // 保存のあいだは、iOS の横へのスワイプでは戻らない（上の usePreventRemove）。
      // 裏で続けられるときは、保存の知らせの上で右へなぞると戻る（SaveProgress の onLeave）
      gestureEnabled: !busy,
      // 裏で続けられるときは、保存のあいだの ‹ を、同じ見た目のボタンに替える（押したら、アプリが自分で戻る）。
      // 保存が終わったら、いつもの ‹ に戻す（options は前の値に重ねられるので、undefined で消す）
      headerLeft:
        busy && canLeave
          ? () => (
              <Pressable onPress={leaveDuringSave} accessibilityRole="button" accessibilityLabel="戻る" hitSlop={8}>
                <SymbolView name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }} size={20} weight="semibold" tintColor={c.text} />
              </Pressable>
            )
          : undefined,
    }),
    [heading, title, pageTitle, modalOpen, c, busy, canLeave, leaveDuringSave],
  );

  // ページに入れるスクリプト（合わせて 700KB ほどになる）。中身が変わるときだけ作り直す。
  // 保存の一歩ごとなど、この画面は何度も描き直されるので、そのたびに大きな文字をつなぎ直さないように。
  // 1本ずつ囲んでつなぐ（1本が例外を出しても、ほかは動く。bridge の joinScripts）
  const background = c.background;
  const beforeLoadJs = useMemo(
    () =>
      joinScripts([
        // 開発中だけ: ページの通信を1回ずつ Metro のログに出す（保存の遅さを調べるため。bridge の NET_TRACE_JS）
        __DEV__ ? NET_TRACE_JS : '',
        bootJs(background),
        openerStubJs(handoff),
        prefillJs(prefill),
        initAppJs(initApp),
        refModeJs(refModes),
        healthFlagJs(HEALTH),
      ]),
    [background, handoff, prefill, initApp, refModes],
  );
  const firstStep = autoClick && autoClick.steps.length > 0 ? autoClick.steps[0] : null;
  const readyKey = autoClick?.ready ?? '';
  const afterLoadJs = useMemo(
    () =>
      joinScripts([
        safeAreaJs(insets.bottom),
        BRIDGE_JS,
        SAVE_WATCH_JS,
        buildSkinScript(appId),
        firstStep ? autoClickJs(firstStep, readyKey) : '',
        restoreScrollJs(restoreTo),
      ]),
    [insets.bottom, appId, firstStep, readyKey, restoreTo],
  );
  const source = useMemo(() => ({ uri }), [uri]);
  const webStyle = useMemo(() => [styles.web, { backgroundColor: background }], [background]);

  return (
    <>
      <Stack.Screen options={screenOptions} />
      {/* 保存を裏で続けるあいだは、ページを画面の後ろの置き場へ移す（読み込み直さない。src/webview/savePark.tsx） */}
      <Parkable parked={parked} style={styles.web}>
        <WebView
          ref={webRef}
          key={reloadKey}
          source={source}
          style={webStyle}
          sharedCookiesEnabled // iOS: アプリの fetch が保存した Cookie（ログイン）を WebView でも使う
          // 余白の自動調整はしない。ヘッダーは塗ってあり、WebView はその下から始まる（src/app/(app)/_layout.tsx）。
          // 自動にすると、ページの長さによって画面の下（ホームに戻るバー）のぶんを引いたり引かなかったりして、
          // 下に固定したボタンの位置がずれる。下の余白は、ページの側で --myapp-safe-bottom を使って空ける
          contentInsetAdjustmentBehavior="never"
          // 画面の端で引っぱっても、外（何もないところ）を出さない。横のスクロールは、ページの側で画面の幅に切る（ezcraftSkin の BASE_CSS）
          bounces={false}
          overScrollMode="never"
          injectedJavaScriptBeforeContentLoaded={beforeLoadJs}
          injectedJavaScript={afterLoadJs}
          // iOS では onMessage を渡さないと injectedJavaScript が実行されない（react-native-webview の既知の動き）
          // 画面全体は、会社のサイトのページだけを出す。ほかのサイトへのリンクは、アプリの外（Safari）で開く
          // （アプリが入れる仕組みとデータが、ほかのサイトに渡らないように。src/webview/origin.ts）
          onShouldStartLoadWithRequest={(req) => {
            if (mayNavigate(req.url, req.isTopFrame)) return true;
            if (mayOpenOutside(req.url)) Linking.openURL(req.url).catch(() => {});
            return false;
          }}
          onMessage={(e) => {
            // 知らせは、会社のサイトのページから来たものだけを受け付ける
            if (!isServerUrl(e.nativeEvent.url)) return;
            const parsed = parseBridgeMessage(e.nativeEvent.data);
            // アプリごとの知らせ（歩数・申請・勤務表の状態）は、そのアプリの画面からだけ受け付ける（bridge の allowedFrom）
            const message = parsed && allowedFrom(parsed, appId) ? parsed : null;
            if (message?.type === 'scroll') scroll.current = { y: message.y, target: message.target };
            if (message?.type === 'ready') {
              setShown(true);
              if (payslip) tellPwBio(pwBio);
            }
            if (message?.type === 'pwFaceId') fillPassword();
            if (message?.type === 'pwTyped') typedPassword.current = { value: message.value, at: Date.now() };
            if (message?.type === 'modal') {
              setModalOpen(message.open);
              // 保存の途中でページが開いた確かめのダイアログ（残業申請の「承認者確認フォーム」など）に答えた:
              // 保存はここから続くので、「保存しています」を出し直す（ダイアログを開いていた時間は数えない）
              if (!message.open && savingRef.current) updateSaving((run) => ({ ...run, startedAt: Date.now(), lastAt: Date.now() }));
            }
            // 時刻のダイヤルを回したときの、カチッという小さな手ごたえ（iOS の時刻の選び方と同じ）
            if (message?.type === 'tick') Haptics.selectionAsync().catch(() => {});
            if (message?.type === 'file') receiveFile(message.base64, message.name, message.mime);
            if (message?.type === 'title') setHeading(message.text);
            // Walk the Talk: 歩数の登録の欄に入れる、ヘルスケアの歩数（初めてなら、iOS が読んでよいかを聞く）
            if (message?.type === 'steps') {
              const { id, day } = message;
              // 未来の日・古すぎる日は、読まずに「読めなかった」と答える（ページは返事を待っているので、答えはする）
              (stepsDayAllowed(day) ? stepsOn(day) : Promise.resolve(null)).then((steps) => webRef.current?.injectJavaScript(stepsReplyJs(id, steps)));
            }
            // 開発中だけ: EZCraft の画面が変わって、見た目の直しが効かなくなった部品がある（黄色い知らせで気づけるように）
            if (message?.type === 'skinMissing' && __DEV__) {
              console.warn(
                `[見た目] ${message.form} に、見た目を直している部品が ${message.ids.length} 個見つかりません。EZCraft の画面が変わったかもしれません: ${message.ids.join(', ')}`,
              );
            }
            if (message?.type === 'childRefreshed') {
              if (!message.ok && __DEV__) console.log('[読み直し] データだけ読み直せなかったので、丸ごと');
              if (refreshWait.current) {
                clearTimeout(refreshWait.current);
                refreshWait.current = null;
                if (!message.ok) reloadPage();
              }
            }
            if (message?.type === 'write') {
              noteWrite(message.label);
              ownWrites.current += 1;
              if (message.label) lastWriteLabel.current = message.label;
            }
            if (message?.type === 'net' && __DEV__) console.log(describeNet(message, heading || title || pageTitle || uri));
            if (message?.type === 'pageLog' && __DEV__) console.log(`[ページ:${message.level}] ${message.text}`);
            // 保存の進み具合（bridge の 9）
            if (message?.type === 'saveStart') {
              if (__DEV__) console.log(`[保存] 始まった ${clockOf(Date.now())}「${lastWriteLabel.current}」`);
              const key = saveKey(uri, lastWriteLabel.current);
              const at = Date.now();
              const size = saveSizeOf(key);
              saveLog.current = [];
              setWaitingSave(false);
              // 前の保存を待っているあいだに戻ろうとしていた: 始まったら戻る（裏で続けられなければ、終わってから戻る）
              const leave = leaveAfterStartRef.current;
              if (leave) requestLeaveAfterStart(false);
              updateSaving({ key, startedAt: at, writes: 0, steps: 0, size, backAfter: leave && !canLeave, lastAt: at });
              beginSave(routeKey, heading || title || pageTitle || '保存', savingText(0, size), lastWriteLabel.current, savePageKey);
              if (leave && canLeave) moveToBackground();
            }
            if (message?.type === 'saveStep') {
              const { cmd, ms, writes, steps } = message;
              saveLog.current.push({ cmd, ms });
              updateSaving((run) => ({ ...run, writes, steps, lastAt: Date.now() }));
              updateSave(routeKey, savingText(writes, savingRef.current?.size ?? null));
            }
            if (message?.type === 'saveWait') setWaitingSave(true);
            if (message?.type === 'saveError') {
              saveErrorText.current = message.text;
              if (failedInBackground.current) completeBackground(false);
            }
            if (message?.type === 'saveEnd') finishSave(message);
            if (message?.type === 'close') close();
            if (message?.type === 'open') openWindow(message.url, message.handoff);
            if (message?.type === 'apply') apply(message.form, message.prefill, message.auto);
            if (message?.type === 'refMode') rememberRefMode(message.key, { text: message.text, type: message.contentType });
            if (message?.type === 'initApp') {
              rememberInitApp({ app: message.app, form: message.form }, message.id, message.text);
            }
            if (message?.type === 'attendanceDays') noteAttendanceDays(message.month, message.days);
            if (message?.type === 'applyQueue' && startApplyQueue(message.form, message.items)) {
              // 申請して戻ってきたら、この画面（勤務表）を読み直す
              openedChild.current = true;
              othersWritesAtOpen.current = writeCount() - ownWrites.current;
            }
          }}
          onLoadStart={() => {
            // 読み直したら、ダイアログは閉じていて、保存も終わっている（保存の途中なら、切れている）
            setModalOpen(false);
            setWaitingSave(false);
            if (savingRef.current) {
              updateSaving(null);
              if (inBackground.current) completeBackground(false);
              else endSave(routeKey, false);
            }
          }}
          // 読み直したページにも、ほかの画面が保存しているかを伝えておく
          onLoadEnd={() => {
            if (savingElsewhere(routeKey)) webRef.current?.injectJavaScript('window.__myappSaveBusy = true; true;');
          }}
          // 読み込めなかった（電波がない・サーバーにつながらない）。WebView が出す英語の開発者向けの文の代わりに、
          // 分かる言葉と「もう一度読み込む」を出す。取り消された読み込み（次のページへ移ったなど）は失敗ではない
          onError={(e) => {
            e.preventDefault();
            const { code } = e.nativeEvent;
            if (code === NSURL_CANCELLED || code === FRAME_LOAD_INTERRUPTED) return;
            launchingRef.current = false;
            setLaunching(false);
            setFailure(describeLoadError(code));
          }}
          // サーバーが「中で問題が起きた」と答えた（HTTP 500 番台）。4xx は EZCraft が自分の画面で知らせるので、そのまま見せる
          onHttpError={(e) => {
            const status = e.nativeEvent.statusCode;
            // ログインが切れていると、EZCraft はアプリの画面の代わりに「401 Authorization Required」を返す
            if (status === 401) {
              handleExpired();
              return;
            }
            if (status < 500) return;
            launchingRef.current = false;
            setLaunching(false);
            setFailure({
              symbol: 'exclamationmark.icloud',
              title: 'サーバーで問題が起きています',
              message: `少し待ってから、もう一度読み込んでください（HTTP ${status}）。`,
            });
          }}
          // iPhone のメモリが足りなくなると、裏に回したページの中身を iOS が捨てることがある（そのままだと真っ白）。
          // 捨てられたら、読み直す（見ていた位置にも戻す）。重ねた画面の下に隠れているページは、前に出てきたときに読み直す
          // （隠れたまますぐ読み直すと、メモリが足りないところへまた大きなページを読み込み、捨てる・読み直すを繰り返す）。
          // 裏で保存を続けているページは、保存の結果を出すために、すぐ読み直す（onLoadStart が、保存の失敗として片づける）
          onContentProcessDidTerminate={() => {
            if (inBackground.current || navigation.isFocused()) reloadPage();
            else reloadWhenShown.current = true;
          }}
          onOpenWindow={(e) => openWindow(e.nativeEvent.targetUrl)} // target="_blank" のリンクなど
          onNavigationStateChange={(nav) => {
            // ログイン画面に飛ばされた = ログインが切れた
            if (pathOf(nav.url).startsWith('/login')) {
              handleExpired();
              return;
            }
            // ページの名前（「〇〇 - EZCraft」）から、末尾の「 - EZCraft」を外してヘッダーに出す
            const name = (nav.title ?? '').replace(/\s*-\s*EZCraft$/, '');
            if (name && name !== 'EZCraft' && !name.startsWith('http')) setPageTitle(name);
          }}
        />
      </Parkable>
      {/* 置き場へ移したあと（裏で続けている保存）は、上の知らせが進み具合を出すので、ここでは出さない。
          保存の途中でページがダイアログを開いたとき（残業申請の「承認者確認フォーム」など）も出さない。
          ページはダイアログの答え（「申請」など）を待っていて、この知らせはページを押せなくするので、
          出したままだと答えられず、EZCraft が 1 分ほどで保存を取り消すまで「保存しています」のまま止まる（2026-11-21 に測った） */}
      {saving ? (
        !parked &&
        !modalOpen && (
          <SaveProgress
            startedAt={saving.startedAt}
            writes={saving.writes}
            steps={saving.steps}
            size={saving.size}
            backAfter={saving.backAfter}
            onLeave={canLeave ? leaveDuringSave : undefined}
          />
        )
      ) : waitingSave ? (
        <SaveProgress
          startedAt={0}
          writes={0}
          steps={0}
          size={null}
          backAfter={leaveAfterStart}
          waiting="turn"
          onLeave={canLeave ? leaveDuringSave : undefined}
        />
      ) : (
        samePageSaving && <SaveProgress startedAt={0} writes={0} steps={0} size={null} backAfter={false} waiting="samePage" />
      )}
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
      {failure && (
        <View style={[StyleSheet.absoluteFill, styles.failure, { backgroundColor: c.background }]}>
          <SymbolView name={{ ios: failure.symbol, android: 'wifi_off', web: 'wifi_off' }} size={44} tintColor={c.textSecondary} />
          <Text style={[styles.failureTitle, { color: c.text }]} accessibilityRole="header">
            {failure.title}
          </Text>
          <Text style={[styles.failureMessage, { color: c.textSecondary }]}>{failure.message}</Text>
          <GlassButton onPress={reloadPage} accessibilityLabel="もう一度読み込む" style={styles.failureButton}>
            <Text style={[styles.failureButtonText, { color: c.onAccent }]}>もう一度読み込む</Text>
          </GlassButton>
        </View>
      )}
    </>
  );
}

/** ヘルスケアから歩数を読めるか（開発ビルドで、ヘルスケアのある端末） */
const HEALTH = healthAvailable();
/** 給与・賞与明細のアプリケーション ID（パスワードを Face ID で入れる） */
const PAYSLIP_APP = 'L_Payslip';

/** 読み込めなかったときに出すもの */
type LoadFailure = { symbol: 'wifi.slash' | 'exclamationmark.icloud'; title: string; message: string };

// 失敗ではない読み込みの終わり方（iOS の番号）
const NSURL_CANCELLED = -999; // 読み込みを取り消した（次のページへ移った・同じページを読み直した）
const FRAME_LOAD_INTERRUPTED = 102; // ページではなくファイルとして受け取った（PDF など。bridge が受け取る）

/** iOS の読み込みの失敗の番号（NSURLError）を、利用者に分かる言葉にする */
function describeLoadError(code: number): LoadFailure {
  // 電波がない・機内モード・モバイル通信が切られている
  if (code === -1009 || code === -1020 || code === -1018) {
    return {
      symbol: 'wifi.slash',
      title: 'インターネットにつながっていません',
      message: '電波のよい所で、もう一度読み込んでください。',
    };
  }
  if (code === -1001) {
    return {
      symbol: 'exclamationmark.icloud',
      title: 'サーバーの返事がありません',
      message: '時間がかかりすぎたので、止めました。少し待ってから、もう一度読み込んでください。',
    };
  }
  return {
    symbol: 'exclamationmark.icloud',
    title: 'サーバーにつながりません',
    message: '通信が途中で切れたか、サーバーが止まっています。少し待ってから、もう一度読み込んでください。',
  };
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
  failure: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  failureTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  failureMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  failureButton: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
  failureButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});

/** この URL の画面の定義の控え（なければ null） */
function cachedInitApp(uri: string): { app: string; form: string; id: string; text: string } | null {
  const form = initAppFormOfUrl(uri);
  const cached = form ? recallInitApp(form) : null;
  return form && cached ? { ...form, ...cached } : null;
}

