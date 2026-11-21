// 直し（eas update）を、早く届ける。
//
// expo-updates は、そのままでは、アプリを「終わった状態から」起動したときにだけ直しを確かめて受け取り、
// 切り替えるのは、その次にまた終わった状態から起動したとき。iOS はアプリを裏で止めたまま残すので、
// 終わった状態からの起動はめったになく、直しが届くまで何日もかかることがある。
//
// そこで、アプリが前に出てきたときにも確かめて受け取り、開いてすぐ（APPLY_WITHIN_MS のうち）に
// マイアプリにいれば、その場で切り替える（Updates.reloadAsync）。それより遅くなったら、次に前に出てきたときに切り替える。
// 入力の途中や保存の途中に切り替えると、入れたものや保存が消えるので、切り替えてよいかは画面の側が決める（isSafe）。
//
// ここは expo-updates を直接は使わない（テストで動かせるように）。つなぐのは src/useAutoUpdate.ts。

/** 確かめるのは、この長さに1回まで（Expo のサーバーは、頻繁に確かめると制限することがある） */
export const CHECK_EVERY_MS = 30 * 60_000;
/** 前に出てきてから、この長さのうちに受け取れたら、その場で切り替える（使い始めた画面を、急に入れ替えないため） */
export const APPLY_WITHIN_MS = 10_000;

export type AutoUpdateDeps = {
  /** 直しの仕組みが動くか（開発ビルド・Expo Go では動かない） */
  enabled: boolean;
  /** 新しい直しがあるか、サーバーに聞く（受け取りはしない） */
  check: () => Promise<{ isAvailable: boolean }>;
  /** 新しい直しを受け取る */
  fetch: () => Promise<{ isNew: boolean }>;
  /** 受け取った直しに切り替える（アプリの JavaScript を読み直す） */
  reload: () => Promise<void>;
  /** 受け取ってまだ切り替えていない直しがあるか（起動のときに expo-updates が受け取ったものも含む） */
  isPending: () => boolean;
  /** 起動のときの確かめ（expo-updates がする）が、まだ終わっていないか */
  isStartupRunning: () => boolean;
  /** いま切り替えてよいか（マイアプリにいて、保存の途中でない） */
  isSafe: () => boolean;
  now: () => number;
};

export type AutoUpdater = {
  /** アプリが前に出てきたとき（起動したときも）に呼ぶ */
  onActive: () => Promise<void>;
  /** 受け取ってまだ切り替えていない直しができたときに呼ぶ（起動のときに expo-updates が受け取り終えたときなど） */
  onPending: () => Promise<void>;
};

export function createAutoUpdater(d: AutoUpdateDeps): AutoUpdater {
  let activeAt = d.now();
  // 起動のときは expo-updates が確かめるので、そこから数える
  let lastCheckAt = d.now();
  let downloaded = false;
  let busy = false;
  let reloading = false;

  async function apply(): Promise<boolean> {
    if (!d.enabled || reloading) return false;
    if (!downloaded && !d.isPending()) return false;
    if (d.now() - activeAt > APPLY_WITHIN_MS || !d.isSafe()) return false;
    reloading = true;
    try {
      await d.reload();
      return true;
    } catch {
      // 切り替えられなくても、次に前に出てきたとき（または次の起動）に切り替わる
      reloading = false;
      return false;
    }
  }

  return {
    async onActive() {
      if (!d.enabled) return;
      activeAt = d.now();
      if (await apply()) return;
      if (busy || downloaded || d.isPending() || d.isStartupRunning()) return;
      if (d.now() - lastCheckAt < CHECK_EVERY_MS) return;
      lastCheckAt = d.now();
      busy = true;
      try {
        const { isAvailable } = await d.check();
        if (isAvailable) downloaded = (await d.fetch()).isNew;
      } catch {
        // 電波が弱いときなど。次に前に出てきたとき（30 分たっていれば）にまた確かめる
      } finally {
        busy = false;
      }
      await apply();
    },
    async onPending() {
      await apply();
    },
  };
}
