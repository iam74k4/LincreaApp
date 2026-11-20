// サーバーとの通信で、どこからでも使う小さな道具。
import { fetch as expoFetch } from 'expo/fetch';

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

/** 返事を待つ長さ（ふつう）。iOS の通信の決まりの 60 秒は、起動やログアウトで待たせるには長すぎる */
export const DEFAULT_TIMEOUT_MS = 20_000;

type FetchInit = NonNullable<Parameters<typeof expoFetch>[1]>;

/**
 * サーバーに頼む（expo/fetch と同じ使い方）。待ちすぎたら TimeoutError、つながらなければ NetworkError にする
 * （通信の仕組みが出す英語の文「Network request failed」などを、そのまま画面に出さないように）
 */
export async function serverFetch(url: string, init: FetchInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await expoFetch(url, { ...init, signal: controller.signal });
  } catch {
    if (controller.signal.aborted) throw new TimeoutError();
    throw new NetworkError();
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

/** リダイレクトをたどった結果、ログイン画面に着いたか */
export function landedOnLogin(res: { url: string }): boolean {
  return pathOf(res.url).startsWith('/login');
}

// ---- なりすまし防止の合言葉（CSRF トークン） ----
// Web 版は、/main/ のページの <html _t="..."> の値を、書き込み・一覧の問い合わせのヘッダーに付ける。
// 値はログインのあいだ同じなので、/main/ を読んだついでに覚えておき、問い合わせのたびに /main/ を読み直さない
// （起動の確かめ・ログインの最後の段で /main/ を読んでいる）。ログイン・ログアウトで忘れる。
let csrfToken: string | null = null;

/** /main/ のページの HTML から、合言葉を読む（なければ null） */
export function csrfOf(html: string): string | null {
  return html.match(/<html[^>]*\s_t="([^"]+)"/)?.[1] ?? null;
}

/** /main/ を読んだときに、合言葉を覚えておく */
export function rememberCsrf(html: string): void {
  const token = csrfOf(html);
  if (token) csrfToken = token;
}

/** 覚えている合言葉（なければ null） */
export function recallCsrf(): string | null {
  return csrfToken;
}

/** 合言葉を忘れる（ログイン・ログアウトしたとき。使って断られたとき） */
export function forgetCsrf(): void {
  csrfToken = null;
}
