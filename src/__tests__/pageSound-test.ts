// ページの音（EZCraft のお知らせの音）を、iPhone のマナーモードに従わせる（src/webview/ezcraftSkin.ts の bootJs）。
// ページは jsdom で作る（React Native のテストの設定と jsdom の環境は一緒に使えないため、テストの中で作る）。
import { JSDOM } from 'jsdom';

import { bootJs } from '../webview/ezcraftSkin';

function runBoot(audioSession: { type: string } | undefined) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  if (audioSession) Object.defineProperty(dom.window.navigator, 'audioSession', { value: audioSession });
  new Function('window', 'document', 'navigator', 'XMLHttpRequest', bootJs('#ffffff'))(
    dom.window,
    dom.window.document,
    dom.window.navigator,
    dom.window.XMLHttpRequest,
  );
  dom.window.close();
}

test('ページの音は「周りの音」（ambient）にして、マナーモードでは鳴らさない', () => {
  const audioSession = { type: 'auto' };
  runBoot(audioSession);
  expect(audioSession.type).toBe('ambient');
});

test('Audio Session API のない古い iOS でも、ページの準備は止まらない', () => {
  expect(() => runBoot(undefined)).not.toThrow();
});
