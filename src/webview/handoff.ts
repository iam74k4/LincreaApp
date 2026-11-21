// 画面から画面へ「開いた元のウインドウ」の情報を渡すための、メモリの中の小さな預かり所。
// 画面の引数（URL）に入れるには大きく、個人の情報も入るので、ここに置いて番号だけを渡す。
// 新しいものから決まった数だけ持っておき、古いものから消す。アプリを閉じれば消える（保存はしない）。
// 取り出しても消さないのは、画面が作り直されたとき（開発中の再読み込みなど）にもう一度取り出せるようにするため。
// 消してしまうと、作り直された画面がログインした人などを受け取れず、EZCraft がエラーを出す。
// 番号は推測できないもの（UUID）にする。外からのリンクで、預かったもの（ログインした人の情報）を指せないように。
import { randomUUID } from 'expo-crypto';

/** 開いた元から、開いた先へ渡すもの（どれも JSON の文字列か名前） */
export type Handoff = {
  /** 開いた元の App.data（ログインした人の情報など） */
  appData: string | null;
  /** EZCraft が開いた先のウインドウに付ける名前（開いた先は、この名前で自分あての引数を探す） */
  name: string | null;
  /** 開いた元が setParam で渡した引数（勤怠の日付など） */
  params: string | null;
};

const store = new Map<string, Handoff>();
const KEEP = 8; // 持っておく数（画面を重ねる深さより多く。1つが数百 KB になることがあるので、多くは持たない）
export function depositHandoff(handoff: Handoff): string {
  const id = randomUUID();
  store.set(id, handoff);
  // Map は入れた順に並ぶので、先頭がいちばん古い
  while (store.size > KEEP) store.delete(store.keys().next().value as string);
  return id;
}

export function takeHandoff(id: string | undefined): Handoff | null {
  if (!id) return null;
  return store.get(id) ?? null;
}

/** ログアウトしたとき: すべて捨てる（ログインした人の情報が入っている） */
export function forgetAllHandoffs(): void {
  store.clear();
}
