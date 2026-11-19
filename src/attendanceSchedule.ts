// 勤怠登録の通知（src/attendanceReminder.ts）の、いつ・何日ぶんで知らせるかの計算。
// 端末の部品を使わない計算だけを置く（テストできるように）。

/**
 * 月（'2026-11'）ごとの、日ごとの状態。1日1文字で、1日から順に並べる（勤務表のページが知らせる。src/webview/timsSkin.ts の reportDays）
 *   u: 未登録の勤務日  o: 休日  r: 登録した日（休暇も）  -: 分からない
 */
export type AttendanceDays = Record<string, string>;

/** 未登録の勤務日がこれだけあれば知らせる */
export const REMINDER_MIN_DAYS = 3;
/** 先の何週ぶんまで予約するか（アプリを開かなくても、この回数は届く） */
export const REMINDER_WEEKS = 4;
/** 知らせる曜日（0: 日曜 … 3: 水曜）と時刻 */
const REMINDER_WEEKDAY = 3;
const REMINDER_HOUR = 12;

/** 予約する通知: 知らせる時刻と、そのときの未登録の勤務日の数 */
export type Reminder = { at: Date; days: number };

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** その月の日数（'2026-02' → 28） */
export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 0).getDate();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// ---- 日本の祝日（まだ勤務表を見ていない日を見込むときに使う。勤務表を見た日は、勤務表の「休日」に従う） ----

/** その月の n 回目の月曜日（ハッピーマンデー） */
function nthMonday(year: number, month: number, n: number): number {
  const first = new Date(year, month - 1, 1).getDay();
  return 1 + ((8 - first) % 7) + (n - 1) * 7;
}

/** 春分の日・秋分の日（1980〜2099 年に使える、よく知られた式） */
function equinox(year: number, base: number): number {
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/** その年の、法律で決まっている祝日（振替休日・国民の休日の前。'M-D' の集まり） */
function fixedHolidays(year: number): Set<string> {
  const days: [number, number][] = [
    [1, 1],
    [1, nthMonday(year, 1, 2)], // 成人の日
    [2, 11],
    [2, 23], // 天皇誕生日
    [3, equinox(year, 20.8431)], // 春分の日
    [4, 29],
    [5, 3],
    [5, 4],
    [5, 5],
    [7, nthMonday(year, 7, 3)], // 海の日
    [8, 11], // 山の日
    [9, nthMonday(year, 9, 3)], // 敬老の日
    [9, equinox(year, 23.2488)], // 秋分の日
    [10, nthMonday(year, 10, 2)], // スポーツの日
    [11, 3],
    [11, 23],
  ];
  return new Set(days.map(([m, d]) => `${m}-${d}`));
}

const holidayCache = new Map<number, Set<string>>();

/** その年の祝日・振替休日・国民の休日（'M-D' の集まり） */
function holidaysOf(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const base = fixedHolidays(year);
  const key = (d: Date) => `${d.getMonth() + 1}-${d.getDate()}`;
  const all = new Set(base);
  for (const k of base) {
    const [m, d] = k.split('-').map(Number);
    const day = new Date(year, m - 1, d);
    // 振替休日: 日曜の祝日のあと、祝日でない最初の日
    if (day.getDay() === 0) {
      const next = new Date(year, m - 1, d + 1);
      while (base.has(key(next))) next.setDate(next.getDate() + 1);
      if (next.getFullYear() === year) all.add(key(next));
    }
    // 国民の休日: 祝日にはさまれた平日（9 月の敬老の日と秋分の日のあいだなど）
    const after = new Date(year, m - 1, d + 2);
    const between = new Date(year, m - 1, d + 1);
    if (base.has(key(after)) && !base.has(key(between)) && between.getDay() !== 0) all.add(key(between));
  }
  holidayCache.set(year, all);
  return all;
}

/**
 * 勤務日でないと見込む日: 土日・祝日と、年末年始（12/29〜1/3。多くの会社の休み）。
 * まだ勤務表を見ていない日だけに使う（会社の休みが違っても、勤務表を見れば勤務表の「休日」に従う）
 */
export function isProbablyOff(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return true;
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if ((m === 12 && d >= 29) || (m === 1 && d <= 3)) return true;
  return holidaysOf(date.getFullYear()).has(`${m}-${d}`);
}

/**
 * at の時点で、過ぎたのに未登録の勤務日がいくつあるか（now の時点で分かっていることから見込む）。
 * 数えるのは、at の前の月の1日から、at の前の日まで（at の日は、まだ登録していなくてふつうなので数えない）。
 *   - 状態が分かっている日: 未登録の勤務日（u）だけ数える
 *   - 分からない日のうち、今日から先の勤務日（土日・祝日・年末年始を除く）: 数える（次の月などで、まだ勤務表を見ていない。このままなら未登録になる）
 *   - 分からない日のうち、過ぎた日: 数えない
 */
export function unregisteredDays(at: Date, now: Date, months: AttendanceDays): number {
  const today = startOfDay(now);
  const end = startOfDay(at);
  let count = 0;
  for (let day = new Date(at.getFullYear(), at.getMonth() - 1, 1); day < end; day.setDate(day.getDate() + 1)) {
    const code = months[monthKey(day)]?.[day.getDate() - 1];
    if (code && code !== '-') {
      if (code === 'u') count += 1;
    } else if (day >= today && !isProbablyOff(day)) {
      count += 1;
    }
  }
  return count;
}

/** これからの水曜 12:00（先の REMINDER_WEEKS 回）のうち、未登録の勤務日が REMINDER_MIN_DAYS 日以上になるもの。近い順 */
export function planReminders(now: Date, months: AttendanceDays): Reminder[] {
  const ahead = (REMINDER_WEEKDAY - now.getDay() + 7) % 7;
  let first = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead, REMINDER_HOUR);
  if (first <= now) first = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7, REMINDER_HOUR);
  const plan: Reminder[] = [];
  for (let week = 0; week < REMINDER_WEEKS; week++) {
    const at = new Date(first.getFullYear(), first.getMonth(), first.getDate() + week * 7, REMINDER_HOUR);
    const days = unregisteredDays(at, now, months);
    if (days >= REMINDER_MIN_DAYS) plan.push({ at, days });
  }
  return plan;
}

/** 覚えておく月を、新しいほうから keep か月ぶんだけにする（数えるのは、知らせる日の前の月からなので、古い月は使わない） */
export function keepRecentMonths(months: AttendanceDays, keep: number): AttendanceDays {
  const recent = Object.keys(months).sort().slice(-keep);
  return Object.fromEntries(recent.map((month) => [month, months[month]]));
}
