// EZCraft の画面の「定義」（initApp）の控え。画面を開くたびに、同じものを読み直して待たないようにする。
//
// EZCraft の画面は、開くたびに /RunApp/initApp/ から、その画面の定義とプログラム（JavaScript。1MB ほど）を読む。
// 中身は画面ごとに決まっていて、同じログインのあいだは何度読んでも同じ（画面のデータは入っていない。このあと getData で読む）。
// ただし、ログインした人の記録（最後にログインした時刻など）も入っているので、ログインし直すと少し変わる。
// そのため、ログイン・ログアウトのたびに控えを捨てる（forgetInitAppTexts / forgetAllInitApps）。
// そこで:
//   - 一度読んだら、ここに控える。次にその画面を開くときは、ページの読み込みの要求に控えで答える（src/webview/initApp.ts）
//   - よく使う画面は、マイアプリを見ているあいだに裏で読んでおく（prefetchInitApps）。アプリを開いて最初の1回も待たない
//
// 控えはメモリの中だけ（端末には保存しない。アプリを閉じれば消える）。EZCraft の画面が作り直されたときに
// 古いものを使い続けないよう、30 分で捨てる。
// 裏で読む画面の覚え書き（アプリの名前・画面の名前・画面の ID だけ。中身は入れない）は端末に保存する。ログアウトで消す。
import AsyncStorage from '@react-native-async-storage/async-storage';

import { landedOnLogin, serverFetch as fetch } from '../api/http';
import { SERVER_URL } from '../config';

const MAX_AGE_MS = 30 * 60 * 1000; // 30 分
const RECENT_KEY = 'initApp.recent';
const RECENT_MAX = 6; // 覚えておく画面の数
const PREFETCH_MAX = 4; // 裏で読む画面の数（新しく使った順）

/** どの画面の定義か */
export type InitAppForm = { app: string; form: string };
/** 画面の定義を読むのに要るもの（id はページに書かれている画面の ID） */
type RecentForm = InitAppForm & { id: string; usedAt: number };

// id は、ページが読む画面の定義の ID（EZCraft で画面を出し直すと変わる）。控えは、同じ ID の要求にだけ使う
const store = new Map<string, { id: string; text: string; savedAt: number }>();
const keyOf = ({ app, form }: InitAppForm) => `${app}/${form}`;

/** /runapp/<アプリ>/<画面>/ の URL から、どの画面かを取り出す（runapp でなければ null） */
export function initAppFormOfUrl(url: string): InitAppForm | null {
  const match = /\/runapp\/([^/?#]+)\/([^/?#]+)/.exec(url);
  return match ? { app: decodeURIComponent(match[1]), form: decodeURIComponent(match[2]) } : null;
}

/** EZCraft の画面の定義らしいか（ログイン画面やエラーのページを控えないため） */
export function looksLikeInitApp(text: string): boolean {
  return text.length > 1000 && /^\s*\/\*\s*<!\[CDATA\[/.test(text);
}

/** 控えがあれば、その ID と中身（古いものは捨てて null） */
export function recallInitApp(form: InitAppForm): { id: string; text: string } | null {
  const entry = store.get(keyOf(form));
  if (!entry) return null;
  if (Date.now() - entry.savedAt > MAX_AGE_MS) {
    store.delete(keyOf(form));
    return null;
  }
  return { id: entry.id, text: entry.text };
}

/** ページが読んだ画面の定義を控え、次から裏で読む画面として覚えておく */
export function rememberInitApp(form: InitAppForm, id: string, text: string): void {
  if (!looksLikeInitApp(text)) return;
  store.set(keyOf(form), { id, text, savedAt: Date.now() });
  noteRecent({ ...form, id, usedAt: Date.now() });
}

/** ログインしたとき: 控えの中身を捨てる（前のログインの記録が入っているため）。裏で読む画面の覚え書きは残す */
export function forgetInitAppTexts(): void {
  store.clear();
}

/** ログアウトしたとき: 控えも覚え書きも捨てる */
export function forgetAllInitApps(): void {
  store.clear();
  AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
}

async function readRecent(): Promise<RecentForm[]> {
  try {
    const list = JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) ?? '[]') as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (f): f is RecentForm =>
        f && typeof f.app === 'string' && typeof f.form === 'string' && typeof f.id === 'string' && typeof f.usedAt === 'number',
    );
  } catch {
    return [];
  }
}

function noteRecent(entry: RecentForm): void {
  readRecent()
    .then((list) => {
      const rest = list.filter((f) => keyOf(f) !== keyOf(entry));
      return AsyncStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...rest].slice(0, RECENT_MAX)));
    })
    .catch(() => {});
}

let running: Promise<void> | null = null;

/**
 * よく使う画面の定義を、裏で1つずつ読んでおく（まだ控えがないものだけ）。
 * 失敗しても何もしない（そのときは、ページがふつうに読む）
 */
export function prefetchInitApps(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const list = (await readRecent()).sort((a, b) => b.usedAt - a.usedAt).slice(0, PREFETCH_MAX);
    for (const f of list) {
      if (recallInitApp(f)?.id === f.id) continue;
      try {
        const query = `appid=${encodeURIComponent(f.app)}&formid=${encodeURIComponent(f.form)}&id=${encodeURIComponent(f.id)}&_=${Date.now()}`;
        // ページ（jQuery）と同じ頼み方にする
        const res = await fetch(`${SERVER_URL}/RunApp/initApp/?${query}`, {
          credentials: 'include',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
          },
        });
        if (!res.ok || landedOnLogin(res)) return; // ログインが切れているなど。続けても同じなのでやめる
        const text = await res.text();
        if (looksLikeInitApp(text)) store.set(keyOf(f), { id: f.id, text, savedAt: Date.now() });
      } catch {
        return; // 通信できない。次の機会に
      }
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
