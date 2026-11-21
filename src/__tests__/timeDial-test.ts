// 勤怠実績登録などの時刻・時間の欄は、押すとダイヤルを出す（キーボードは出さない。src/webview/page/timsSkin.ts の openDial）。
// 押していないのに欄に入ったとき（EZCraft がエラーの知らせを閉じたあとに、その欄へ戻す・キーボードの「次へ」）は、
// キーボードが出てダイヤルにならなかったので、欄から出す（2026-11-22）。勤怠 TiMS の見た目の直しを、そのまま jsdom で動かす。
import { JSDOM, VirtualConsole } from 'jsdom';

import { buildSkinScript } from '../webview/page/ezcraftSkin';

let dom: JSDOM;
let doc: Document;
/** 動かしているあいだに、ページのスクリプトで起きたエラー（片づけ（window.close）のあとのものは数えない） */
let errors: string[];
let closing = false;
const wait = (ms: number) => new Promise((resolve) => dom.window.setTimeout(resolve, ms));

beforeEach(() => {
  errors = [];
  closing = false;
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (!closing) errors.push(String(e.stack ?? e));
  });
  dom = new JSDOM(
    `<!doctype html><html><head></head><body>
      <div id="frmAttendanceDtl" class="tcc-form form-content">
        <div id="frmAttendanceDtl_txtTime1" class="tcc-component"><input id="hours" class="text-box"></div>
        <div id="frmAttendanceDtl_work_end_tm" class="tcc-component"><input id="end" class="text-box"></div>
        <div id="frmAttendanceDtl_remarks" class="tcc-component"><input id="note" class="text-box"></div>
      </div>
    </body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole },
  );
  doc = dom.window.document;
  const w = dom.window as unknown as { ReactNativeWebView: unknown; matchMedia: unknown; eval: (js: string) => unknown };
  w.ReactNativeWebView = { postMessage: () => {} };
  w.matchMedia = () => ({ matches: false, addEventListener: () => {} });
  w.eval(buildSkinScript('L_Tims'));
});
afterEach(() => {
  expect(errors).toEqual([]);
  closing = true;
  dom.window.close();
});

test('エラーの知らせを閉じた直後に、EZCraft が時刻・時間の欄へ戻したら、欄から出す（キーボードを出さない。次に押せばダイヤル）', async () => {
  (dom.window as unknown as { __myappMsgBoxClosedAt: number }).__myappMsgBoxClosedAt = Date.now();
  for (const id of ['hours', 'end']) {
    const input = doc.getElementById(id) as HTMLInputElement;
    input.focus(); // EZCraft がエラーの知らせのあとに欄へ戻す、と同じ
    expect(doc.activeElement).toBe(input);
    await wait(20);
    expect(doc.activeElement).not.toBe(input);
  }
});

test('外付けのキーボードの Tab・VoiceOver で入ったとき（知らせを閉じた直後でない）は、そのまま打てる', async () => {
  const hours = doc.getElementById('hours') as HTMLInputElement;
  hours.focus();
  await wait(20);
  expect(doc.activeElement).toBe(hours);
});

test('ダイヤルでない欄（ふつうに打つ欄）は、知らせを閉じた直後でも、そのまま', async () => {
  (dom.window as unknown as { __myappMsgBoxClosedAt: number }).__myappMsgBoxClosedAt = Date.now();
  const note = doc.getElementById('note') as HTMLInputElement;
  note.focus();
  await wait(20);
  expect(doc.activeElement).toBe(note);
});

test('ダイヤルの「決定」が送る focusin（作ったもの）では、何もしない', async () => {
  const end = doc.getElementById('end') as HTMLInputElement;
  const blur = jest.spyOn(end, 'blur');
  end.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
  await wait(20);
  expect(blur).not.toHaveBeenCalled();
});
