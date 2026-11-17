// ページがデータを書き込んだ回数（アプリ全体で1つ）。
// 別の画面を重ねて開き、戻ってきたとき、その間に書き込みがあったときだけ、元の画面を読み直すために使う
// （何も変えずに戻ったときに読み直すと、1画面ぶん（数秒）待たされるため）。
// 書き込みは、ページが知らせてくる（src/webview/bridge.ts の 5）。
let count = 0;

// 重ねて開いた画面が、最後に押した書き込みのボタン（「登録」「削除」など）と、その画面がページの側から閉じたか
// （EZCraft は、登録が終わると form.close('登録') で画面を閉じる）。元の画面は、これを見て、
// ページを丸ごと読み直さずに、Web 版と同じく「閉じたあとの処理」（データだけ読み直す）を走らせる（EzcraftWebView）
let lastLabel = '';
let closedByPage = false;

export function noteWrite(label = ''): void {
  count += 1;
  if (label) lastLabel = label;
}

export function writeCount(): number {
  return count;
}

/** 重ねて開いた画面が、ページの側から閉じた（登録などが終わった） */
export function noteClosedByPage(): void {
  closedByPage = true;
}

/** 重ねて開いた画面の結果を受け取る（1回だけ。受け取ったら消す） */
export function takeChildResult(): { label: string; closedByPage: boolean } {
  const result = { label: lastLabel, closedByPage };
  lastLabel = '';
  closedByPage = false;
  return result;
}
