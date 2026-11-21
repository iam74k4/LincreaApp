// ログインした人の「参照モード」（/user/getRefMode/）の返事の控え。ページの中で答えるのは src/webview/initApp.ts の refModeJs。
//
// EZCraft のページは、どの画面も、開くとまずこれを聞き、返事が来てから画面の定義（initApp）を読む。
// 返事は小さい（20 文字ほど）が、サーバーが答えるのに 0.7〜0.8 秒かかり、画面を開くたびにその分待たされていた
// （2026-11-21 にシミュレーターで測った。勤怠 TiMS・勤務表・勤怠実績登録・残業申請のどれも同じ）。
// 同じログインのあいだは同じ答えなので、1回聞いたら控え、次に開く画面からは通信せずに答える。
//
// 控えはメモリの中だけ（端末には保存しない）。ログイン・ログアウトで捨てる（src/webview/initAppCache.ts の
// forgetInitAppTexts・forgetAllInitApps から呼ぶ）。管理者が設定を変えたときに古い答えを使い続けないよう、30 分で捨てる。

/** 控えておく長さ（画面の定義の控えと同じ） */
const MAX_AGE_MS = 30 * 60 * 1000;
/** 控えておく数（問い合わせの中身ごと。ふつうは 1〜2 個） */
const MAX_ENTRIES = 10;

export type RefModeReply = { text: string; type: string };

const store = new Map<string, RefModeReply & { savedAt: number }>();

/** ページが聞いて得た返事を控える（key は、問い合わせの方法と中身） */
export function rememberRefMode(key: string, reply: RefModeReply, now: number = Date.now()): void {
  store.delete(key);
  store.set(key, { ...reply, savedAt: now });
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
}

/** いま使える控え（古いものは捨てる）。ページに渡す形 */
export function recallRefModes(now: number = Date.now()): Record<string, RefModeReply> {
  const out: Record<string, RefModeReply> = {};
  for (const [key, entry] of store) {
    if (now - entry.savedAt > MAX_AGE_MS) {
      store.delete(key);
      continue;
    }
    out[key] = { text: entry.text, type: entry.type };
  }
  return out;
}

/** ログイン・ログアウトのとき: すべて捨てる（ほかの人の答えを使わないように） */
export function forgetRefModes(): void {
  store.clear();
}
