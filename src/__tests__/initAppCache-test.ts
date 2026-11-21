// 画面の定義（initApp）を裏で読んでおく仕組み（src/webview/initAppCache.ts の prefetchInitApps）。
// 近道の下準備のページが読んで控えた定義は読み直さない・1つ読めなくても次は読む・止められたらやめる。
import AsyncStorage from '@react-native-async-storage/async-storage';

import { landedOnLogin, serverFetch } from '../api/http';
import { forgetAllInitApps, prefetchInitApps, recallInitApp, rememberInitApp, stopPrefetchInitApps } from '../webview/initAppCache';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api/http', () => ({
  serverFetch: jest.fn(),
  landedOnLogin: jest.fn(() => false),
}));
const mockedFetch = serverFetch as jest.MockedFunction<typeof serverFetch>;
const mockedLanded = landedOnLogin as jest.MockedFunction<typeof landedOnLogin>;

/** 画面の定義らしい中身（looksLikeInitApp が受け付けるもの） */
const DEFINITION = `/* <![CDATA[ */ ${'x'.repeat(1200)}`;
const MENU = { app: 'L_Tims', form: 'frmLTiMSTop', id: 'top1' };
const TIMESHEET = { app: 'L_Tims', form: 'frmAttendance', id: 'att1' };
const OVERTIME = { app: 'L_Tims', form: 'frmApply_zangyo', id: 'ot1' };

type Res = Awaited<ReturnType<typeof serverFetch>>;
const reply = (status: number, text = DEFINITION) => ({ ok: status >= 200 && status < 300, status, url: 'https://x.test/RunApp/initApp/', text: async () => text }) as unknown as Res;
const formOf = (url: string) => /formid=([^&]+)/.exec(url)?.[1];

async function recent(...forms: { app: string; form: string; id: string }[]) {
  // 新しく使った順に並ぶ（usedAt の大きい順）
  await AsyncStorage.setItem('initApp.recent', JSON.stringify(forms.map((f, i) => ({ ...f, usedAt: 100 - i }))));
}

beforeEach(async () => {
  forgetAllInitApps();
  await AsyncStorage.clear();
  mockedFetch.mockReset();
  mockedLanded.mockReturnValue(false);
});

test('近道の下準備のページが控えた定義（同じ ID）は、読み直さない', async () => {
  await recent(MENU, TIMESHEET);
  rememberInitApp(MENU, MENU.id, DEFINITION);
  mockedFetch.mockResolvedValue(reply(200));
  await prefetchInitApps();
  expect(mockedFetch.mock.calls.map(([url]) => formOf(url))).toEqual(['frmAttendance']);
  expect(recallInitApp(TIMESHEET)?.id).toBe('att1');
});

test('1つ読めなくても（500。覚えていた ID が古いときなど）、次の画面は読む', async () => {
  await recent(MENU, TIMESHEET, OVERTIME);
  mockedFetch.mockImplementation(async (url) => (formOf(url) === 'frmLTiMSTop' ? reply(500, 'error') : reply(200)));
  await prefetchInitApps();
  expect(mockedFetch).toHaveBeenCalledTimes(3);
  expect(recallInitApp(MENU)).toBeNull();
  expect(recallInitApp(TIMESHEET)?.id).toBe('att1');
  expect(recallInitApp(OVERTIME)?.id).toBe('ot1');
});

test('ログインが切れていたら、そこでやめる', async () => {
  await recent(MENU, TIMESHEET);
  mockedFetch.mockResolvedValue(reply(200));
  mockedLanded.mockReturnValue(true);
  await prefetchInitApps();
  expect(mockedFetch).toHaveBeenCalledTimes(1);
});

test('止めたら（マイアプリから離れた）、読んでいる途中のものも取りやめ、次は読まない', async () => {
  await recent(MENU, TIMESHEET);
  mockedFetch.mockImplementation(
    (_url, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('canceled')));
      }),
  );
  const running = prefetchInitApps();
  await new Promise((r) => setTimeout(r, 0)); // 1つめを頼むところまで進める
  expect(mockedFetch).toHaveBeenCalledTimes(1);
  stopPrefetchInitApps();
  await running;
  expect(mockedFetch).toHaveBeenCalledTimes(1);
  expect(recallInitApp(MENU)).toBeNull();
});

test('止めたあとは、また始められる', async () => {
  await recent(MENU);
  mockedFetch.mockImplementation(
    (_url, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('canceled')));
      }),
  );
  const first = prefetchInitApps();
  await new Promise((r) => setTimeout(r, 0));
  stopPrefetchInitApps();
  await first;
  mockedFetch.mockResolvedValue(reply(200));
  await prefetchInitApps();
  expect(recallInitApp(MENU)?.id).toBe('top1');
});

test('控えておく画面は6つまで。超えたら長く使っていないものから捨てる', () => {
  for (let i = 0; i < 8; i++) rememberInitApp({ app: 'L_Tims', form: `frm${i}` }, `id${i}`, DEFINITION);
  expect(recallInitApp({ app: 'L_Tims', form: 'frm0' })).toBeNull();
  expect(recallInitApp({ app: 'L_Tims', form: 'frm1' })).toBeNull();
  expect(recallInitApp({ app: 'L_Tims', form: 'frm2' })?.id).toBe('id2');
  expect(recallInitApp({ app: 'L_Tims', form: 'frm7' })?.id).toBe('id7');
});

test('入れ直した画面は、新しく使ったものとして残る', () => {
  for (let i = 0; i < 6; i++) rememberInitApp({ app: 'L_Tims', form: `frm${i}` }, `id${i}`, DEFINITION);
  rememberInitApp({ app: 'L_Tims', form: 'frm0' }, 'id0b', DEFINITION); // いちばん古いものを使い直す
  rememberInitApp({ app: 'L_Tims', form: 'frm6' }, 'id6', DEFINITION);
  expect(recallInitApp({ app: 'L_Tims', form: 'frm0' })?.id).toBe('id0b');
  expect(recallInitApp({ app: 'L_Tims', form: 'frm1' })).toBeNull();
});
