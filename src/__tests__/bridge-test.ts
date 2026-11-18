// ページからアプリへの知らせ（src/webview/bridge.ts の parseBridgeMessage）と、アプリからページへの返事。
// ページから来るものは信用しないので、形の違うものは捨てることを確かめる。
import { healthFlagJs, parseBridgeMessage, stepsReplyJs } from '../webview/bridge';

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
  test('ヘルスケアが使えるときだけ、ページに知らせる', () => {
    expect(healthFlagJs(true)).toContain('window.__myappHealth = true');
    expect(healthFlagJs(false)).toBe('');
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
  test('申請の画面の名前に使えない字があれば捨てる', () => {
    expect(parse({ type: 'apply', form: '../evil', prefill: {} })).toBeNull();
  });
});
