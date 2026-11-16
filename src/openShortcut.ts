// 近道（src/shortcuts.ts）の行き先の画面を開く。マイアプリの近道と、ページからの「その場で申請」（勤怠実績登録の残業など）で使う。
//
//   - メニューの App.data の控えがあれば（src/webview/appDataCache.ts）、行き先の画面を直接開く（速い）
//   - なければ、メニューの画面を裏で開き、ボタンを順に押して行き先へ進む（src/components/EzcraftWebView.tsx）
// sheet なら、いまの画面の上にシートで重ねる（閉じると元の画面に戻る）。prefill は、行き先の画面の入力欄に入れておく値。
import { router } from 'expo-router';

import { SHORTCUTS, type Shortcut } from './shortcuts';
import { appDataKey, recallAppData } from './webview/appDataCache';
import { depositHandoff } from './webview/handoff';

export type OpenOptions = {
  /** シートで重ねる（ふだんは画面を重ねて進む） */
  sheet?: boolean;
  /** 行き先の画面の入力欄に入れておく値（ページの側で window.__myappPrefill として受け取る） */
  prefill?: Record<string, string>;
};

/** EZCraft が開いた画面に付けるのと同じような名前（開いた画面は、この名前で自分あての引数を探す） */
function newWindowName(): string {
  return Date.now().toString(16);
}

function extra(opts: OpenOptions): { prefill?: string } {
  return opts.prefill ? { prefill: JSON.stringify(opts.prefill) } : {};
}

/** 行き先の画面を直接開く。メニューが渡すのと同じもの（App.data・画面の名前・引数）を持たせる */
export function openShortcutDirect(shortcut: Shortcut, appData: string, opts: OpenOptions = {}): void {
  router.push({
    pathname: opts.sheet ? '/sheet/[app]/[form]' : '/run/[app]/[form]',
    params: {
      app: shortcut.app,
      form: shortcut.direct.form,
      title: shortcut.title,
      data: depositHandoff({ appData, name: newWindowName(), params: JSON.stringify(shortcut.direct.params) }),
      ...extra(opts),
    },
  });
}

/** 控えがないとき: メニューを裏で開いて、ボタンを順に押す（このときに控えもできる） */
export function openShortcutThroughMenu(shortcut: Shortcut, opts: OpenOptions = {}): void {
  router.push({
    pathname: opts.sheet ? '/sheet/[app]/[form]' : '/run/[app]/[form]',
    params: {
      app: shortcut.app,
      form: shortcut.form,
      title: shortcut.title,
      auto: shortcut.steps.join(','),
      ready: shortcut.ready,
      label: shortcut.title,
      ...extra(opts),
    },
  });
}

/**
 * ページからの「その場で申請」: 申請の画面（近道にあるもの）を、いまの画面の上にシートで開く。
 * 近道にない画面なら false（何もしない）
 */
export function openApplication(form: string, prefill: Record<string, string>): boolean {
  const shortcut = SHORTCUTS.find((s) => s.direct.form === form);
  if (!shortcut) return false;
  const appData = recallAppData(appDataKey(shortcut.app, shortcut.form));
  if (appData) openShortcutDirect(shortcut, appData, { sheet: true, prefill });
  else openShortcutThroughMenu(shortcut, { sheet: true, prefill });
  return true;
}
