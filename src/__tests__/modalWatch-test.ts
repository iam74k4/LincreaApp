// ページの中のダイアログの見張り（src/webview/page/bridgeJs.ts の BRIDGE_JS）。見えているあいだだけ、0.3 秒ごとに見る。
// 重ねた画面の下に隠れたページでは止め、見えたら戻す（隠れたページが、1秒に3回起きて電池を使わないように）
import { JSDOM } from 'jsdom';

import { BRIDGE_JS } from '../webview/page/bridgeJs';

function page(hiddenAtStart: boolean) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/runapp/L_Tims/frmAttendance/', runScripts: 'outside-only' });
  const w = dom.window as unknown as Window & typeof globalThis & { ReactNativeWebView: { postMessage: (s: string) => void } };
  let hidden = hiddenAtStart;
  Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => hidden });
  w.ReactNativeWebView = { postMessage: () => {} };
  const timers = new Set<number>();
  let next = 1;
  const started: number[] = [];
  (w as unknown as { setInterval: (fn: () => void, ms: number) => number }).setInterval = (_fn, ms) => {
    const id = next++;
    if (ms === 300) {
      timers.add(id);
      started.push(id);
    }
    return id;
  };
  (w as unknown as { clearInterval: (id: number) => void }).clearInterval = (id) => {
    timers.delete(id);
  };
  (w as unknown as { eval: (code: string) => unknown }).eval(BRIDGE_JS);
  const setHidden = (h: boolean) => {
    hidden = h;
    w.document.dispatchEvent(new w.Event('visibilitychange'));
  };
  return { running: () => timers.size, started, setHidden };
}

test('見えているページでは、見張りを始める', () => {
  expect(page(false).running()).toBe(1);
});

test('隠れたら止め、見えたら戻す（何度くり返しても、見張りは1つ）', () => {
  const p = page(false);
  p.setHidden(true);
  expect(p.running()).toBe(0);
  p.setHidden(false);
  expect(p.running()).toBe(1);
  p.setHidden(false);
  expect(p.running()).toBe(1);
  expect(p.started).toHaveLength(2);
});

test('隠れたまま読み込まれたページは、見えるまで始めない', () => {
  const p = page(true);
  expect(p.running()).toBe(0);
  p.setHidden(false);
  expect(p.running()).toBe(1);
});
