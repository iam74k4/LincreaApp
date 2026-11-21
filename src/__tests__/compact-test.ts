// ページに入れるスクリプトと CSS を小さくする（src/webview/page/compact.ts）。動きを変えずに、コメントと空白だけを除くこと。
import { compactCss, compactJs } from '../webview/page/compact';

test('JavaScript: まるごとコメントの行・行頭の空白・空の行を除く', () => {
  const js = `
(function () {
  // 説明のコメント
  var a = 1;

    var b = 'https://example.com/x'; // 行の途中のコメントは残す
})();
`;
  expect(compactJs(js)).toBe("(function () {\nvar a = 1;\nvar b = 'https://example.com/x'; // 行の途中のコメントは残す\n})();");
  // 動きは同じ
  expect(new Function(`${compactJs('return (function () {\n  // x\n  return 1 + 2;\n})();')}`)()).toBe(3);
});

test('JavaScript: 正規表現や文字の中の // は消さない', () => {
  const js = "var re = /a\\/\\/b/;\nvar url = 'https://x.example/';";
  expect(compactJs(js)).toBe(js);
});

test('CSS: コメント（複数行も）・行頭の空白・空の行を除く', () => {
  const css = `
/* 見出し
   2 行目 */
.a {
  color: red; /* 行の途中 */
}

.b::before { content: 'x  y'; }
`;
  expect(compactCss(css)).toBe(".a {\ncolor: red;\n}\n.b::before { content: 'x  y'; }");
});
