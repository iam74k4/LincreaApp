import { describeLoadError, isIgnorableLoadError } from '../webview/loadErrors';

describe('isIgnorableLoadError（失敗の画面を出さない終わり方）', () => {
  it('iPhone: 取り消し（-999）と、ファイルとして受け取った（102）は失敗ではない', () => {
    expect(isIgnorableLoadError(-999)).toBe(true);
    expect(isIgnorableLoadError(102)).toBe(true);
  });

  it('Android: 取り消しは番号が -1 で、説明が net::ERR_ABORTED', () => {
    expect(isIgnorableLoadError(-1, 'net::ERR_ABORTED')).toBe(true);
  });

  it('ほかは失敗として扱う（番号が -1 でも、説明が違えば失敗）', () => {
    expect(isIgnorableLoadError(-1009)).toBe(false);
    expect(isIgnorableLoadError(-1, 'net::ERR_FAILED')).toBe(false);
    expect(isIgnorableLoadError(-2, 'net::ERR_NAME_NOT_RESOLVED')).toBe(false);
  });
});

describe('describeLoadError（番号を、分かる言葉にする）', () => {
  it('iPhone: 電波がない番号は「インターネットにつながっていません」', () => {
    for (const code of [-1009, -1020, -1018]) {
      expect(describeLoadError(code)).toMatchObject({ icon: 'offline', title: 'インターネットにつながっていません' });
    }
  });

  it('Android: 電波がないと番号は -2 だが、説明が net::ERR_INTERNET_DISCONNECTED なら「つながっていません」', () => {
    expect(describeLoadError(-2, 'net::ERR_INTERNET_DISCONNECTED')).toMatchObject({ icon: 'offline' });
  });

  it('時間切れ: iPhone は -1001、Android は -8（ERROR_TIMEOUT）', () => {
    expect(describeLoadError(-1001)).toMatchObject({ icon: 'server-error', title: 'サーバーの返事がありません' });
    expect(describeLoadError(-8)).toMatchObject({ icon: 'server-error', title: 'サーバーの返事がありません' });
    expect(describeLoadError(-1, 'net::ERR_TIMED_OUT')).toMatchObject({ title: 'サーバーの返事がありません' });
  });

  it('ほかは「サーバーにつながりません」（Android の -2 で電波があるとき = 名前が引けない、も同じ）', () => {
    expect(describeLoadError(-1004)).toMatchObject({ icon: 'server-error', title: 'サーバーにつながりません' });
    expect(describeLoadError(-2, 'net::ERR_NAME_NOT_RESOLVED')).toMatchObject({ title: 'サーバーにつながりません' });
    expect(describeLoadError(-6, 'net::ERR_CONNECTION_REFUSED')).toMatchObject({ title: 'サーバーにつながりません' });
  });

  it('どの失敗にも、もう一度読み込むための案内がある', () => {
    for (const code of [-1009, -1001, -6]) {
      expect(describeLoadError(code).message).toMatch(/もう一度読み込んでください/);
    }
  });
});
