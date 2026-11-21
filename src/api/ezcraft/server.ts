// EZCraft のサーバーだけの決まり（ログイン画面への戻され方と、なりすまし防止の合言葉）。
// 通信そのもの（待ちすぎ・つながらないの扱い）は、どの相手にも使う src/api/http.ts。
import { pathOf } from '../http';

/** リダイレクトをたどった結果、ログイン画面に着いたか（ログインが切れていると、EZCraft はログイン画面へ戻す） */
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
