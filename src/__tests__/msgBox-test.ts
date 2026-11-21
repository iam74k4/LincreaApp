// EZCraft のお知らせ・エラーのダイアログとエラーの欄を、スマホ向けにするスクリプト（src/webview/page/msgBox.ts の MSG_BOX_JS）。
// ダイアログと欄の作りは、勤怠実績登録で実際に出たエラー（2026-11-22）を控えたもの（色は DARK_JS が書いたものも含む）。
import { JSDOM } from 'jsdom';

import { MSG_BOX_JS } from '../webview/page/msgBox';

/** 実際に出たダイアログ（EZCraft の showMsgBox が作ったもの。ダーク用に DARK_JS が色を書いたあと） */
function errorBox(title = 'frmAttendanceDtl', text = '<p style="color: rgb(245, 245, 247) !important;">入力項目にエラーがあります<br>（マウスオーバーでエラーの詳細が表示されます）</p>', buttons = '<button id="OK1" class="tcc-msg-box-btn" tabindex="1001" style="background-color: rgb(28, 28, 30) !important; border-color: rgb(56, 56, 58) !important; color: rgb(245, 245, 247) !important;">OK</button>') {
  return `<div class="tcc-msg-box-back animated fadeInLeft fast"><div id="tccMsgBox1" class="tcc-msg-box" style="top: 160.214286px; left: 16px;"><div class="tcc-msg-box-content"><div class="tcc-msg-box-header no-wrap ellipsis"><i class="fa fa-exclamation-circle"></i> &nbsp;<span class="tcc-msg-box-title">${title}</span><button type="button" class="tcc-msg-box-quit" tabindex="1000">×</button></div><div class="tcc-msg-box-body"><div class="tcc-msg-box-icon"><i class="fa fa-exclamation-circle animated fadeIn"></i></div><div class="tcc-msg-box-txt">${text}</div></div><div class="tcc-msg-box-footer" style="border-top-color: rgb(56, 56, 58) !important;">${buttons}</div></div></div></div>`;
}

/** エラーの欄（EZCraft が地の色を直接書き、data-tooltip に中身を入れる）と、エラーでない説明の付いた部品 */
const FIELDS = `
<div id="frmAttendanceDtl_work_stt_tm" class="tcc-component"><input class="text-box center" data-tooltip="開始時間と終了時間の整合性エラー" style="font-size: 12px; background-color: rgb(255, 240, 240);"></div>
<div id="frmAttendanceDtl_work_end_tm" class="tcc-component"><input class="text-box center" data-tooltip="開始時間と終了時間の整合性エラー" style="font-size: 12px; background-color: rgb(255, 240, 240);"></div>
<div id="frmAttendanceDtl_break_tm_from1" class="tcc-component"><input class="text-box center" data-tooltip="実績時間外に休憩時間が入力されています" style="font-size: 12px; background-color: rgb(255, 240, 240);"></div>
<div id="frmAttendanceDtl_txtTime1" class="tcc-component"><input class="text-box center" data-tooltip="勤務時間とプロジェクトの総時間数が一致していません" style="font-size: 13px; background-color: rgb(255, 240, 240);"></div>
<div id="frmAttendanceDtl_lbl34" class="tcc-component"><label class="tcc-label" data-tooltip="テレワーク" style="background-color: transparent;">テレワーク</label></div>
<div id="frmAttendanceDtl_txtTime2" class="tcc-component"><input class="text-box center" data-tooltip="" style="font-size: 13px;"></div>`;

let dom: JSDOM;
let doc: Document;
let run: { msgBoxes: () => void; errorFields: () => string[] };

function load(body: string) {
  dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`);
  doc = dom.window.document;
  run = new Function('window', 'document', 'getComputedStyle', 'setTimeout', `${MSG_BOX_JS}; return { msgBoxes: msgBoxes, errorFields: errorFields };`)(
    dom.window,
    doc,
    dom.window.getComputedStyle.bind(dom.window),
    dom.window.setTimeout.bind(dom.window),
  );
}
afterEach(() => dom.window.close());

const box = () => doc.querySelector('.tcc-msg-box') as HTMLElement;
const text = () => (doc.querySelector('.tcc-msg-box-txt')?.textContent ?? '').trim();
const items = () => Array.from(doc.querySelectorAll('.myapp-msg-errors li')).map((li) => li.textContent);

describe('入力のエラーのダイアログ（勤怠実績登録）', () => {
  beforeEach(() => {
    load(FIELDS + errorBox());
    run.msgBoxes();
  });

  test('題は画面の ID ではなく、文の1行目にする', () => {
    expect(doc.querySelector('.tcc-msg-box-title')?.textContent).toBe('入力項目にエラーがあります');
    expect(box().hasAttribute('data-myapp-notitle')).toBe(false);
  });

  test('「マウスオーバーで…」は出さず、エラーの欄の中身を重ならないように並べる', () => {
    expect(text()).not.toMatch(/マウスオーバー/);
    expect(text()).toMatch(/^赤い枠の欄を直してください。/);
    expect(items()).toEqual(['開始時間と終了時間の整合性エラー', '実績時間外に休憩時間が入力されています', '勤務時間とプロジェクトの総時間数が一致していません']);
  });

  test('エラーの欄にだけしるし（赤い枠）を付ける。説明が付いただけの部品・空の説明の欄には付けない', () => {
    const marked = Array.from(doc.querySelectorAll('[data-myapp-error]')).map((el) => el.parentElement?.id);
    expect(marked).toEqual(['frmAttendanceDtl_work_stt_tm', 'frmAttendanceDtl_work_end_tm', 'frmAttendanceDtl_break_tm_from1', 'frmAttendanceDtl_txtTime1']);
  });

  test('色は CSS で決める（ダーク用に書かれた色を外し、ダーク用の書き換えの外にする）。OK を目立たせる', () => {
    const back = doc.querySelector('.tcc-msg-box-back') as HTMLElement;
    expect(back.hasAttribute('data-myapp-nodark')).toBe(true);
    const ok = doc.getElementById('OK1') as HTMLElement;
    expect(ok.style.backgroundColor).toBe('');
    expect(ok.style.color).toBe('');
    expect((doc.querySelector('.tcc-msg-box-footer') as HTMLElement).style.borderTopColor).toBe('');
    expect(ok.hasAttribute('data-myapp-primary')).toBe(true);
    // ボタンの文字は変えない（EZCraft は押されたボタンを文字で見分ける）
    expect(ok.textContent).toBe('OK');
  });

  test('何度呼んでも、同じダイアログは1回だけ整える（並べた中身が増えない）', () => {
    run.msgBoxes();
    run.msgBoxes();
    expect(items()).toHaveLength(3);
    expect(doc.querySelectorAll('.tcc-msg-box-txt p')).toHaveLength(1);
  });
});

test('エラーの欄を直したら（地の色が消えたら）、しるしを外す', () => {
  load(FIELDS);
  expect(run.errorFields()).toHaveLength(3);
  const input = doc.querySelector('#frmAttendanceDtl_txtTime1 input') as HTMLInputElement;
  input.style.removeProperty('background-color');
  expect(run.errorFields()).toEqual(['開始時間と終了時間の整合性エラー', '実績時間外に休憩時間が入力されています']);
  expect(input.hasAttribute('data-myapp-error')).toBe(false);
});

test('エラーの欄が見つからないときは、確かめるように知らせるだけ（空の一覧は出さない）', () => {
  load(errorBox());
  run.msgBoxes();
  expect(text()).toBe('入力した内容を確かめてください。');
  expect(doc.querySelector('.myapp-msg-errors')).toBeNull();
});

test('意味のある題（ID でない）はそのまま。決めるボタンはキャンセル・いいえでない方', () => {
  load(errorBox('確認', '保存しますか？', '<button class="tcc-msg-box-btn">はい</button><button class="tcc-msg-box-btn">いいえ</button>'));
  run.msgBoxes();
  expect(doc.querySelector('.tcc-msg-box-title')?.textContent).toBe('確認');
  expect(text()).toBe('保存しますか？');
  const [yes, no] = Array.from(doc.querySelectorAll('.tcc-msg-box-btn'));
  expect(yes.hasAttribute('data-myapp-primary')).toBe(true);
  expect(no.hasAttribute('data-myapp-primary')).toBe(false);
});

test('題が ID で、文が1行だけのときは、その行を題にして、文の段は出さない', () => {
  load(errorBox('frmApply - Error at save', '登録できませんでした'));
  run.msgBoxes();
  expect(doc.querySelector('.tcc-msg-box-title')?.textContent).toBe('登録できませんでした');
  expect(box().hasAttribute('data-myapp-notext')).toBe(true);
});

describe('説明の吹き出し（#tccToolTip）', () => {
  let hide: jest.Mock;
  beforeEach(() => {
    load('<div id="tccToolTip" style="opacity: 1;">勤務時間とプロジェクトの総時間数が一致していません</div><input id="field">');
    hide = jest.fn();
    (dom.window as unknown as { Tcc: unknown }).Tcc = { TccToolTip: { hide } };
  });
  const touch = (el: Element) => el.dispatchEvent(new dom.window.Event('touchstart', { bubbles: true }));

  test('出ているときに、ほかの所を触ったら、EZCraft の消し方で消す（スマホにはマウスが離れることがない）', () => {
    touch(doc.getElementById('field')!);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  test('欄まで動く自動のスクロール（scroll）では消さない（いま押した欄の吹き出しを消さない）', () => {
    dom.window.dispatchEvent(new dom.window.Event('scroll'));
    expect(hide).not.toHaveBeenCalled();
  });

  test('吹き出しそのものを触ったとき・もう消えているときは何もしない', () => {
    touch(doc.getElementById('tccToolTip')!);
    (doc.getElementById('tccToolTip') as HTMLElement).style.zIndex = '-100'; // EZCraft が消したあと
    touch(doc.getElementById('field')!);
    expect(hide).not.toHaveBeenCalled();
  });
});

test('題が EZCraft の英語の決まり文句（Error など）のときも、文の1行目を題にする', () => {
  load(errorBox('Error', '<p>保存できませんでした<br>もう一度お試しください</p>'));
  run.msgBoxes();
  expect(doc.querySelector('.tcc-msg-box-title')?.textContent).toBe('保存できませんでした');
  expect(text()).toBe('もう一度お試しください');
});

test('文がいくつかの段落でも、行ごとに分けて残す（並びは変えない）', () => {
  load(errorBox('確認', '<p>1行目<br>2行目</p><p>3行目</p>'));
  run.msgBoxes();
  expect(Array.from(doc.querySelectorAll('.tcc-msg-box-txt p')).map((p) => p.textContent)).toEqual(['1行目', '2行目', '3行目']);
});

test('アプリが足した案内の行にはしるしを付ける（保存の失敗の知らせには使わない。bridgeJs.ts の errorText）', () => {
  load(FIELDS + errorBox());
  run.msgBoxes();
  expect(doc.querySelector('.myapp-msg-lead')?.textContent).toBe('赤い枠の欄を直してください。');
});

test('エラーの欄の印がダイアログより遅れて付いても、あとから一覧を出す（3 秒までは 0.3 秒ごとに自分で見直す）', async () => {
  load(errorBox());
  run.msgBoxes();
  expect(text()).toBe('入力した内容を確かめてください。');
  // EZCraft が少しあとにエラーの欄に印を付けた（整え直しは起きない。自分の見直しだけで一覧が出る）
  doc.body.insertAdjacentHTML('beforeend', FIELDS);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 350));
  expect(items()).toEqual(['開始時間と終了時間の整合性エラー', '実績時間外に休憩時間が入力されています', '勤務時間とプロジェクトの総時間数が一致していません']);
  expect(doc.querySelector('.myapp-msg-lead')?.textContent).toBe('赤い枠の欄を直してください。');
  // 一覧を出したら、もう触らない
  expect((box() as HTMLElement & { __myappMsgBox?: unknown }).__myappMsgBox).toBe('done');
});

test('知らせのボタンを押した時刻を残す（閉じたあとに EZCraft が欄へ戻すのを、時刻の欄が見分ける）', () => {
  load(errorBox());
  run.msgBoxes();
  const before = Date.now();
  (doc.getElementById('OK1') as HTMLElement).click();
  expect((dom.window as unknown as { __myappMsgBoxClosedAt?: number }).__myappMsgBoxClosedAt).toBeGreaterThanOrEqual(before);
});
