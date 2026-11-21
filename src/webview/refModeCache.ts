// ログインした人の「参照モード」（/user/getRefMode/）の返事の控え。ページの中で答えるのは src/webview/page/initApp.ts の refModeJs。
//
// EZCraft のページは、どの画面も、開くとまずこれを聞き、返事が来てから画面の定義（initApp）を読む。
// 返事は小さい（20 文字ほど）が、サーバーが答えるのに 0.7〜0.8 秒かかり、画面を開くたびにその分待たされていた
// （2026-11-21 にシミュレーターで測った。勤怠 TiMS・勤務表・勤怠実績登録・残業申請のどれも同じ）。
// 同じログインのあいだは同じ答えなので、1回聞いたら控え、次に開く画面からは通信せずに答える。
//
// 控えはメモリの中だけ（端末には保存しない）。ログイン・ログアウトで捨てる（src/webview/initAppCache.ts の
// forgetInitAppTexts・forgetAllInitApps から呼ぶ）。管理者が設定を変えたときに古い答えを使い続けないよう、30 分で捨てる。
//
// 控えは、返事を受け取ったページのアプリごとに分ける（アプリ X のページが控えた答えを、アプリ Y の画面には渡さない）。
// 同じサイトには、低コードで作られたアプリがいくつも載っている。ほかのアプリが偽の答えを控えさせて、
// 給与明細などの画面の動きを変えられないようにするため。

/** 控えておく長さ（画面の定義の控えと同じ） */
const MAX_AGE_MS = 30 * 60 * 1000;
/** 控えておく数（アプリと問い合わせの中身ごと。ふつうは 1 アプリ 1〜2 個） */
const MAX_ENTRIES = 20;

export type RefModeReply = { text: string; type: string };

/** 名前は「アプリ ID」と「問い合わせの方法と中身」の組（app\u0000key） */
const store = new Map<string, RefModeReply & { savedAt: number }>();
const SEP = '\u0000';

/** アプリ app のページが聞いて得た返事を控える（key は、問い合わせの方法と中身） */
export function rememberRefMode(app: string, key: string, reply: RefModeReply, now: number = Date.now()): void {
  if (!app || app.includes(SEP)) return; // 区切りの文字を含む名前は、ほかのアプリの控えと見分けられないので控えない
  const name = app + SEP + key;
  store.delete(name);
  store.set(name, { ...reply, savedAt: now });
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
}

/** アプリ app の画面に渡せる控え（古いものは捨てる）。ページに渡す形（名前は問い合わせの方法と中身） */
export function recallRefModes(app: string, now: number = Date.now()): Record<string, RefModeReply> {
  const out: Record<string, RefModeReply> = {};
  for (const [name, entry] of store) {
    if (now - entry.savedAt > MAX_AGE_MS) {
      store.delete(name);
      continue;
    }
    const [owner, key] = [name.slice(0, name.indexOf(SEP)), name.slice(name.indexOf(SEP) + 1)];
    if (owner === app) out[key] = { text: entry.text, type: entry.type };
  }
  return out;
}

/** ログイン・ログアウトのとき: すべて捨てる（ほかの人の答えを使わないように） */
export function forgetRefModes(): void {
  store.clear();
}
