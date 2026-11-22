// 保存（登録・削除など）を、アプリ全体で1つずつにする。保存の途中で ‹ で戻ったら、その保存を裏で続ける。
//
// EZCraft の保存は、通信を1つずつ順に送るので 10 秒ほどかかる（src/webview/page/bridgeJs.ts の SAVE_WATCH_JS）。
// 待たずにほかの画面へ移れるように、保存の途中で戻ったら、その画面を重ねた画面の一番下に残し、
// ページは画面の後ろの置き場へ移して、保存を最後まで続けさせる（src/components/EzcraftWebView/EzcraftWebView.tsx。
// なぜ置き場が要るか・使えないときは src/components/SavePark.tsx）。上には小さな知らせを出す（BackgroundSaveBanner）。
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
  /** 押したボタン（「登録」「削除」など）。戻った先の画面が、Web 版と同じ「閉じたあとの処理」を呼ぶのに使う */
  label: string;
  /** どのページの保存か（画面の URL と、開いた元が渡した引数。勤怠実績登録なら、どの日か）。分からなければ null */
  pageKey: string | null;
  /** 裏で続けているか */
  background: boolean;
  /** 裏に回したときに戻った先の画面（保存が終わったら、ここのデータを新しくする） */
  parentKey: string | null;
  /**
   * 戻った先の画面が、どのページか（画面の URL と、開いた元が渡した引数。noteScreenPage で画面が知らせたもの）。分からなければ null。
   * 戻った先の画面を閉じて、同じページを開き直していたら、その画面も新しくする（保存の途中に読んだので、保存の前のデータかもしれない）
   */
  parentPage: string | null;
  /** 保存を始めた時刻 */
  startedAt: number;
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
/** 開いている画面（ルートの key）が、どのページか（noteScreenPage） */
const screenPages = new Map<string, string>();
/** 見えている画面の保存が終わるのを待って開く画面（afterForegroundSave） */
let waiting: (() => void)[] = [];
let waitingTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * 見えている画面の保存が終わって（または裏に回って）から、待たせていた画面を開くまでの間。
 * 終わってすぐは、保存したページが自分で閉じる（form.close）・裏に回した画面の入れ替えが済んでいないので、それを待つ
 */
const AFTER_FOREGROUND_SAVE_MS = 1000;
const listeners = new Set<() => void>();
const doneListeners = new Set<(save: SaveStatus, ok: boolean) => void>();
let bannerTimer: ReturnType<typeof setTimeout> | null = null;

/** 結果の知らせを出しておく長さ（失敗は、開き直すボタンを押せるように長めに） */
const DONE_MS = 4000;
const FAILED_MS = 20000;

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
  flushWaiting();
}

/** 見えている画面の保存が終わっていれば、少し待ってから、待たせていた画面を順に開く */
function flushWaiting(): void {
  if (waiting.length === 0 || waitingTimer || savingInForeground()) return;
  waitingTimer = setTimeout(() => {
    waitingTimer = null;
    // 待っているあいだに、また見えている画面で保存が始まった: その保存が終わってから
    if (savingInForeground()) return;
    const runs = waiting;
    waiting = [];
    runs.forEach((run) => run());
  }, AFTER_FOREGROUND_SAVE_MS);
}

/** 画面が、どのページかを知らせる（裏の保存の戻った先と見比べるため）。画面を閉じたら、戻り値を呼ぶ */
export function noteScreenPage(routeKey: string, page: string): () => void {
  screenPages.set(routeKey, page);
  return () => {
    if (screenPages.get(routeKey) === page) screenPages.delete(routeKey);
  };
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

/**
 * 見えている画面で保存しているか。そのあいだに、その画面の上にほかの画面を重ねると、iOS が隠れたページを止めて、
 * 保存が途中で切れる（src/components/SavePark.tsx）。アプリが自分で画面を開くとき（知らせのボタン・通知）は、終わるまで待つ
 */
export function savingInForeground(): boolean {
  const current = snapshot.current;
  return current !== null && !current.background;
}

/**
 * 見えている画面の保存が終わってから run する（保存していなければ、すぐ）。待つのをやめるときは、戻り値を呼ぶ。
 * ログアウトしたら（resetSaves）、待っていたものは開かない
 */
export function afterForegroundSave(run: () => void): () => void {
  if (!savingInForeground() && waiting.length === 0) {
    run();
    return () => {};
  }
  waiting.push(run);
  flushWaiting();
  return () => {
    waiting = waiting.filter((r) => r !== run);
  };
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

export function beginSave(id: string, title: string, text: string, label: string, pageKey: string | null): void {
  const current = snapshot.current;
  // 裏で続けている画面が、続けてもう1回保存を始めた（2回に分けて確定するフォームなど）。裏のまま続ける
  // （前に出ていることにすると、終わったときに戻った先の画面に知らせず、上の知らせも「保存しています」のまま残る）
  const keep = current?.id === id && current.background;
  const next: SaveStatus = {
    id,
    title,
    label,
    pageKey,
    background: keep,
    parentKey: keep ? current.parentKey : null,
    parentPage: keep ? current.parentPage : null,
    startedAt: keep ? current.startedAt : Date.now(),
    state: 'saving',
    text,
    apply: null,
    error: null,
    reopen: null,
  };
  set(keep ? { current: next, banner: next } : { current: next });
}

/**
 * 同じページ（同じ日の勤怠実績登録など）を、ほかの画面が裏で保存しているか（id の画面のは数えない）。
 * そのあいだに開いた画面は、保存する前の中身を見せているので、終わってから開き直す（src/components/EzcraftWebView/EzcraftWebView.tsx）
 */
export function savingSamePage(pageKey: string | null, id: string): boolean {
  const current = snapshot.current;
  return pageKey !== null && current !== null && current.background && current.pageKey === pageKey && current.id !== id;
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
  const next = { ...current, background: true, parentKey, parentPage: screenPages.get(parentKey) ?? null };
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
  // 待たせていた画面は開かない（ログアウトした。前の人の画面・入れておく値を、あとから開かない）
  waiting = [];
  if (waitingTimer) clearTimeout(waitingTimer);
  waitingTimer = null;
  set({ current: null, banner: null });
}
