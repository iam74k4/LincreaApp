// 保存の受付（src/webview/backgroundSaves.ts）。保存はアプリ全体で1つずつ・裏に回した保存の知らせと、終わったときの合図。
import {
  attachApply,
  backgroundSavePendingFor,
  beginSave,
  dismissBanner,
  endSave,
  moveSaveToBackground,
  onBackgroundSaveDone,
  resetSaves,
  savesSnapshot,
  savingElsewhere,
  updateSave,
} from '../webview/backgroundSaves';

beforeEach(() => {
  jest.useFakeTimers();
  resetSaves();
});
afterEach(() => {
  jest.useRealTimers();
});

test('保存しているあいだは、ほかの画面の保存を待たせる（その画面は待たない）', () => {
  expect(savingElsewhere('dtl-2')).toBe(false);
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）');
  expect(savingElsewhere('dtl-2')).toBe(true);
  expect(savingElsewhere('dtl-1')).toBe(false);
  endSave('dtl-1', true);
  expect(savingElsewhere('dtl-2')).toBe(false);
});

test('画面の前で終わった保存は、上の知らせを出さず、戻った先の画面にも合図しない', () => {
  const done = jest.fn();
  const off = onBackgroundSaveDone(done);
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）');
  endSave('dtl-1', true);
  expect(savesSnapshot().banner).toBeNull();
  expect(done).not.toHaveBeenCalled();
  off();
});

test('裏に回した保存: 進み具合を知らせに出し、戻った先の画面は終わるまで待つ', () => {
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）');
  moveSaveToBackground('dtl-1', 'list-1');
  expect(backgroundSavePendingFor('list-1')).toBe(true);
  expect(backgroundSavePendingFor('other')).toBe(false);
  updateSave('dtl-1', '保存しています（3/9）');
  expect(savesSnapshot().banner).toMatchObject({ state: 'saving', text: '保存しています（3/9）', background: true });
});

test('裏の保存が終わったら、戻った先の画面に合図し、「保存しました」を少しのあいだ出す', () => {
  const done = jest.fn();
  const off = onBackgroundSaveDone(done);
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）');
  moveSaveToBackground('dtl-1', 'list-1');
  attachApply('dtl-1', { form: 'frmApply_zangyo', prefill: { date: '2026/11/18' } });
  endSave('dtl-1', true);
  expect(done).toHaveBeenCalledWith(expect.objectContaining({ parentKey: 'list-1', state: 'done' }), true);
  expect(backgroundSavePendingFor('list-1')).toBe(false);
  expect(savesSnapshot().banner).toMatchObject({ state: 'done', apply: { form: 'frmApply_zangyo' } });
  jest.advanceTimersByTime(4000);
  expect(savesSnapshot().banner).toBeNull();
  off();
});

test('裏の保存に失敗したら、理由と開き直す行き先を知らせに出す（閉じるボタンで消せる）', () => {
  const done = jest.fn();
  const off = onBackgroundSaveDone(done);
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）');
  moveSaveToBackground('dtl-1', 'list-1');
  const reopen = { pathname: '/run/[app]/[form]', params: { app: 'L_Tims', form: 'frmAttendanceDtl' } };
  endSave('dtl-1', false, { error: 'エラー Lock wait timeout exceeded', reopen });
  expect(done).toHaveBeenCalledWith(expect.objectContaining({ state: 'failed' }), false);
  expect(savesSnapshot().banner).toMatchObject({ state: 'failed', error: 'エラー Lock wait timeout exceeded', reopen });
  jest.advanceTimersByTime(5000);
  expect(savesSnapshot().banner).not.toBeNull(); // 開き直すボタンを押せるように、すぐには消さない
  dismissBanner();
  expect(savesSnapshot().banner).toBeNull();
  off();
});

test('ほかの画面の終わりの知らせでは、いまの保存を終わらせない', () => {
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）');
  endSave('dtl-2', true);
  expect(savingElsewhere('dtl-2')).toBe(true);
});
