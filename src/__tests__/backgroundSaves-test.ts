// 保存の受付（src/webview/backgroundSaves.ts）。保存はアプリ全体で1つずつ・裏に回した保存の知らせと、終わったときの合図。
import {
  afterForegroundSave,
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
  noteScreenPage,
  savingInForeground,
  savingSamePage,
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
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
  expect(savingElsewhere('dtl-2')).toBe(true);
  expect(savingElsewhere('dtl-1')).toBe(false);
  endSave('dtl-1', true);
  expect(savingElsewhere('dtl-2')).toBe(false);
});

test('画面の前で終わった保存は、上の知らせを出さず、戻った先の画面にも合図しない', () => {
  const done = jest.fn();
  const off = onBackgroundSaveDone(done);
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
  endSave('dtl-1', true);
  expect(savesSnapshot().banner).toBeNull();
  expect(done).not.toHaveBeenCalled();
  off();
});

test('裏に回した保存: 進み具合を知らせに出し、戻った先の画面は終わるまで待つ', () => {
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
  moveSaveToBackground('dtl-1', 'list-1');
  expect(backgroundSavePendingFor('list-1')).toBe(true);
  expect(backgroundSavePendingFor('other')).toBe(false);
  updateSave('dtl-1', '保存しています（3/9）');
  expect(savesSnapshot().banner).toMatchObject({ state: 'saving', text: '保存しています（3/9）', background: true });
});

test('裏の保存が終わったら、戻った先の画面に合図し、「保存しました」を少しのあいだ出す', () => {
  const done = jest.fn();
  const off = onBackgroundSaveDone(done);
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
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
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
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
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
  endSave('dtl-2', true);
  expect(savingElsewhere('dtl-2')).toBe(true);
});

test('裏の保存が終わったときの合図に、押したボタンの名前と戻った先の画面が付く（戻った先が読み直すのに使う）', () => {
  const done = jest.fn();
  const off = onBackgroundSaveDone(done);
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '削除', null);
  moveSaveToBackground('dtl-1', 'list-1');
  endSave('dtl-1', true);
  expect(done).toHaveBeenCalledTimes(1);
  expect(done.mock.calls[0][0]).toMatchObject({ label: '削除', parentKey: 'list-1', state: 'done' });
  expect(done.mock.calls[0][1]).toBe(true);
  // 合図のときには、もう保存は受付から外れている（戻った先は、待たずに読み直せる）
  expect(backgroundSavePendingFor('list-1')).toBe(false);
  off();
});

test('同じ日のページを裏で保存しているあいだは、あとから開いた同じ日の画面に知らせる（ほかの日・前で保存中は知らせない）', () => {
  const day14 = 'frmAttendanceDtl|{"work_dt":"2026/11/14"}';
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', day14);
  // まだ前で保存している（同じ日の画面を、ほかに開くことはできない）
  expect(savingSamePage(day14, 'dtl-2')).toBe(false);
  moveSaveToBackground('dtl-1', 'list-1');
  expect(savingSamePage(day14, 'dtl-2')).toBe(true);
  expect(savingSamePage(day14, 'dtl-1')).toBe(false);
  expect(savingSamePage('frmAttendanceDtl|{"work_dt":"2026/11/15"}', 'dtl-2')).toBe(false);
  expect(savingSamePage(null, 'dtl-2')).toBe(false);
  endSave('dtl-1', true);
  expect(savingSamePage(day14, 'dtl-2')).toBe(false);
});

test('裏で続けている画面が、続けてもう1回保存を始めても、裏のまま（戻った先に知らせ、上の知らせも終わりに変わる）', () => {
  const done = jest.fn();
  const off = onBackgroundSaveDone(done);
  beginSave('dtl-1', '残業申請', '保存しています（0/9）', '申請', null);
  moveSaveToBackground('dtl-1', 'list-1');
  // 1回目の確定が終わっても、裏の画面は、ページが閉じるのを待っている（まだ endSave しない。EzcraftWebView の finishSave）。
  // そのあいだに、2回に分けて確定するフォームが、もう1回保存を始めた
  beginSave('dtl-1', '残業申請', '保存しています（0/9）', '申請', null);
  expect(savesSnapshot().current).toMatchObject({ id: 'dtl-1', background: true, parentKey: 'list-1', state: 'saving' });
  expect(savesSnapshot().banner).toMatchObject({ id: 'dtl-1', state: 'saving' });
  expect(backgroundSavePendingFor('list-1')).toBe(true);
  endSave('dtl-1', true);
  expect(done).toHaveBeenCalledTimes(1);
  expect(savesSnapshot().banner).toMatchObject({ id: 'dtl-1', state: 'done' });
  off();
});

test('前で保存していた画面が、続けて保存を始めたときは、前のまま（知らせは出さない）', () => {
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
  expect(savesSnapshot().current).toMatchObject({ background: false, parentKey: null });
  expect(savesSnapshot().banner).toBeNull();
  endSave('dtl-1', true);
});

describe('見えている画面の保存のあいだは、アプリが自分で画面を開かない（重ねると、iOS がそのページを止めて保存が切れる）', () => {
  test('保存していなければ、すぐ開く', () => {
    const open = jest.fn();
    afterForegroundSave(open);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('見えている画面の保存が終わってから、少し待って（ページが自分で閉じるのを待つ）1回だけ開く', () => {
    const open = jest.fn();
    beginSave('dtl-2', '勤怠実績登録', '保存しています（0/9）', '登録', null);
    expect(savingInForeground()).toBe(true);
    afterForegroundSave(open);
    updateSave('dtl-2', '保存しています（3/9）');
    expect(open).not.toHaveBeenCalled();
    endSave('dtl-2', true);
    expect(open).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(open).toHaveBeenCalledTimes(1);
    beginSave('dtl-3', '勤怠実績登録', '保存しています（0/9）', '登録', null);
    endSave('dtl-3', true);
    jest.advanceTimersByTime(1000);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('保存が裏に回ったときも、画面の入れ替えが済んでから開く（すぐ開くと、入れ替えで消えていた）', () => {
    const open = jest.fn();
    beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
    afterForegroundSave(open);
    moveSaveToBackground('dtl-1', 'list-1');
    expect(savingInForeground()).toBe(false);
    expect(open).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('裏で続けている保存は待たない（見えている画面は止まらない）', () => {
    const open = jest.fn();
    beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
    moveSaveToBackground('dtl-1', 'list-1');
    expect(savingInForeground()).toBe(false);
    jest.advanceTimersByTime(1000);
    afterForegroundSave(open);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('ログアウトしたら、待っていた画面は開かない', () => {
    const open = jest.fn();
    beginSave('dtl-2', '勤怠実績登録', '保存しています（0/9）', '登録', null);
    afterForegroundSave(open);
    resetSaves();
    jest.advanceTimersByTime(5000);
    expect(open).not.toHaveBeenCalled();
  });

  test('待つのをやめたら、開かない', () => {
    const open = jest.fn();
    beginSave('dtl-2', '勤怠実績登録', '保存しています（0/9）', '登録', null);
    const cancel = afterForegroundSave(open);
    cancel();
    endSave('dtl-2', true);
    jest.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
  });
});

test('裏に回した保存は、戻った先がどのページかと、始めた時刻を覚える（戻った先を閉じて開き直した画面も、終わったら新しくするため）', () => {
  jest.setSystemTime(new Date(2026, 10, 22, 10, 0, 0));
  const page = 'https://example.test/runapp/L_Tims/frmAttendance/';
  const forget = noteScreenPage('list-1', page);
  const done = jest.fn();
  const off = onBackgroundSaveDone(done);
  beginSave('dtl-1', '勤怠実績登録', '保存しています（0/9）', '登録', null);
  moveSaveToBackground('dtl-1', 'list-1');
  // 戻った先の画面を閉じても、覚えたページはそのまま（開き直した同じページの画面と見比べる）
  forget();
  endSave('dtl-1', true);
  expect(done).toHaveBeenCalledWith(
    expect.objectContaining({ parentKey: 'list-1', parentPage: page, startedAt: new Date(2026, 10, 22, 10, 0, 0).getTime() }),
    true,
  );
  off();
});
