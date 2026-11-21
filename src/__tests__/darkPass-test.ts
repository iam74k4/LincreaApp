// ダークモードで、ページに直接書かれた明るい地を塗り直す処理（src/webview/page/ezcraftSkin.ts の DARK_JS）。
// アプリごとの見た目の直しには <html> のクラスが付いたときだけ効くもの（timsSkin.ts の scoped(':root.myapp-att-list', …)）があり、
// クラスが付く前に塗った色が残ると、クラスが付いても直らない（勤務表の一覧が灰色の板になった。2026-11-22）。
// ページは jsdom で作る。jsdom は CSS の変数や詳しさを計算しないので、getComputedStyle は
// 「インラインの色があればそれ、なければクラスで決まる色」を返す代わりのものにする（実際のブラウザでの確かめは、PR に書いた）。
import { JSDOM } from 'jsdom';

import { DARK_JS } from '../webview/page/ezcraftSkin';

const SURFACE = 'rgb(28, 28, 30)';

type Pass = { darken: () => void; lighten: () => void; darkenIfSettled: () => void; update: () => void; restyle: () => void };
type Marked = HTMLElement & { __myappOrig?: object | null };

let dom: JSDOM;
let root: HTMLElement;
let list: Marked;
let card: Marked;
let pass: Pass;

/** EZCraft の勤務表の一覧（もとは白）。<html> に myapp-att-list があれば、アプリの CSS で黒い地になる */
function computedBackground(el: Element): string {
  const inline = (el as HTMLElement).style?.getPropertyValue('background-color');
  if (inline) return inline;
  if (el === list) return root.classList.contains('myapp-att-list') ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
  if (el === card) return 'rgb(255, 255, 255)'; // クラスに関係なく白い部品
  return 'rgba(0, 0, 0, 0)';
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body><div id="list"></div><div id="card"></div></body></html>');
  const win = dom.window;
  root = win.document.documentElement;
  list = win.document.getElementById('list') as Marked;
  card = win.document.getElementById('card') as Marked;
  const getComputedStyle = (el: Element) => ({
    backgroundColor: computedBackground(el),
    backgroundImage: 'none',
    color: 'rgb(0, 0, 0)',
    getPropertyValue: () => '0px',
  });
  (win as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: true, addEventListener: () => {} });
  pass = new Function(
    'window',
    'document',
    'root',
    'getComputedStyle',
    'MutationObserver',
    'innerHeight',
    'innerWidth',
    'setTimeout',
    'clearTimeout',
    `${DARK_JS}; return { darken: darken, lighten: lighten, darkenIfSettled: darkenIfSettled, update: update, restyle: restyle };`,
    // 整え直し（setTimeout の restyle）は、ほかの部品（ezcraftSkin.ts の GENERIC_JS など）が要るので動かさない。塗る処理だけを呼ぶ
  )(win, win.document, root, getComputedStyle, win.MutationObserver, 800, 400, () => 0, () => {});
});
afterEach(() => {
  dom.window.close();
});

test('クラスが付く前に塗った地は、クラスが付いたら戻して、いまの CSS で決め直す（勤務表の一覧が灰色のまま残らない）', () => {
  pass.darken();
  // ほかのタブが開いているあいだ: 一覧はもとの白なので、暗い地に塗る
  expect(list.style.getPropertyValue('background-color')).toBe(SURFACE);
  root.classList.add('myapp-att-list');
  pass.darken();
  // 一覧の CSS が効くようになった: 塗った色を戻し、CSS の黒い地のままにする
  expect(list.style.getPropertyValue('background-color')).toBe('');
  expect(computedBackground(list)).toBe('rgb(0, 0, 0)');
  // クラスに関係なく白い部品は、決め直しても暗い地のまま
  expect(card.style.getPropertyValue('background-color')).toBe(SURFACE);
});

test('クラスが外れたら、もとの白に戻る部品をもう一度塗る', () => {
  root.classList.add('myapp-att-list');
  pass.darken();
  expect(list.style.getPropertyValue('background-color')).toBe('');
  root.classList.remove('myapp-att-list');
  pass.darken();
  expect(list.style.getPropertyValue('background-color')).toBe(SURFACE);
});

test('地の色を変えないクラス（保存中・下の帯やタブがある・打っている・パスワードの画面）では、塗った色を決め直さない（重い処理を増やさない）', () => {
  pass.darken();
  const before = card.__myappOrig;
  expect(before).toBeTruthy();
  const layout = ['myapp-saving', 'myapp-quiet', 'myapp-quiet-refresh', 'myapp-has-bar', 'myapp-has-tabbar', 'myapp-typing', 'myapp-pw-hasbio'];
  root.classList.add(...layout);
  pass.darken();
  expect(card.__myappOrig).toBe(before);
  root.classList.remove(...layout);
  pass.darken();
  expect(card.__myappOrig).toBe(before);
});

test('画面を切り替えるクラス（勤怠申請の myapp-apply-*）でも、決め直す', () => {
  pass.darken();
  const before = card.__myappOrig;
  root.classList.add('myapp-apply-tab');
  pass.darken();
  expect(card.__myappOrig).not.toBe(before);
  expect(card.style.getPropertyValue('background-color')).toBe(SURFACE);
});

test('スクロール・見えてきたときの色決めは、整え直しが待っているあいだはしない（しるしが付く前に塗らない）', () => {
  // 読み込んだばかり: 整え直しが待っている
  pass.darkenIfSettled();
  expect(card.style.getPropertyValue('background-color')).toBe('');
  // 整え直しが済んだ（restyle の中の、ほかの部品の処理は、このテストにはないので止まるが、待っている印は外れる）
  try {
    pass.restyle();
  } catch {
    // GENERIC_JS などの関数がないため
  }
  pass.darkenIfSettled();
  expect(card.style.getPropertyValue('background-color')).toBe(SURFACE);
  // ページが変わった（整え直しがまた待っている）: 塗り直さない
  pass.lighten();
  pass.update();
  pass.darkenIfSettled();
  expect(card.style.getPropertyValue('background-color')).toBe('');
});
