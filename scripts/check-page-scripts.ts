// ページに入れるスクリプト（WebView の中で動く JavaScript）が、正しく書けているかを確かめる道具。
//
//   npx tsx scripts/check-page-scripts.ts
//
// ページに入れるスクリプトは、TypeScript のテンプレート文字列（`...`）の中に書いてある。
// その中の正規表現は「\\d」のように \ を2つ書かないと、できあがったスクリプトでは「d」になってしまい、
// 文法の誤りでスクリプト全体が動かない（画面がパソコン向けのまま出る）か、正規表現が黙って別のものになる。
// 型チェックや lint では見つからないので、ここで確かめる:
//   1. どのアプリのスクリプトも、JavaScript として読めること
//   2. \ が落ちた形（/(d{4})/ や /^s*/ など）が残っていないこと
import { APP_SKINS } from '../src/webview/appStyles';
import { bootJs, buildSkinScript } from '../src/webview/ezcraftSkin';
import { BRIDGE_JS } from '../src/webview/bridge';
import { initAppJs } from '../src/webview/initApp';

// \ が落ちた正規表現によくある形（前の文字が \ でない d{ や s* など）
const LOST_ESCAPE = /[^\\a-zA-Z](?:d\{\d|d\+\)|s\*\[|d日)|\|d\+\)|\^d\{|\^s\*|\(d\{|[^\\]s\*\$|[^\\]s\+\/|\[s\]/g;

const scripts: [string, string][] = [
  ...[...Object.keys(APP_SKINS), '(アプリごとの調整なし)'].map((id): [string, string] => [`skin ${id}`, buildSkinScript(id)]),
  ['bridge', BRIDGE_JS],
  ['boot', bootJs('#ffffff')],
  ['initApp', initAppJs(null)],
];

let failed = 0;
for (const [name, js] of scripts) {
  try {
    new Function(js);
  } catch (e) {
    failed++;
    console.log(`NG ${name}: 読めない（${String(e)}）`);
    continue;
  }
  const lost = js.match(LOST_ESCAPE);
  if (lost) {
    failed++;
    console.log(`NG ${name}: \\ が落ちた正規表現らしいもの: ${lost.slice(0, 5).join(' / ')}`);
  }
}
console.log(failed ? `${failed} 件の問題があります` : `OK（${scripts.length} 本のスクリプト）`);
process.exit(failed ? 1 : 0);
