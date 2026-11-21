// 入力欄に入れておく値（申請の画面に、勤務表から渡す時刻・理由など）を、短い文字だけにする。
// 値はページから来る（または預けたものを取り出す）ので、長いもの・文字でないものは捨てる
// （src/webview/bridge.ts の apply・applyQueue と、src/shortcuts/launch.ts の近道の指示で使う）。

/** 1つの値の長さの上限 */
export const SHORT_VALUE_MAX = 40;

export function shortValues(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length <= SHORT_VALUE_MAX) out[key] = v;
    }
  }
  return out;
}
