// ページがデータを書き込んだ回数（アプリ全体で1つ）。
// 別の画面を重ねて開き、戻ってきたとき、その間に書き込みがあったときだけ、元の画面を読み直すために使う
// （何も変えずに戻ったときに読み直すと、1画面ぶん（数秒）待たされるため）。
// 書き込みは、ページが知らせてくる（src/webview/bridge.ts の 5）。
let count = 0;

export function noteWrite(): void {
  count += 1;
}

export function writeCount(): number {
  return count;
}
