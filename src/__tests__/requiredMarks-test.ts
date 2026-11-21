// 必須の印（＊）を、欄の右の外から、欄の見出しの後ろに移す（src/webview/page/ezcraftSkin.ts の requiredMarks）。
// 欄が必須でなくなったら（EZCraft が選んだものに合わせて必須を外す）、見出しの ＊ も外すこと（2026-11-22 のレビュー）。
// 見た目の直しを、そのまま jsdom で動かす。jsdom は ::after の content と位置を計算しないので、その2つだけ代わりのものにする
import { JSDOM, VirtualConsole } from 'jsdom';

import { buildSkinScript } from '../webview/page/ezcraftSkin';

let dom: JSDOM;
let doc: Document;
let required = true;

beforeEach(() => {
  required = true;
  dom = new JSDOM(
    `<!doctype html><html><head></head><body>
      <div id="frm" class="tcc-form form-content">
        <div id="frm_lbl1" class="tcc-component lbl" style="position:absolute"><span class="tcc-label-text">健診機関名</span></div>
        <div id="frm_name" class="tcc-component text" style="position:absolute"><input class="text-box"></div>
      </div>
    </body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() },
  );
  doc = dom.window.document;
  const w = dom.window as unknown as Record<string, unknown> & { eval: (js: string) => unknown };
  w.ReactNativeWebView = { postMessage: () => {} };
  w.matchMedia = () => ({ matches: false, addEventListener: () => {} });
  // 欄の ::after に「＊」があるか（EZCraft が必須の欄に付ける印）。jsdom は計算しないので、ここで決める
  const real = dom.window.getComputedStyle.bind(dom.window);
  w.getComputedStyle = (el: Element, pseudo?: string) =>
    pseudo === '::after' && (el as HTMLElement).id === 'frm_name' ? { content: required ? '"＊"' : 'none' } : real(el, pseudo);
  // 見える欄と見出し（jsdom は offsetParent と位置を持たない）。見出しは欄の左の同じ行
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetParent', { get: () => doc.body, configurable: true });
  const rects: Record<string, DOMRect> = {
    frm_lbl1: { top: 100, bottom: 140, left: 16, right: 104, width: 88, height: 40 } as DOMRect,
    frm_name: { top: 100, bottom: 140, left: 104, right: 380, width: 276, height: 40 } as DOMRect,
  };
  dom.window.HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    return rects[this.id] ?? ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 } as DOMRect);
  };
  w.eval(buildSkinScript('L_HealthCare'));
});
afterEach(() => dom.window.close());

const restyle = () => (dom.window as unknown as { __myappRestyleNow: () => void }).__myappRestyleNow();
const label = () => doc.getElementById('frm_lbl1')!;
const field = () => doc.getElementById('frm_name')!;

test('必須の欄の ＊ を、見出しの後ろに移す', () => {
  restyle();
  expect(label().classList.contains('myapp-required')).toBe(true);
  expect(field().classList.contains('myapp-req-moved')).toBe(true);
});

test('欄が必須でなくなったら、見出しの ＊ も外す（また必須になったら、また付ける）', () => {
  restyle();
  required = false;
  restyle();
  expect(label().classList.contains('myapp-required')).toBe(false);
  expect(field().classList.contains('myapp-req-moved')).toBe(false);
  required = true;
  restyle();
  expect(label().classList.contains('myapp-required')).toBe(true);
});
