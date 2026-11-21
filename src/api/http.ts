// 外部の API との通信で、どの相手にも使う小さな道具（待ちすぎ・つながらないの扱い、失敗の文）。
// 相手ごとの決まり（ログイン画面への戻され方・合言葉など）は、相手ごとのフォルダに置く（EZCraft は src/api/ezcraft/）。
import { fetch as expoFetch } from 'expo/fetch';

import { clockOf } from '../core/clock';

/** ログインが切れている（サーバーにログイン画面へ戻された）ときの失敗 */
export class SessionExpiredError extends Error {
  constructor() {
    super('ログインの有効期限が切れました。もう一度ログインしてください。');
  }
}

/** サーバーにつながらなかった（電波がない・機内モード・サーバーが止まっている）。message をそのまま画面に出してよい */
export class NetworkError extends Error {
  constructor(message = 'サーバーにつながりませんでした。電波のよい所で、もう一度お試しください。') {
    super(message);
  }
}

/** サーバーの返事が、待てる長さのうちに来なかった */
export class TimeoutError extends NetworkError {
  constructor() {
    super('サーバーの返事がありません。少し待ってから、もう一度お試しください。');
  }
}

/** 呼んだ側が止めた（init.signal）。画面に出すものではない */
export class CanceledError extends Error {
  constructor() {
    super('止めました');
  }
}

/** 返事を待つ長さ（ふつう）。iOS の通信の決まりの 60 秒は、起動やログアウトで待たせるには長すぎる */
const DEFAULT_TIMEOUT_MS = 20_000;

type FetchInit = NonNullable<Parameters<typeof expoFetch>[1]>;

/**
 * サーバーに頼む（expo/fetch と同じ使い方）。待ちすぎたら TimeoutError、つながらなければ NetworkError にする
 * （通信の仕組みが出す英語の文「Network request failed」などを、そのまま画面に出さないように）
 */
export async function serverFetch(url: string, init: FetchInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // 呼んだ側が止めたとき（init.signal）も止める。待ちすぎたときの止め方と同じ仕組みにまとめる
  const outer = init.signal ?? null;
  const stop = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener('abort', stop);
  const at = Date.now();
  try {
    const res = await expoFetch(url, { ...init, signal: controller.signal });
    // 開発中だけ: アプリが自分でする通信も、ページの通信（[通信]）と同じ形で出す（保存の遅さを調べるため）
    if (__DEV__) console.log(`[通信:アプリ] ${clockOf(at)} ${((Date.now() - at) / 1000).toFixed(2)}秒 ${init.method ?? 'GET'} ${pathOf(url)} ${res.status}`);
    return res;
  } catch {
    outer?.removeEventListener('abort', stop);
    if (outer?.aborted) throw new CanceledError();
    if (controller.signal.aborted) throw new TimeoutError();
    throw new NetworkError();
  } finally {
    // 待ち時間は、返事の頭が届くまで（本文は textWithin で待つ長さを決める）。
    // 呼んだ側が止めたら、本文の受け取りも止める（返事の頭が届いたあとも、止める仕組みは外さない）
    clearTimeout(timer);
  }
}

/**
 * 返事の中身（本文）を読む。待ちすぎたら TimeoutError、途中で切れたら NetworkError。
 * serverFetch の待ち時間は、返事の頭（ステータスとヘッダー）が届くまでなので、本文が届かないまま待たされないように使う
 */
export async function textWithin(res: { text(): Promise<string> }, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([
      res.text().catch((e: unknown) => {
        throw e instanceof NetworkError ? e : new NetworkError();
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** 失敗を、画面に出せる日本語の文にする（通信の仕組みの英語の文は、分かる言葉に置き換える） */
export function describeError(e: unknown): string {
  if (e instanceof NetworkError || e instanceof SessionExpiredError) return e.message;
  const message = e instanceof Error ? e.message : String(e);
  if (/network|internet|offline|timed? ?out|failed to fetch|connection|abort/i.test(message)) return new NetworkError().message;
  // 日本語の文は、このアプリが作ったもの（そのまま出す）。それ以外の英語の文は、中身を出さずに言い換える
  if (!/[぀-ヿ一-鿿]/.test(message)) return 'うまく読み込めませんでした。少し待ってから、もう一度お試しください。';
  return message;
}

/** URL からパスだけを取り出す（クエリにはトークンが入りうるので、ログには出さない） */
export function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '(不明)';
  }
}

