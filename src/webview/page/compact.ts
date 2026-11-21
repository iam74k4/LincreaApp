// ページに入れるスクリプトと CSS を、動きを変えずに小さくする（コメントと行頭の空白を除く）。
//
// ページに入れるものは、説明のコメントが多く、TiMS では 700KB 近くある。ページを開くたびに WebView が読み直すので、
// 読む量が減れば、そのぶん早く動き出す。消すのは、まるごとコメントの行・CSS のコメント・行頭の空白・空の行だけ。
// 行の途中のコメント（`x = 1; // 説明`）は消さない（文字の中の「//」（URL など）と見分けがつかないため）。
// 複数行にまたがる文字（テンプレート文字列・行末の \）がないことは、scripts/check-page-scripts.ts で確かめる。

/** JavaScript: まるごとコメントの行と、行頭の空白と、空の行を除く */
export function compactJs(js: string): string {
  return js
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('//'))
    .join('\n');
}

/** CSS: コメント（／* … *／）と、行頭の空白と、空の行を除く */
export function compactCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('\n');
}
