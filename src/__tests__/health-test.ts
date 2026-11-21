// 端末の歩数の記録（ヘルスケア・ヘルスコネクト）から歩数を読む部品の入口（src/platform/health.ts）。
import { requireOptionalNativeModule } from 'expo';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));

type Native = { sourceName?: string; isAvailable: jest.Mock; requestStepsAccess: jest.Mock; stepsOnDay: jest.Mock };

/** 部品（ネイティブ）の有無を決めてから、まっさらに読み込む */
function load(native: Native | null): typeof import('../platform/health') {
  (requireOptionalNativeModule as jest.Mock).mockReturnValue(native);
  let mod!: typeof import('../platform/health');
  jest.isolateModules(() => {
    // まっさらな読み込みは require でしかできない（テストの中の import() は使えない）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../platform/health');
  });
  return mod;
}
function native(): Native {
  return {
    isAvailable: jest.fn(() => true),
    requestStepsAccess: jest.fn(async () => true),
    stepsOnDay: jest.fn(async () => 8234),
  };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

test('部品のない Expo Go では、使えない（歩数は手で打つ）', async () => {
  const health = load(null);
  expect(health.healthAvailable()).toBe(false);
  expect(await health.stepsOn('2026-11-17')).toBeNull();
});

test('呼び名は部品が名乗る（名乗らない・部品がないときはヘルスケア）', () => {
  expect(load(null).healthSourceName()).toBe('ヘルスケア');
  expect(load(native()).healthSourceName()).toBe('ヘルスケア');
  expect(load({ ...native(), sourceName: 'ヘルスコネクト' } ).healthSourceName()).toBe('ヘルスコネクト');
});

test('その日の歩数を返す', async () => {
  const n = native();
  const health = load(n);
  expect(await health.stepsOn('2026-11-17')).toBe(8234);
  expect(n.stepsOnDay).toHaveBeenCalledWith('2026-11-17');
});

test('日付の形が違うものは、部品に渡さない（ページから来る値なので）', async () => {
  const n = native();
  const health = load(n);
  expect(await health.stepsOn('2026/11/17')).toBeNull();
  expect(await health.stepsOn('2026-11-17T00:00')).toBeNull();
  expect(n.stepsOnDay).not.toHaveBeenCalled();
});

test('1週間ぶんを続けて聞いても、許可を求めるのは1回だけ', async () => {
  const n = native();
  const health = load(n);
  await Promise.all(['2026-11-16', '2026-11-17', '2026-11-18'].map((d) => health.stepsOn(d)));
  expect(n.requestStepsAccess).toHaveBeenCalledTimes(1);
  expect(n.stepsOnDay).toHaveBeenCalledTimes(3);
});

test('許可を求めるのに失敗したら、次はもう一度求める', async () => {
  const n = native();
  n.requestStepsAccess.mockRejectedValueOnce(new Error('denied'));
  const health = load(n);
  expect(await health.stepsOn('2026-11-17')).toBeNull();
  expect(await health.stepsOn('2026-11-17')).toBe(8234);
  expect(n.requestStepsAccess).toHaveBeenCalledTimes(2);
});
