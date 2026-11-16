// サーバーとの通信で、どこからでも使う小さな道具。

/** ログインが切れている（サーバーにログイン画面へ戻された）ときの失敗 */
export class SessionExpiredError extends Error {
  constructor() {
    super('ログインの有効期限が切れました。もう一度ログインしてください。');
  }
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
