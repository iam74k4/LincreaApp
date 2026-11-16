// 近道で、メニューの画面を飛ばして目的の画面を直接開くための、App.data の控え。
//
// EZCraft の画面は、開いた元の画面の App.data（ログインした人・部署・休日など）を受け取って動く。
// 近道は、そのためだけに見えないところでメニューの画面を読み込んでいた（1画面ぶん、数秒かかる）。
// メニューの画面が一度 App.data を渡したら、ここに控えておき、次からはメニューを開かずに目的の画面を開く。
//
// 控えはメモリの中だけ（保存しない。アプリを閉じれば消える。ログアウトでも消す）。
// App.data には「今日」の日付も入っているので、日が変わったら、また古くなりすぎたら使わない。
import { useSyncExternalStore } from 'react';

const MAX_AGE_MS = 60 * 60 * 1000; // 1時間

type Entry = { appData: string; savedAt: number; day: string };

const store = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;

const today = () => new Date().toDateString();
const changed = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

/** 控えの名前: どのアプリのどの画面が渡した App.data か（例: L_Tims/frmLTiMSTop） */
export function appDataKey(app: string, form: string): string {
  return `${app}/${form}`;
}

/** /runapp/<アプリ>/<画面>/ の URL から、控えの名前を作る（runapp でなければ null） */
export function appDataKeyOfUrl(url: string): string | null {
  const match = /\/runapp\/([^/?#]+)\/([^/?#]+)/.exec(url);
  return match ? appDataKey(decodeURIComponent(match[1]), decodeURIComponent(match[2])) : null;
}

export function rememberAppData(key: string, appData: string): void {
  store.set(key, { appData, savedAt: Date.now(), day: today() });
  changed();
}

/** 使える控え（同じ日で、古すぎないもの）。なければ null */
export function recallAppData(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.day !== today() || Date.now() - entry.savedAt > MAX_AGE_MS) {
    store.delete(key);
    return null;
  }
  return entry.appData;
}

/** ログアウトしたときなどに、すべて捨てる */
export function forgetAllAppData(): void {
  if (store.size === 0) return;
  store.clear();
  changed();
}

/** 控えが変わったら描き直すためのフック（中身ではなく「変わった回数」を返す） */
export function useAppDataVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
}
