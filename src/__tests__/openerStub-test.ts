// 画面を開いた元の窓（window.opener）の代わり（src/webview/page/bridgeJs.ts の openerStubJs）。
// EZCraft の Runapp.js は、読み込みのときに opener をたどって「いちばん元の窓」を探す（findMainWindow）。
// 代わりの opener に FALCON.views がないと、そこで TypeError になり、読み込みのときの残りの準備が止まっていた
// （勤務表・勤怠実績登録・申請・Walk the Talk の画面。2026-11-22 にページのエラーを控えて見つけた）。
import { JSDOM } from 'jsdom';

import { openerStubJs } from '../webview/page/bridgeJs';

/**
 * EZCraft の Runapp.js（/js/view/Runapp.js?_=v.2.12.0.20261105d）の FALCON.views.RunApp.Window.findMainWindow と同じ判定。
 * 2026-11-22 に読んだもの:
 *   findMainWindow: function (e) { var n = e || window;
 *     return n.opener && n.opener.FALCON && n.opener.FALCON.views.RunApp && n.opener !== n ? this.findMainWindow(n.opener) : n }
 */
type Win = { opener?: { FALCON?: { views?: { RunApp?: unknown } } } & Win };
function findMainWindow(n: Win): Win {
  return n.opener && n.opener.FALCON && n.opener.FALCON.views!.RunApp && n.opener !== n ? findMainWindow(n.opener) : n;
}

function stubbed(): Win & { name: string } {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
  const w = dom.window as unknown as Win & { name: string; eval: (js: string) => unknown };
  w.eval(openerStubJs({ name: 'frmAttendanceDtl_1', appData: '{"emp_cd":"1"}', params: '{"date":"2026/11/04"}' }));
  return w;
}

test('代わりの opener でも、EZCraft が「いちばん元の窓」を探すところで止まらない（この画面がいちばん元の窓になる）', () => {
  const w = stubbed();
  expect(w.opener?.FALCON).toBeDefined();
  expect(() => findMainWindow(w)).not.toThrow();
  expect(findMainWindow(w)).toBe(w);
});

test('開いた元の情報（画面の名前・データ・引数）は、今までどおり渡す', () => {
  const w = stubbed() as unknown as {
    name: string;
    opener: { App: { data: { emp_cd: string } }; FALCON: { apps: { procedure: { Forms: { _getCashedform: (id: string) => { getParam: (k: string) => unknown } } } } } };
  };
  expect(w.name).toBe('frmAttendanceDtl_1');
  expect(w.opener.App.data.emp_cd).toBe('1');
  expect(w.opener.FALCON.apps.procedure.Forms._getCashedform('frmAttendanceDtl_1').getParam('date')).toBe('2026/11/04');
});
