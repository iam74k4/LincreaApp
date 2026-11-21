// ページに入れるスクリプト（WebView の中で動く JavaScript）が、正しく書けているかを確かめる道具。
//
//   npm run check:pages
//
// ページに入れるスクリプトは、TypeScript のテンプレート文字列（`...`）の中に書いてある。
// その中の正規表現は「\\d」のように \ を2つ書かないと、できあがったスクリプトでは「d」になってしまい、
// 文法の誤りでスクリプト全体が動かない（画面がパソコン向けのまま出る）か、正規表現が黙って別のものになる。
// 型チェックでは見つからないので、ここで確かめる（\ が1つだけのものは、lint の no-useless-escape でも見つける。eslint.config.js）:
//   1. どのスクリプトも、JavaScript として読めること（その場で作るもの・WebView に実際に入れる形につないだものも）
//   2. \ が落ちた形（/(d{4})/ や /^s*/ など）が残っていないこと
//   3. アプリごとの見た目の直しを、空のページ（jsdom）で動かしても、最初の一歩でエラーにならないこと
//   4. スクリプトの中の CSS の { と } の数が合っていること（1つ欠けると、そのあとの決まりがすべて効かなくなる）
//   5. 複数行にまたがる文字（` や行末の \）がないこと（小さくするとき、行頭の空白を消すため。src/webview/compact.ts）
import { JSDOM, VirtualConsole } from 'jsdom';

import { APP_SKINS } from '../src/webview/appStyles';
import { bootJs, buildSkinScript, SHOW_PAGE_JS } from '../src/webview/ezcraftSkin';
import {
  autoClickJs,
  BRIDGE_JS,
  childClosedJs,
  healthFlagJs,
  joinScripts,
  NET_TRACE_JS,
  openerStubJs,
  prefillJs,
  restoreScrollJs,
  safeAreaJs,
  SAVE_WATCH_JS,
  stepsReplyJs,
} from '../src/webview/bridge';
import { initAppJs, refModeJs } from '../src/webview/initApp';

// \ が落ちた正規表現によくある形（前の文字が \ でない d{ や s* など）
const LOST_ESCAPE = /[^\\a-zA-Z](?:d\{\d|d\+\)|s\*\[|d日)|\|d\+\)|\^d\{|\^s\*|\(d\{|[^\\]s\*\$|[^\\]s\+\/|\[s\]/g;

const apps = [...Object.keys(APP_SKINS), ''];
const handoff = { appData: '{"LOGIN_USER":{"name":"テスト"}}', name: 'w1', params: '{"date":"2026/11/19"}' };
const position = { y: 120, target: '#frm_grid' };

const scripts: [string, string][] = [
  ...apps.map((id): [string, string] => [`skin ${id || '(アプリごとの調整なし)'}`, buildSkinScript(id)]),
  ['bridge', BRIDGE_JS],
  ['save-watch', SAVE_WATCH_JS],
  ['net-trace', NET_TRACE_JS],
  ['boot', bootJs('#ffffff')],
  ['show-page', SHOW_PAGE_JS],
  ['initApp（控えなし）', initAppJs(null)],
  ['refMode（控えなし）', refModeJs({})],
  ['refMode（控えあり）', refModeJs({ 'POST appId=L_Tims': { text: '{"refMode":"0"}', type: 'application/json; charset=utf-8' } })],
  ['initApp（控えあり）', initAppJs({ app: 'L_Tims', form: 'frmAttendance', id: 'abc=', text: '/*<![CDATA[*/ var x = "</script> "; /*]]>*/' })],
  ['opener', openerStubJs(handoff)],
  ['autoClick', autoClickJs('frmLTiMSTop_btnAttendance', 'LOGIN_USER')],
  ['restoreScroll', restoreScrollJs(position)],
  ['childClosed', childClosedJs('登録', position)],
  ['health', healthFlagJs(true)],
  ['stepsReply', stepsReplyJs('s1abc', 8421)],
  ['stepsReply（読めない）', stepsReplyJs('s1abc', null)],
  ['prefill', prefillJs({ date: '2026/11/19', from: '17:30', to: '19:00', reason: "it's \"ok\"" })],
  ['safeArea', safeAreaJs(34)],
  // WebView に実際に入れる形（EzcraftWebView.tsx と同じつなぎ方）
  ...apps.map((id): [string, string] => [
    `WebView に入れる形 ${id || '(なし)'}`,
    joinScripts([safeAreaJs(34), BRIDGE_JS, SAVE_WATCH_JS, buildSkinScript(id), autoClickJs('b1', 'K'), restoreScrollJs(position)]),
  ]),
  ['WebView に入れる形（読み込みの前）', joinScripts([bootJs('#000000'), openerStubJs(handoff), prefillJs({ a: 'b' }), initAppJs(null), refModeJs({}), healthFlagJs(true)])],
];

let failed = 0;
const ng = (name: string, why: string) => {
  failed++;
  console.log(`NG ${name}: ${why}`);
};

for (const [name, js] of scripts) {
  try {
    new Function(js);
  } catch (e) {
    ng(name, `読めない（${String(e)}）`);
    continue;
  }
  const lost = js.match(LOST_ESCAPE);
  if (lost) ng(name, `\\ が落ちた正規表現らしいもの: ${lost.slice(0, 5).join(' / ')}`);
  // 小さくする（src/webview/compact.ts）ときに、行頭の空白とコメントの行を消すので、複数行にまたがる文字を使わない
  const multiline = js.split('\n').find((line) => line.includes('`') || /\\$/.test(line));
  if (multiline) ng(name, `複数行にまたがる文字（\` や行末の \\）がある: ${multiline.trim().slice(0, 80)}`);
}

// CSS: スクリプトの中で style に入れる文字（`...` の中の、{ と } のある長い文字）の数を数える
for (const id of apps) {
  const js = buildSkinScript(id);
  for (const css of js.match(/"(?:[^"\\]|\\.){200,}"/g) ?? []) {
    let text: string;
    try {
      text = JSON.parse(css) as string;
    } catch {
      continue;
    }
    if (!/[{}]/.test(text) || !/:\s*[^;]+;/.test(text)) continue;
    const plain = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
    const open = (plain.match(/\{/g) ?? []).length;
    const close = (plain.match(/\}/g) ?? []).length;
    if (open !== close) ng(`skin ${id || '(なし)'} の CSS`, `{ が ${open} 個、} が ${close} 個で合わない`);
  }
}

// 空のページで動かす: 最初の一歩（読み込んだすぐあと）でエラーにならないか
for (const id of apps) {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String(e.message ?? e)));
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="main"></div></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'https://lincrea-all.ezcraft.com/runapp/L_Tims/frmAttendance/',
    virtualConsole,
  });
  const w = dom.window as unknown as Record<string, unknown> & { eval: (js: string) => unknown };
  w.ReactNativeWebView = { postMessage: () => {} };
  w.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
  try {
    // つなぎ方（joinScripts）が例外を飲み込むので、ここでは1本ずつ動かして確かめる
    for (const js of [bootJs('#ffffff'), BRIDGE_JS, SAVE_WATCH_JS, buildSkinScript(id)]) w.eval(js);
  } catch (e) {
    ng(`skin ${id || '(なし)'} を動かす`, String(e));
  }
  if (errors.length > 0) ng(`skin ${id || '(なし)'} を動かす`, errors.slice(0, 3).join(' / '));
  dom.window.close();
}

console.log(failed ? `${failed} 件の問題があります` : `OK（${scripts.length} 本のスクリプト・${apps.length} 本の見た目を動かした）`);
process.exit(failed ? 1 : 0);
