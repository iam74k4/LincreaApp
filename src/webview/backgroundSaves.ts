// 保存（登録・削除など）を、アプリ全体で1つずつにする。保存の途中で ‹ で戻ったら、その保存を裏で続ける。
//
// ※ 裏で続ける仕組みは、いまは使っていない（src/components/EzcraftWebView.tsx の KEEP_SAVING_IN_BACKGROUND）。
//   iPhone の実機では、見えなくなった WebView のページを iOS が止めてしまい、裏に回した保存が最後まで進まなかった。
//   保存を1つずつにする仕組み（ほかの画面の「登録」を待たせる）は、そのまま使う。
//
// EZCraft の保存は、通信を1つずつ順に送るので 10 秒ほどかかる（src/webview/bridge.ts の SAVE_WATCH_JS）。
// 待たずにほかの画面へ移れるように、保存の途中で戻ったら、その画面を見えないところ（重ねた画面の一番下）に残して、
// 保存を最後まで続けさせる（src/components/EzcraftWebView.tsx）。上には小さな知らせを出す（BackgroundSaveBanner）。
//   - 終わったら: その画面を片づけ、戻った先の画面（勤務表など）のデータを新しくする
//   - 失敗したら: その画面を片づけて（保存は取り消されている）、知らせに理由と「開き直す」を出す。
//     見えないところに置いた画面を前に戻すことはしない（重ねる順を入れ替えると、画面が止まった絵のままになった。2026-11-18）
//
// 保存は、同時に2つ走らせない。EZCraft の勤怠の登録は「月の集計を読んで、書き直す」順に進むので、
// 2つが同時に走ると、あとの方が先の方の集計を上書きして、合計がずれるおそれがある。
// そこで、保存しているあいだは、ほかの画面の「登録」などは押しても待たせて、前の保存が終わってから押す（SAVE_WATCH_JS）。
import { useSyncExternalStore } from 'react';

/** 保存のあと、ページが開こうとした申請（勤怠実績登録の残業申請など）。裏の保存では、知らせのボタンで開く */
export type PendingApply = { form: string; prefill: Record<string, string> };

/** 裏の保存に失敗したとき、同じ画面を開き直すための行き先（Expo Router の pathname と引数） */
export type Reopen = { pathname: string; params: Record<string, string> };

export type SaveStatus = {
  /** 保存している画面（ルートの key） */
  id: string;
  /** 知らせに出す名前（画面の名前） */
  title: string;
  /** 裏で続けているか */
  background: boolean;
  /** 裏に回したときに戻った先の画面（保存が終わったら、ここのデータを新しくする） */
  parentKey: string | null;
  state: 'saving' | 'done' | 'failed';
  /** 「保存しています（3/9）」の文（画面の側で作る） */
  text: string;
  apply: PendingApply | null;
  /** 失敗したときの、ページが出した知らせ（EZCraft のエラーの文。短くしたもの） */
  error: string | null;
  /** 失敗したときに、同じ画面を開き直す行き先 */
  reopen: Reopen | null;
};

type Snapshot = {
  /** いま保存している画面（なければ null）。ほかの画面の保存は、これが終わるまで待たせる */
  current: SaveStatus | null;
  /** 上に出す知らせ（裏で続けている保存と、その結果。結果は少しのあいだだけ出す） */
  banner: SaveStatus | null;
};

let snapshot: Snapshot = { current: null, banner: null };
const listeners = new Set<() => void>();
const doneListeners = new Set<(save: SaveStatus, ok: boolean) => void>();
let bannerTimer: ReturnType<typeof setTimeout> | null = null;

/** 結果の知らせを出しておく長さ（失敗は、開き直すボタンを押せるように長めに） */
const DONE_MS = 4000;
const FAILED_MS = 20000;

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribeSaves(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function savesSnapshot(): Snapshot {
  return snapshot;
}

export function useSaves(): Snapshot {
  return useSyncExternalStore(subscribeSaves, savesSnapshot, savesSnapshot);
}

/** 裏の保存が終わった（ok: うまくいった）ときに呼ぶ。戻った先の画面が、データを新しくするのに使う */
export function onBackgroundSaveDone(listener: (save: SaveStatus, ok: boolean) => void): () => void {
  doneListeners.add(listener);
  return () => doneListeners.delete(listener);
}

/** ほかの画面が保存しているか（id の画面の保存は、待たなくてよい） */
export function savingElsewhere(id: string): boolean {
  return snapshot.current !== null && snapshot.current.id !== id;
}

/** 戻った先の画面（parentKey）が、裏の保存の終わりを待っているか（待っているあいだは、データを新しくしない） */
export function backgroundSavePendingFor(parentKey: string): boolean {
  const current = snapshot.current;
  return current !== null && current.background && current.parentKey === parentKey;
}

export function beginSave(id: string, title: string, text: string): void {
  set({ current: { id, title, background: false, parentKey: null, state: 'saving', text, apply: null, error: null, reopen: null } });
}

export function updateSave(id: string, text: string): void {
  const current = snapshot.current;
  if (!current || current.id !== id || current.text === text) return;
  const next = { ...current, text };
  set({ current: next, banner: current.background ? next : snapshot.banner });
}

/** 保存の途中で戻った。この画面の保存を裏で続ける（parentKey は、戻った先の画面） */
export function moveSaveToBackground(id: string, parentKey: string): void {
  const current = snapshot.current;
  if (!current || current.id !== id) return;
  const next = { ...current, background: true, parentKey };
  if (bannerTimer) clearTimeout(bannerTimer);
  set({ current: next, banner: next });
}

/** 裏の保存のあとに、ページが開こうとした申請を預かる（知らせのボタンで開く） */
export function attachApply(id: string, apply: PendingApply): void {
  const current = snapshot.current;
  if (current?.id === id) set({ current: { ...current, apply } });
  else if (snapshot.banner?.id === id) set({ banner: { ...snapshot.banner, apply } });
}

/** 保存が終わった（前でも裏でも）。裏の保存に失敗したときは、理由と開き直す行き先も渡す */
export function endSave(id: string, ok: boolean, failure: { error: string | null; reopen: Reopen | null } | null = null): void {
  const current = snapshot.current;
  if (!current || current.id !== id) return;
  const ended: SaveStatus = { ...current, state: ok ? 'done' : 'failed', error: failure?.error ?? null, reopen: failure?.reopen ?? null };
  if (!current.background) {
    set({ current: null });
    return;
  }
  if (bannerTimer) clearTimeout(bannerTimer);
  set({ current: null, banner: ended });
  bannerTimer = setTimeout(() => {
    bannerTimer = null;
    if (snapshot.banner?.id === id && snapshot.banner.state !== 'saving') set({ banner: null });
  }, ok ? DONE_MS : FAILED_MS);
  doneListeners.forEach((listener) => listener(ended, ok));
}

/** 知らせを閉じる（ボタンを押したとき） */
export function dismissBanner(): void {
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = null;
  if (snapshot.banner && snapshot.banner.state !== 'saving') set({ banner: null });
}

/** ログアウトしたときなど、すべて忘れる */
export function resetSaves(): void {
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = null;
  set({ current: null, banner: null });
}
