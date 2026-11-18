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

/**
 * at の時点で、過ぎたのに未登録の勤務日がいくつあるか（now の時点で分かっていることから見込む）。
 * 数えるのは、at の前の月の1日から、at の前の日まで（at の日は、まだ登録していなくてふつうなので数えない）。
 *   - 状態が分かっている日: 未登録の勤務日（u）だけ数える
 *   - 分からない日のうち、今日から先の月〜金: 数える（次の月などで、まだ勤務表を見ていない。このままなら未登録になる）
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
    } else if (day >= today && day.getDay() !== 0 && day.getDay() !== 6) {
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
