// 時刻を「16:20:01.234」の形にする（開発中のログで、通信の前後を見比べるため）。ほかの部品に頼らない
export function clockOf(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}
