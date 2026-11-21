// 入力欄で打っているあいだ、画面の下に固定した帯を隠すしるし（src/webview/page/ezcraftSkin.ts の TYPING_JS）。
import { JSDOM } from 'jsdom';

import { TYPING_JS } from '../webview/page/ezcraftSkin';

let dom: JSDOM;
let doc: Document;
let root: HTMLElement;
let resizeViewport: (height: number) => void;
const typing = () => root.classList.contains('myapp-typing');
const el = (id: string) => doc.getElementById(id) as HTMLElement;

beforeEach(() => {
  jest.useFakeTimers();
  dom = new JSDOM(`<!doctype html><html><body>
    <input id="time" type="text">
    <input id="hours" inputmode="numeric">
    <textarea id="note"></textarea>
    <input id="ro" type="text" readonly>
    <input id="check" type="checkbox">
    <button id="save">登録</button>
  </body></html>`);
  doc = dom.window.document;
  root = doc.documentElement;
  // 見えている高さ（キーボードが出ると低くなる）。resize を送って変わったことを知らせる
  const viewport = Object.assign(new dom.window.EventTarget(), { height: 800 });
  new Function('window', 'document', 'root', TYPING_JS)({ visualViewport: viewport }, doc, root);
  resizeViewport = (h: number) => {
    viewport.height = h;
    viewport.dispatchEvent(new dom.window.Event('resize'));
  };
});
afterEach(() => {
  jest.useRealTimers();
  dom.window.close();
});

test('文字を打つ欄（入力欄・複数行の欄）を押したら、しるしを付ける', () => {
  el('time').focus();
  expect(typing()).toBe(true);
  el('time').blur();
  jest.advanceTimersByTime(200);
  expect(typing()).toBe(false);
  el('note').focus();
  expect(typing()).toBe(true);
});

test('打てない欄（読むだけ・チェック）やボタンでは付けない（キーボードは出ない）', () => {
  el('ro').focus();
  expect(typing()).toBe(false);
  el('check').focus();
  expect(typing()).toBe(false);
  el('save').focus();
  expect(typing()).toBe(false);
});

test('次の欄へ移るあいだは、しるしを外さない（帯がちらつかない）', () => {
  el('time').focus();
  el('hours').focus(); // time から focusout → すぐ hours に focusin
  jest.advanceTimersByTime(200);
  expect(typing()).toBe(true);
  // 打ち終わって閉じた（どこにも当たっていない）
  el('hours').blur();
  jest.advanceTimersByTime(100);
  expect(typing()).toBe(true); // 少し待ってから決める
  jest.advanceTimersByTime(100);
  expect(typing()).toBe(false);
});

test('欄に入ったまま、キーボードだけを閉じた（Android の戻るボタン。focusout が来ない）ら、しるしを外す', () => {
  el('time').focus();
  resizeViewport(450); // キーボードが出た
  expect(typing()).toBe(true);
  resizeViewport(800); // キーボードを閉じた
  expect(typing()).toBe(false);
  expect(doc.activeElement).toBe(el('time'));
});

test('キーボードだけを閉じた欄をもう一度押して、キーボードがまた出た（focusin は来ない）ら、また隠す', () => {
  el('time').focus();
  resizeViewport(450);
  resizeViewport(800); // 戻るボタンで閉じた
  expect(typing()).toBe(false);
  resizeViewport(450); // 同じ欄を押して、また出た
  expect(typing()).toBe(true);
});

test('作った focusin（時刻のダイヤルの「決定」が送るもの）では付けない（帯が一瞬消えてちらつかない）', () => {
  el('time').dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
  expect(typing()).toBe(false);
});
