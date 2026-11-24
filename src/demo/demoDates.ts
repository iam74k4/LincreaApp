// デモの日付の計算（端末の暦。"yyyy-MM-dd" の文字で扱う）。

const two = (n: number) => String(n).padStart(2, '0');

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** "yyyy-MM-dd" を、その日の 0:00 にする。形が違えば null */
export function parseDay(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return ymd(d) === day ? d : null;
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day) ?? new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** "yyyy-MM" の月の日（1日から月末まで） */
export function daysOfMonth(month: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return [];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const last = new Date(y, mo, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${month}-${two(i + 1)}`);
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** その月から n か月ずらした月 */
export function addMonths(month: string, n: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const d = new Date(Number(m[1]), Number(m[2]) - 1 + n, 1);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function weekdayOf(day: string): number {
  return (parseDay(day) ?? new Date()).getDay();
}

export function isWeekend(day: string): boolean {
  const w = weekdayOf(day);
  return w === 0 || w === 6;
}

/** 「11月24日（火）」 */
export function dayLabel(day: string): string {
  const d = parseDay(day);
  if (!d) return day;
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 「2026年11月」 */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  return m ? `${m[1]}年${Number(m[2])}月` : month;
}
