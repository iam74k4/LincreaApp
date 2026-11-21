// 保存（登録・削除など）に失敗したときに、上の知らせに出す文（src/components/BackgroundSaveBanner.tsx）。
//
// EZCraft が出すエラーの文は、データベースの英語のまま（例: 「delete error× Lock wait timeout exceeded; try restarting
// transaction (rowIndex : 1)」）で、使う人には分からない。よく起きるものは、何が起きて、どうすればよいかの言葉に置き換える。
// 知らない文は、短くしてそのまま見せる（何が起きたかを、あとで調べられるように）。
// ページが失敗を知らせてきたときは、保存は取り消されている（EZCraft が rollBack する。src/webview/page/bridgeJs.ts の SAVE_WATCH_JS）。
// 結果が分からないまま終わったとき（SAVE_OUTCOME_UNKNOWN）だけは、取り消されたとは言い切れない。

/** 失敗したときの知らせの、理由と、どうすればよいか */
export type SaveFailure = { reason: string; next: string };

const AGAIN = '開き直して、入力し直してください。';

/**
 * 保存の結果が分からないまま終わった（返事が止まった・ページが読み直された・中身を OS に捨てられた）ときに、エラーの文の代わりに渡す印。
 * 確定（commit）まで届いていたかもしれないので、「取り消されました」とは言わない（入力し直すと、申請が2回になりうる）
 */
export const SAVE_OUTCOME_UNKNOWN = '\u0000outcome-unknown';

/** エラーの文の、知らせに出さない部分を落とす（EZCraft のメッセージの「×」（閉じるボタン）や、余分な空白） */
function clean(raw: string): string {
  return raw
    .replace(/[×✕✖]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function describeSaveFailure(raw: string | null): SaveFailure {
  if (raw === SAVE_OUTCOME_UNKNOWN) {
    return {
      reason: '保存できたかどうか、分かりませんでした（サーバーの返事が途中で止まりました）。',
      next: '開き直して、登録されているかを確かめてから、必要なら入力し直してください。',
    };
  }
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
