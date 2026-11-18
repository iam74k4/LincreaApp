// 保存（登録・削除など）に失敗したときに、上の知らせに出す文（src/components/BackgroundSaveBanner.tsx）。
//
// EZCraft が出すエラーの文は、データベースの英語のまま（例: 「delete error× Lock wait timeout exceeded; try restarting
// transaction (rowIndex : 1)」）で、使う人には分からない。よく起きるものは、何が起きて、どうすればよいかの言葉に置き換える。
// 知らない文は、短くしてそのまま見せる（何が起きたかを、あとで調べられるように）。
// どの場合も、保存は取り消されている（EZCraft が rollBack する。src/webview/bridge.ts の SAVE_WATCH_JS）。

/** 失敗したときの知らせの、理由と、どうすればよいか */
export type SaveFailure = { reason: string; next: string };

const AGAIN = '開き直して、入力し直してください。';

/** エラーの文の、知らせに出さない部分を落とす（EZCraft のメッセージの「×」（閉じるボタン）や、余分な空白） */
function clean(raw: string): string {
  return raw
    .replace(/[×✕✖]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function describeSaveFailure(raw: string | null): SaveFailure {
  const text = clean(raw ?? '');
  // ほかの保存（前に途中で切れた保存など）が、サーバーで同じデータをつかんだままになっていて、待ちきれなかった
  if (/lock wait timeout|deadlock/i.test(text)) {
    return {
      reason: 'ほかの保存と重なって、待ちきれませんでした。',
      next: '数分待ってから、開き直して入力してください。',
    };
  }
  if (/time ?out|timed out|network|通信/i.test(text)) {
    return { reason: '通信がうまくいきませんでした。', next: '電波のよい所で、開き直して入力してください。' };
  }
  if (!text) return { reason: '保存は取り消されました。', next: AGAIN };
  return { reason: text.length > 80 ? `${text.slice(0, 80)}…` : text, next: AGAIN };
}
