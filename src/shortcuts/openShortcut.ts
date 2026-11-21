// 近道（src/shortcuts/shortcuts.ts）の行き先の画面を開く。マイアプリの近道と、ページからの「その場で申請」（勤怠実績登録の残業など）で使う。
//
//   - メニューの App.data の控えがあれば（src/webview/appDataCache.ts）、行き先の画面を直接開く（速い）
//   - なければ、メニューの画面を裏で開き、ボタンを順に押して行き先へ進む（src/components/EzcraftWebView/EzcraftWebView.tsx）
// sheet なら、いまの画面の上にシートで重ねる（閉じると元の画面に戻る）。prefill は、行き先の画面の入力欄に入れておく値。
//
// まとめて申請（勤務表の「残業をまとめて申請」）: 申請の画面を1件ずつ続けて開く。ページで「申請」して画面が閉じたら、
// 次の1件を開く（src/components/EzcraftWebView/EzcraftWebView.tsx の close）。申請は使う人が押す。途中で × で閉じたり、
// ほかの申請や近道を開いたり、しばらく（10 分）置いたりしたら、残りはやめる。
import { router } from 'expo-router';

import { depositLaunch } from './launch';
import { SHORTCUTS, type Shortcut } from './shortcuts';
import { appDataKey, recallAppData } from '../webview/appDataCache';
import { depositHandoff } from '../webview/handoff';

export type OpenOptions = {
  /** シートで重ねる（ふだんは画面を重ねて進む） */
  sheet?: boolean;
  /** 行き先の画面の入力欄に入れておく値（ページの側で window.__myappPrefill として受け取る） */
  prefill?: Record<string, string>;
  /** 上のヘッダーに出す名前（ふだんは近道の名前） */
  title?: string;
  /** まとめて申請の続きとして開く（そうでなければ、残っているまとめて申請はやめる） */
  fromQueue?: boolean;
};

type ApplyQueue = { form: string; items: Record<string, string>[]; total: number; done: number; at: number };
let queue: ApplyQueue | null = null;
const QUEUE_IDLE_MS = 10 * 60 * 1000;

/** まとめて申請を始める（1件目を開く）。開けなければ false */
export function startApplyQueue(form: string, items: Record<string, string>[]): boolean {
  if (items.length === 0) return false;
  queue = { form, items: items.slice(1), total: items.length, done: 0, at: Date.now() };
  return openQueued(items[0]);
}

/** まとめて申請の途中か（1件を申請して画面が閉じたときに、次を開くため） */
export function applyQueueActive(): boolean {
  if (queue && Date.now() - queue.at > QUEUE_IDLE_MS) queue = null;
  return queue !== null;
}

/** 次の1件を開く。もうなければ終わりにして false */
export function advanceApplyQueue(): boolean {
  if (!applyQueueActive() || !queue) return false;
  queue.done += 1;
  queue.at = Date.now();
  const next = queue.items.shift();
  if (!next) {
    queue = null;
    return false;
  }
  return openQueued(next);
}

/** まとめて申請をやめる（× で閉じたときなど） */
export function stopApplyQueue(): void {
  queue = null;
}

function openQueued(prefill: Record<string, string>): boolean {
  if (!queue) return false;
  const shortcut = SHORTCUTS.find((s) => s.direct.form === queue?.form);
  const title = shortcut ? `${shortcut.title}（${queue.done + 1}/${queue.total}）` : undefined;
  return openApplication(queue.form, prefill, { title, fromQueue: true });
}

/** EZCraft が開いた画面に付けるのと同じような名前（開いた画面は、この名前で自分あての引数を探す） */
function newWindowName(): string {
  return Date.now().toString(16);
}

function stopQueueUnlessContinuing(opts: OpenOptions): void {
  if (!opts.fromQueue) stopApplyQueue(); // ほかの画面を開いたら、まとめて申請の残りはやめる
}

/** 行き先の画面を直接開く。メニューが渡すのと同じもの（App.data・画面の名前・引数）を持たせる */
export function openShortcutDirect(shortcut: Shortcut, appData: string, opts: OpenOptions = {}): void {
  stopQueueUnlessContinuing(opts);
  router.push({
    pathname: opts.sheet ? '/sheet/[app]/[form]' : '/run/[app]/[form]',
    params: {
      app: shortcut.app,
      form: shortcut.direct.form,
      title: opts.title ?? shortcut.title,
      data: depositHandoff({ appData, name: newWindowName(), params: JSON.stringify(shortcut.direct.params) }),
      // 入れておく値は、引数（URL）に書かずに預けて番号だけ渡す（src/shortcuts/launch.ts）
      ...(opts.prefill ? { launch: depositLaunch({ prefill: opts.prefill }) } : {}),
    },
  });
}

/** 控えがないとき: メニューを裏で開いて、ボタンを順に押す（このときに控えもできる） */
export function openShortcutThroughMenu(shortcut: Shortcut, opts: OpenOptions = {}): void {
  stopQueueUnlessContinuing(opts);
  router.push({
    pathname: opts.sheet ? '/sheet/[app]/[form]' : '/run/[app]/[form]',
    params: {
      app: shortcut.app,
      form: shortcut.form,
      title: opts.title ?? shortcut.title,
      // 順に押すボタンと入れておく値は、引数（URL）に書かずに預けて番号だけ渡す（src/shortcuts/launch.ts）
      launch: depositLaunch({ steps: shortcut.steps, ready: shortcut.ready, label: shortcut.title, prefill: opts.prefill }),
    },
  });
}

/** 近道を開く（メニューの App.data の控えがあれば直接、なければメニューを裏で開いて進む） */
export function openShortcut(shortcut: Shortcut, opts: OpenOptions = {}): void {
  const appData = recallAppData(appDataKey(shortcut.app, shortcut.form));
  if (appData) openShortcutDirect(shortcut, appData, opts);
  else openShortcutThroughMenu(shortcut, opts);
}

/**
 * ページからの「その場で申請」: 申請の画面（近道にあるもの）を、いまの画面の上にシートで開く。
 * 近道にない画面なら false（何もしない）
 */
export function openApplication(form: string, prefill: Record<string, string>, opts: Omit<OpenOptions, 'sheet' | 'prefill'> = {}): boolean {
  const shortcut = SHORTCUTS.find((s) => s.direct.form === form);
  if (!shortcut) {
    if (!opts.fromQueue) stopApplyQueue();
    return false;
  }
  openShortcut(shortcut, { ...opts, sheet: true, prefill });
  return true;
}
