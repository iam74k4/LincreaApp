import { daysInMonth, isProbablyOff, keepRecentMonths, planReminders, unregisteredDays } from '../attendanceSchedule';

/** 1か月分の状態を作る（土日は休日。code(日) が返せばその状態、返さなければ registeredUntil の日までは登録済み、そのあとは未登録） */
function month(year: number, m: number, registeredUntil: number, code: (day: number) => string | undefined = () => undefined): string {
  let out = '';
  for (let day = 1; day <= daysInMonth(`${year}-${String(m).padStart(2, '0')}`); day++) {
    const weekday = new Date(year, m - 1, day).getDay();
    out += code(day) ?? (weekday === 0 || weekday === 6 ? 'o' : day <= registeredUntil ? 'r' : 'u');
  }
  return out;
}

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const dates = (plan: { at: Date; days: number }[]) => plan.map((r) => `${r.at.getMonth() + 1}/${r.at.getDate()} ${r.at.getHours()}:00 ${r.days}日`);

// 2026年11月: 1日が日曜。23日（月）は勤労感謝の日
const holiday23 = (day: number) => (day === 23 ? 'o' : undefined);

describe('unregisteredDays', () => {
  it('counts known unregistered workdays and expected ones until the day before', () => {
    // 木曜の朝。18日（水）まで登録済み。次の水曜（25日）の時点では 19・20・24 日が未登録のまま（23日は祝日）
    const months = { '2026-11': month(2026, 11, 18, holiday23) };
    expect(unregisteredDays(at(2026, 11, 25, 12), at(2026, 11, 19, 9), months)).toBe(3);
  });

  it('counts unknown future weekdays, but not unknown past days', () => {
    // 何も分からない: 過ぎた日は数えず、今日（水）から先の勤務日（18・19・20・24）だけ数える（23 は勤労感謝の日）
    expect(unregisteredDays(at(2026, 11, 25, 12), at(2026, 11, 18, 13), {})).toBe(4);
  });

  it('counts unregistered days of the month before', () => {
    // 12月1日（火）の朝。11月の 27・30 日と、12月1日（今日）が未登録
    const months = {
      '2026-11': month(2026, 11, 26, holiday23),
      '2026-12': month(2026, 12, 0),
    };
    expect(unregisteredDays(at(2026, 12, 2, 12), at(2026, 12, 1, 9), months)).toBe(3);
  });

  it('does not count registered days ahead (leave taken in advance)', () => {
    // 19・20 日は前もって休暇を登録済み → 25日の時点で未登録なのは 24 日だけ
    const months = { '2026-11': month(2026, 11, 18, (d) => (d === 19 || d === 20 ? 'r' : holiday23(d))) };
    expect(unregisteredDays(at(2026, 11, 25, 12), at(2026, 11, 18, 20), months)).toBe(1);
  });
});

describe('planReminders', () => {
  it('reminds on Wednesdays at 12:00 when 3 or more days are unregistered', () => {
    const months = { '2026-11': month(2026, 11, 18, holiday23) };
    expect(dates(planReminders(at(2026, 11, 19, 9), months))).toEqual(['11/25 12:00 3日', '12/2 12:00 8日', '12/9 12:00 13日', '12/16 12:00 18日']);
  });

  it('skips a Wednesday with fewer than 3 days', () => {
    // 月曜の夜。23日まで登録済み → 25日の時点では 24 日だけ。次の週からは知らせる
    const months = { '2026-11': month(2026, 11, 23, holiday23) };
    expect(dates(planReminders(at(2026, 11, 23, 20), months))[0]).toBe('12/2 12:00 6日');
  });

  it('includes today when it is Wednesday before noon', () => {
    // 水曜の朝。13・16・17 日が未登録
    const months = { '2026-11': month(2026, 11, 12, (d) => (d === 18 ? 'u' : holiday23(d))) };
    expect(dates(planReminders(at(2026, 11, 18, 10), months))[0]).toBe('11/18 12:00 3日');
  });

  it('starts from next week when it is Wednesday after noon', () => {
    const months = { '2026-11': month(2026, 11, 12, holiday23) };
    expect(dates(planReminders(at(2026, 11, 18, 12, 1), months))[0]).toBe('11/25 12:00 7日');
  });

  it('plans 4 weeks ahead at most', () => {
    expect(planReminders(at(2026, 11, 19, 9), {})).toHaveLength(4);
  });
});

describe('keepRecentMonths', () => {
  it('keeps only the newest months', () => {
    expect(Object.keys(keepRecentMonths({ '2026-12': 'x', '2026-09': 'x', '2026-11': 'x', '2026-10': 'x' }, 3))).toEqual(['2026-10', '2026-11', '2026-12']);
  });
});

describe('daysInMonth', () => {
  it('knows leap years', () => {
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2026-11')).toBe(30);
  });
});

describe('isProbablyOff: まだ勤務表を見ていない日を、勤務日と見込むか', () => {
  const off = (y: number, m: number, d: number) => isProbablyOff(new Date(y, m - 1, d));
  test.each([
    ['元日', 2027, 1, 1],
    ['年末年始（1/3）', 2027, 1, 4 - 1],
    ['年末（12/29）', 2026, 12, 29],
    ['成人の日（2027 年は 1/11）', 2027, 1, 11],
    ['春分の日（2027 年は 3/21 の日曜 → 3/22 が振替休日）', 2027, 3, 22],
    ['昭和の日', 2027, 4, 29],
    ['こどもの日', 2027, 5, 5],
    ['海の日（2027 年は 7/19）', 2027, 7, 19],
    ['敬老の日（2026 年は 9/21）', 2026, 9, 21],
    ['国民の休日（2026 年 9/22。敬老の日と秋分の日のあいだ）', 2026, 9, 22],
    ['秋分の日（2026 年は 9/23）', 2026, 9, 23],
    ['勤労感謝の日', 2026, 11, 23],
    ['土曜', 2026, 11, 21],
  ])('%s は休み', (_, y, m, d) => {
    expect(off(y, m, d)).toBe(true);
  });
  test.each([
    ['ふつうの平日', 2026, 11, 19],
    ['1/4（仕事始め）', 2027, 1, 4],
    ['12/28', 2026, 12, 28],
  ])('%s は勤務日', (_, y, m, d) => {
    expect(off(y, m, d)).toBe(false);
  });
});

test('年始の水曜: まだ見ていない 1 月の祝日と年末年始は、未登録に数えない', () => {
  // 2027/1/6（水）。12 月は全部登録済み。1 月はまだ見ていない（1/1〜1/3 は年始、1/4・1/5 は勤務日）
  const months = { '2026-12': 'r'.repeat(31) };
  expect(unregisteredDays(new Date(2027, 0, 6, 12), new Date(2026, 11, 20, 9), months)).toBe(2);
});
