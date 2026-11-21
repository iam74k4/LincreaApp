// 直しを早く届ける仕組み（src/autoUpdate.ts）。前に出てきたときに確かめて受け取り、開いてすぐマイアプリにいれば切り替える。
import { APPLY_WITHIN_MS, CHECK_EVERY_MS, createAutoUpdater, type AutoUpdateDeps } from '../autoUpdate';

const MIN = 60_000;

function setup(over: Partial<AutoUpdateDeps> = {}) {
  let now = 1_000_000;
  const env = { pending: false, startup: false, safe: true, available: true, isNew: true };
  const deps = {
    check: jest.fn(async () => ({ isAvailable: env.available })),
    fetch: jest.fn(async () => ({ isNew: env.isNew })),
    reload: jest.fn(async (): Promise<void> => {}),
  };
  const updater = createAutoUpdater({
    enabled: true,
    ...deps,
    isPending: () => env.pending,
    isStartupRunning: () => env.startup,
    isSafe: () => env.safe,
    now: () => now,
    ...over,
  });
  const pass = (ms: number) => {
    now += ms;
  };
  return { updater, deps, env, pass };
}

test('起動したすぐあとは、自分では確かめない（起動のときは expo-updates が確かめる）', async () => {
  const { updater, deps } = setup();
  await updater.onActive();
  expect(deps.check).not.toHaveBeenCalled();
  expect(deps.reload).not.toHaveBeenCalled();
});

test('30 分たってから前に出てきたら確かめ、新しい直しを受け取って、マイアプリにいればその場で切り替える', async () => {
  const { updater, deps, pass } = setup();
  pass(CHECK_EVERY_MS);
  await updater.onActive();
  expect(deps.check).toHaveBeenCalledTimes(1);
  expect(deps.fetch).toHaveBeenCalledTimes(1);
  expect(deps.reload).toHaveBeenCalledTimes(1);
});

test('確かめるのは 30 分に1回まで', async () => {
  const { updater, deps, env, pass } = setup();
  env.available = false;
  pass(CHECK_EVERY_MS);
  await updater.onActive();
  pass(CHECK_EVERY_MS - MIN);
  await updater.onActive();
  expect(deps.check).toHaveBeenCalledTimes(1);
  pass(MIN);
  await updater.onActive();
  expect(deps.check).toHaveBeenCalledTimes(2);
  expect(deps.fetch).not.toHaveBeenCalled();
});

test('新しい直しがなければ、受け取らず、切り替えない', async () => {
  const { updater, deps, env, pass } = setup();
  env.available = false;
  pass(CHECK_EVERY_MS);
  await updater.onActive();
  expect(deps.fetch).not.toHaveBeenCalled();
  expect(deps.reload).not.toHaveBeenCalled();
});

test('入力や保存の途中（マイアプリにいない・保存している）なら、受け取っても切り替えず、次に前に出てきたときにマイアプリなら切り替える', async () => {
  const { updater, deps, env, pass } = setup();
  env.safe = false;
  pass(CHECK_EVERY_MS);
  await updater.onActive();
  expect(deps.fetch).toHaveBeenCalledTimes(1);
  expect(deps.reload).not.toHaveBeenCalled();

  // まだマイアプリでない: 切り替えず、もう受け取ってあるので確かめ直しもしない
  pass(CHECK_EVERY_MS);
  await updater.onActive();
  expect(deps.reload).not.toHaveBeenCalled();
  expect(deps.check).toHaveBeenCalledTimes(1);

  env.safe = true;
  pass(MIN);
  await updater.onActive();
  expect(deps.reload).toHaveBeenCalledTimes(1);
  expect(deps.check).toHaveBeenCalledTimes(1);
});

test('受け取るのに時間がかかって、前に出てきてから 10 秒を過ぎたら、その場では切り替えない（使い始めた画面を急に入れ替えない）', async () => {
  let pass: (ms: number) => void = () => {};
  const t = setup({
    fetch: jest.fn(async () => {
      pass(APPLY_WITHIN_MS + 1);
      return { isNew: true };
    }),
  });
  pass = t.pass;
  t.pass(CHECK_EVERY_MS);
  await t.updater.onActive();
  expect(t.deps.reload).not.toHaveBeenCalled();
  await t.updater.onActive();
  expect(t.deps.reload).toHaveBeenCalledTimes(1);
});

test('起動のときに expo-updates が受け取り終えたら、開いてすぐならその場で切り替える', async () => {
  const { updater, deps, env, pass } = setup();
  env.startup = true;
  await updater.onActive();
  pass(3000);
  env.startup = false;
  env.pending = true;
  await updater.onPending();
  expect(deps.reload).toHaveBeenCalledTimes(1);
  expect(deps.check).not.toHaveBeenCalled();
});

test('起動のときの受け取りが遅く終わったら、次に前に出てきたときに切り替える（確かめ直さない）', async () => {
  const { updater, deps, env, pass } = setup();
  await updater.onActive();
  pass(APPLY_WITHIN_MS + 1);
  env.pending = true;
  await updater.onPending();
  expect(deps.reload).not.toHaveBeenCalled();
  pass(CHECK_EVERY_MS);
  await updater.onActive();
  expect(deps.reload).toHaveBeenCalledTimes(1);
  expect(deps.check).not.toHaveBeenCalled();
});

test('起動のときの確かめが終わっていないあいだは、自分では確かめない', async () => {
  const { updater, deps, env, pass } = setup();
  env.startup = true;
  pass(CHECK_EVERY_MS);
  await updater.onActive();
  expect(deps.check).not.toHaveBeenCalled();
});

test('つながらなくて確かめられなくても止まらず、30 分たったらまた確かめる', async () => {
  const { updater, deps, pass } = setup();
  deps.check.mockRejectedValueOnce(new Error('offline'));
  pass(CHECK_EVERY_MS);
  await expect(updater.onActive()).resolves.toBeUndefined();
  expect(deps.reload).not.toHaveBeenCalled();
  pass(MIN);
  await updater.onActive();
  expect(deps.check).toHaveBeenCalledTimes(1);
  pass(CHECK_EVERY_MS);
  await updater.onActive();
  expect(deps.check).toHaveBeenCalledTimes(2);
  expect(deps.reload).toHaveBeenCalledTimes(1);
});

test('切り替えに失敗しても、次に前に出てきたときにもう一度切り替える', async () => {
  const { updater, deps, env } = setup();
  env.pending = true;
  deps.reload.mockRejectedValueOnce(new Error('reload failed'));
  await updater.onActive();
  await updater.onActive();
  expect(deps.reload).toHaveBeenCalledTimes(2);
});

test('同じときに2回前に出てきても、確かめるのは1回だけ', async () => {
  const { updater, deps, env, pass } = setup();
  env.available = false;
  pass(CHECK_EVERY_MS);
  await Promise.all([updater.onActive(), updater.onActive()]);
  expect(deps.check).toHaveBeenCalledTimes(1);
});

test('開発ビルド・Expo Go（直しの仕組みが動かない）では、何もしない', async () => {
  const { updater, deps, env, pass } = setup({ enabled: false });
  env.pending = true;
  pass(CHECK_EVERY_MS);
  await updater.onActive();
  await updater.onPending();
  expect(deps.check).not.toHaveBeenCalled();
  expect(deps.reload).not.toHaveBeenCalled();
});
