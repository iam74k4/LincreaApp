// ページからアプリへの知らせ（src/webview/bridge.ts の parseBridgeMessage）と、アプリからページへの返事。
// ページから来るものは信用しないので、形の違うものは捨てることを確かめる。
import { allowedFrom, parseBridgeMessage, stepsDayAllowed } from '../webview/bridge';
import { healthFlagJs, stepsReplyJs } from '../webview/page/bridgeJs';

const parse = (message: unknown) => parseBridgeMessage(JSON.stringify(message));

describe('steps: ヘルスケアの歩数をください', () => {
  test('形の合うものだけ通す', () => {
    expect(parse({ type: 'steps', id: 's1abc', day: '2026-11-17' })).toEqual({ type: 'steps', id: 's1abc', day: '2026-11-17' });
  });
  test.each([
    ['日付の形が違う', { type: 'steps', id: 's1', day: '2026/11/17' }],
    ['日付が文字でない', { type: 'steps', id: 's1', day: 20261117 }],
    ['ID に使えない字がある', { type: 'steps', id: "x');alert(1);('", day: '2026-11-17' }],
    ['ID が長すぎる', { type: 'steps', id: 'a'.repeat(41), day: '2026-11-17' }],
  ])('%s ものは捨てる', (_, message) => {
    expect(parse(message)).toBeNull();
  });
});

describe('attendanceDays: 勤務表の日ごとの状態（勤怠登録の通知）', () => {
  test('年月と、1日1文字の状態だけ通す', () => {
    const days = 'oruuuooruuuuo'.padEnd(30, 'u');
    expect(parse({ type: 'attendanceDays', month: '2026-11', days })).toEqual({ type: 'attendanceDays', month: '2026-11', days });
  });
  test.each([
    ['年月の形が違う', { type: 'attendanceDays', month: '2026/11', days: 'u'.repeat(30) }],
    ['ない月', { type: 'attendanceDays', month: '2026-13', days: 'u'.repeat(31) }],
    ['知らない文字', { type: 'attendanceDays', month: '2026-11', days: 'x'.repeat(30) }],
    ['短すぎる', { type: 'attendanceDays', month: '2026-11', days: 'u'.repeat(10) }],
    ['文字でない', { type: 'attendanceDays', month: '2026-11', days: 30 }],
  ])('%s ものは捨てる', (_, message) => {
    expect(parse(message)).toBeNull();
  });
});

describe('stepsReplyJs: 歩数の返事', () => {
  test('数は整数にして、マイナスは 0 にする', () => {
    expect(stepsReplyJs('s1', 8234.4)).toContain('("s1", 8234)');
    expect(stepsReplyJs('s1', -5)).toContain('("s1", 0)');
  });
  test('読めなかったときは null を返す', () => {
    expect(stepsReplyJs('s1', null)).toContain('("s1", null)');
  });
  test('ID は文字列として埋め込む（ページのスクリプトとして動かない）', () => {
    expect(stepsReplyJs('a"b', 1)).toContain('"a\\"b"');
  });
  test('歩数の記録が使えるときだけ、ページに知らせる（呼び名も）', () => {
    expect(healthFlagJs(true)).toContain('window.__myappHealth = true');
    expect(healthFlagJs(true)).toContain('window.__myappHealthName = "ヘルスケア"');
    expect(healthFlagJs(true, 'ヘルスコネクト')).toContain('window.__myappHealthName = "ヘルスコネクト"');
    expect(healthFlagJs(false, 'ヘルスコネクト')).toBe('');
  });
  test('呼び名は文字列として埋め込む（ページのスクリプトとして動かない）', () => {
    expect(healthFlagJs(true, '"; alert(1); "')).toContain('window.__myappHealthName = "\\"; alert(1); \\""');
  });
});

describe('skinMissing: 見た目を直している部品が見つからない（開発中だけ）', () => {
  test('部品 ID の形のものだけ残し、多すぎるときは 200 個まで', () => {
    const ids = ['frmA_lbl1', 'bad id', '<script>', ...Array.from({ length: 300 }, (_, i) => `frmA_x${i}`)];
    const message = parse({ type: 'skinMissing', form: 'frmA', ids });
    expect(message?.type).toBe('skinMissing');
    if (message?.type !== 'skinMissing') return;
    expect(message.ids[0]).toBe('frmA_lbl1');
    expect(message.ids).not.toContain('bad id');
    expect(message.ids).not.toContain('<script>');
    expect(message.ids).toHaveLength(200);
  });
});

describe('そのほかの知らせ', () => {
  test('JSON でないもの・知らない種類は捨てる', () => {
    expect(parseBridgeMessage('not json')).toBeNull();
    expect(parse({ type: 'unknown' })).toBeNull();
  });
  test('ヘッダーの名前は 20 字まで', () => {
    expect(parse({ type: 'title', text: 'あ'.repeat(30) })).toEqual({ type: 'title', text: 'あ'.repeat(20) });
  });
  test('入れておく値は、短い文字だけを通す', () => {
    const message = parse({ type: 'apply', form: 'frmApply_zangyo', prefill: { date: '2026/11/17', note: 'x'.repeat(41), n: 5 }, auto: true });
    expect(message).toEqual({ type: 'apply', form: 'frmApply_zangyo', prefill: { date: '2026/11/17' }, auto: true });
  });
  test('手で入れたパスワードは、文字で 1〜128 字のものだけ', () => {
    expect(parse({ type: 'pwTyped', value: 'abc' })).toEqual({ type: 'pwTyped', value: 'abc' });
    expect(parse({ type: 'pwTyped', value: '' })).toBeNull();
    expect(parse({ type: 'pwTyped', value: 'x'.repeat(129) })).toBeNull();
    expect(parse({ type: 'pwTyped', value: 123 })).toBeNull();
  });
  test('申請の画面の名前に使えない字があれば捨てる', () => {
    expect(parse({ type: 'apply', form: '../evil', prefill: {} })).toBeNull();
  });
});

describe('allowedFrom: アプリごとの知らせは、そのアプリの画面からだけ', () => {
  const steps = { type: 'steps', id: 's1', day: '2026-11-17' } as const;
  const apply = { type: 'apply', form: 'frmApply_zangyo', prefill: {}, auto: false } as const;
  test('歩数は Walk the Talk からだけ', () => {
    expect(allowedFrom(steps, 'YIF_walk_the_talk')).toBe(true);
    expect(allowedFrom(steps, 'L_HealthCare')).toBe(false);
  });
  test('申請・まとめて申請・勤務表の状態は TiMS からだけ', () => {
    expect(allowedFrom(apply, 'L_Tims')).toBe(true);
    expect(allowedFrom(apply, 'L_Payslip')).toBe(false);
    expect(allowedFrom({ type: 'applyQueue', form: 'frmApply_zangyo', items: [{ date: '2026/11/17' }] }, 'YIF_walk_the_talk')).toBe(false);
    expect(allowedFrom({ type: 'attendanceDays', month: '2026-11', days: 'u'.repeat(30) }, 'L_Payslip')).toBe(false);
  });
  test('開いてよいのは申請の画面だけ', () => {
    expect(allowedFrom({ ...apply, form: 'frmAttendanceDtl' }, 'L_Tims')).toBe(false);
  });
  test('明細のパスワードは、給与・賞与明細とだけやりとりする', () => {
    expect(allowedFrom({ type: 'pwFaceId' }, 'L_Payslip')).toBe(true);
    expect(allowedFrom({ type: 'pwFaceId' }, 'L_Tims')).toBe(false);
    expect(allowedFrom({ type: 'pwTyped', value: 'x' }, 'L_Payslip')).toBe(true);
    expect(allowedFrom({ type: 'pwTyped', value: 'x' }, 'YIF_walk_the_talk')).toBe(false);
  });
  test('ほかの知らせは、どのアプリからでも', () => {
    expect(allowedFrom({ type: 'ready' }, 'L_Payslip')).toBe(true);
  });
});

describe('stepsDayAllowed: 歩数を答える日', () => {
  const now = new Date(2026, 10, 19, 10);
  test.each([
    ['今日', '2026-11-19', true],
    ['先週', '2026-11-12', true],
    ['62 日前', '2026-09-18', true],
    ['63 日前', '2026-09-17', false],
    ['明日', '2026-11-20', false],
    ['ない日', '2026-02-30', false],
  ])('%s', (_, day, ok) => {
    expect(stepsDayAllowed(day, now)).toBe(ok);
  });
});
