// 勤怠実績登録の残業の計算（src/webview/timsSkin.ts の OVERTIME_MATH_JS）。ページの中で動く JavaScript を、そのまま動かす。
import { OVERTIME_MATH_JS } from '../webview/timsSkin';

type OvertimeMath = {
  minutesOf: (t: string) => number | null;
  hhmm: (min: number) => string;
  overtimeStart: (end: number, minutes: number, breaks: { from: number; to: number }[]) => number;
};
const m = new Function(`${OVERTIME_MATH_JS}\nreturn { minutesOf: minutesOf, hhmm: hhmm, overtimeStart: overtimeStart };`)() as OvertimeMath;
const t = (s: string) => m.minutesOf(s) as number;

test('時刻を分にする・分を時刻にする（24 時を越えた時刻も）', () => {
  expect(m.minutesOf('9:00')).toBe(540);
  expect(m.minutesOf('2530')).toBe(1530);
  expect(m.minutesOf('')).toBeNull();
  expect(m.hhmm(1530)).toBe('25:30');
  expect(m.hhmm(0)).toBe('0:00');
});

test('負の時刻・数でないものは、空にする（入力欄に「-1:30」を入れない）', () => {
  expect(m.hhmm(-90)).toBe('');
  expect(m.hhmm(NaN)).toBe('');
});

test('休憩がなければ、退勤から残業のぶんだけさかのぼる', () => {
  expect(m.hhmm(m.overtimeStart(t('18:00'), 30, [{ from: t('12:00'), to: t('13:00') }]))).toBe('17:30');
});

test('夕方の休憩は、残業の時間帯に数えずに飛ばす', () => {
  // 9:00〜20:00、休憩 12:00〜13:00 と 18:00〜18:30 → 働いたのは 9:30、残業は 2:00（17:30〜18:00 と 18:30〜20:00）
  const breaks = [{ from: t('12:00'), to: t('13:00') }, { from: t('18:00'), to: t('18:30') }];
  expect(m.hhmm(m.overtimeStart(t('20:00'), 120, breaks))).toBe('17:30');
});

test('退勤のときに休憩中だったら、休憩の始まりから数える', () => {
  expect(m.hhmm(m.overtimeStart(t('18:30'), 30, [{ from: t('18:00'), to: t('19:00') }]))).toBe('17:30');
});

test('日をまたいだ退勤（25:00）も、そのまま数える', () => {
  expect(m.hhmm(m.overtimeStart(t('25:00'), 150, []))).toBe('22:30');
});
