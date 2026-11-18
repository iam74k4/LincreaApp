import { describeSaveFailure } from '../webview/saveErrors';

describe('describeSaveFailure', () => {
  it('turns a lock wait timeout into words people can act on', () => {
    const failure = describeSaveFailure('delete error× Lock wait timeout exceeded; try restarting transaction (rowIndex : 1)');
    expect(failure.reason).toBe('ほかの保存と重なって、待ちきれませんでした。');
    expect(failure.next).toBe('数分待ってから、開き直して入力してください。');
    expect(failure.reason).not.toMatch(/[×]|Lock/);
  });

  it('treats a deadlock like a lock wait', () => {
    expect(describeSaveFailure('Deadlock found when trying to get lock').reason).toContain('ほかの保存と重なって');
  });

  it('explains network failures', () => {
    expect(describeSaveFailure('Network request timed out').reason).toBe('通信がうまくいきませんでした。');
  });

  it('says the save was cancelled when the page gave no reason', () => {
    expect(describeSaveFailure(null)).toEqual({ reason: '保存は取り消されました。', next: '開き直して、入力し直してください。' });
    expect(describeSaveFailure('  ×  ').reason).toBe('保存は取り消されました。');
  });

  it('keeps an unknown reason, cleaned and shortened', () => {
    expect(describeSaveFailure('勤怠日が締められています×').reason).toBe('勤怠日が締められています');
    const long = describeSaveFailure('あ'.repeat(120)).reason;
    expect(long).toHaveLength(81);
    expect(long.endsWith('…')).toBe(true);
  });
});
