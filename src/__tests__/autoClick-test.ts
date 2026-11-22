// 近道のために、ページの準備ができたら決まったボタンを1回押す（src/webview/page/bridgeJs.ts の autoClickJs）。
// アプリがあきらめた（15 秒たって「開いています」の覆いを外した）あとは押さない（2026-11-22）。
// 遅れて押すと、押して開いた画面が、近道の画面を入れ替えずに上に重なり、残りの段と入れておく値も落としていた。
import { JSDOM } from 'jsdom';

import { autoClickJs } from '../webview/page/bridgeJs';

let dom: JSDOM;
let clicks: number;
const wait = (ms: number) => new Promise((resolve) => dom.window.setTimeout(resolve, ms));

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body><div id="frmTop_btnApply"><a class="tcc-btn">申請</a></div></body></html>', {
    runScripts: 'outside-only',
  });
  // jsdom は大きさを測らないので、見えているボタンとして幅を返す
  const button = dom.window.document.querySelector('.tcc-btn') as HTMLElement;
  button.getBoundingClientRect = () => ({ width: 80, height: 40 }) as DOMRect;
  clicks = 0;
  button.addEventListener('click', () => {
    clicks += 1;
  });
});
afterEach(() => {
  dom.window.close();
});

test('ページが整ったら、ボタンを1回だけ押す', async () => {
  (dom.window as unknown as { eval: (js: string) => unknown }).eval(autoClickJs('frmTop_btnApply', ''));
  await wait(900);
  expect(clicks).toBe(1);
});

test('アプリがあきらめた（__myappAutoClickStop）あとは、押さない', async () => {
  const w = dom.window as unknown as { eval: (js: string) => unknown; __myappAutoClickStop: boolean };
  w.eval(autoClickJs('frmTop_btnApply', ''));
  w.__myappAutoClickStop = true;
  await wait(900);
  expect(clicks).toBe(0);
});
