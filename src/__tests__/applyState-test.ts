// 勤務表の日の申請の札が、申請中か承認済などか（src/webview/page/timsSkin.ts の APPLY_STATE_JS）。
// EZCraft は札の地の色だけで分けている（残業: 申請中 #8ecaa6・承認済 #1caa8c、休暇: #ff9999・#ff3232、遅刻早退: #969696・#323232）
import { JSDOM } from 'jsdom';

import { APPLY_STATE_JS } from '../webview/page/timsSkin';

const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
const w = dom.window as unknown as { eval: (code: string) => unknown; document: Document };
const applyState = w.eval(`${APPLY_STATE_JS}\napplyState`) as (span: HTMLElement) => string;

function ribbon(text: string, color: string, visibility = 'visible') {
  const span = w.document.createElement('span');
  span.textContent = text;
  span.style.background = color;
  span.style.visibility = visibility;
  return span;
}

test.each([
  ['残業', '#8ecaa6', 'wait'],
  ['残業', '#1caa8c', 'ok'],
  ['有休', '#ff9999', 'wait'],
  ['有休', '#ff3232', 'ok'],
  ['遅刻', '#969696', 'wait'],
  ['遅刻', '#323232', 'ok'],
])('%s の札（%s）は %s', (text, color, state) => {
  expect(applyState(ribbon(text, color))).toBe(state);
});

test('知らない色は明るさで分ける（薄い色は申請中）', () => {
  expect(applyState(ribbon('特休', '#cce0ff'))).toBe('wait');
  expect(applyState(ribbon('特休', '#003366'))).toBe('ok');
});

test('申請のない日の札（空・隠れている・色がない）は、何も出さない', () => {
  expect(applyState(ribbon('', '#1caa8c'))).toBe('');
  expect(applyState(ribbon('残業', '#1caa8c', 'hidden'))).toBe('');
  expect(applyState(ribbon('残業', ''))).toBe('');
});
