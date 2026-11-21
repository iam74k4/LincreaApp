// 起動したときの、前のログインの確かめ（src/auth/savedSession.ts の restoreSession）。
// ログイン画面へ戻されたら、その画面から Cognito の設定を読んでおく（Face ID で入り直すとき、ログイン画面を読み直さない）。
import AsyncStorage from '@react-native-async-storage/async-storage';

import { NetworkError, serverFetch } from '../api/http';
import { restoreSession, saveSession } from '../auth/savedSession';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api/http', () => ({ ...jest.requireActual('../api/http'), serverFetch: jest.fn() }));
const mockedFetch = serverFetch as jest.MockedFunction<typeof serverFetch>;

type Res = Awaited<ReturnType<typeof serverFetch>>;
const page = (url: string, html: string, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, url, text: async () => html }) as unknown as Res;
const LOGIN_HTML = '<head><meta name="userPoolId" content="ap-northeast-1_abc"><meta name="appClientId" content="client1"></head>';
const TARO = { username: 'taro' };

beforeEach(async () => {
  await AsyncStorage.clear();
  await saveSession(TARO);
});
afterEach(() => mockedFetch.mockReset());

test('ログイン画面へ戻されたら expired。その画面の Cognito の設定と、前にログインしていた人も返す', async () => {
  mockedFetch.mockResolvedValue(page('https://x.test/login?r=https%3A%2F%2Fx.test%2Fmain%2F', LOGIN_HTML));
  expect(await restoreSession()).toEqual({
    status: 'expired',
    pool: { userPoolId: 'ap-northeast-1_abc', clientId: 'client1' },
    saved: TARO,
  });
});

test('ログイン画面に設定がない・サーバーが断った（4xx）ときは、設定なし（Face ID はログイン画面を読み直す）', async () => {
  mockedFetch.mockResolvedValue(page('https://x.test/login', '<html></html>'));
  expect(await restoreSession()).toEqual({ status: 'expired', pool: null, saved: TARO });
  mockedFetch.mockResolvedValue(page('https://x.test/main/', LOGIN_HTML, 403));
  expect(await restoreSession()).toEqual({ status: 'expired', pool: null, saved: TARO });
});

test('サーバーの中の問題（500 番台）は、ログインが切れたのではない: offline（前の人のまま始め、あとで確かめ直す）', async () => {
  mockedFetch.mockResolvedValue(page('https://x.test/main/', 'error', 503));
  expect(await restoreSession()).toEqual({ status: 'offline', saved: TARO });
});

test('ログインしたまま・前にログインしていた人がいれば valid（その人で戻す）', async () => {
  mockedFetch.mockResolvedValue(page('https://x.test/main/', '<html _t="abc"></html>'));
  expect(await restoreSession()).toEqual({ status: 'valid', session: TARO });
});

test('サーバーのログインは残っているが、アプリではログアウトしていた: 前の人のまま入らず、サーバーのログインも終わらせる', async () => {
  await AsyncStorage.clear(); // ログアウトで消えている
  mockedFetch.mockResolvedValue(page('https://x.test/main/', '<html _t="abc"></html>'));
  expect(await restoreSession()).toEqual({ status: 'expired', pool: null, saved: null });
  expect(mockedFetch).toHaveBeenCalledWith(expect.stringMatching(/\/logout$/), expect.anything(), expect.any(Number));
});

test('つながらなければ offline（前にログインしていた人を返す）', async () => {
  mockedFetch.mockRejectedValue(new NetworkError());
  expect(await restoreSession()).toEqual({ status: 'offline', saved: TARO });
});

test('返事の本文が途中で切れたら、ログインが切れたのではなく offline', async () => {
  mockedFetch.mockResolvedValue({
    ok: true,
    status: 200,
    url: 'https://x.test/main/',
    text: async () => {
      throw new Error('stream reset');
    },
  } as unknown as Res);
  expect(await restoreSession()).toEqual({ status: 'offline', saved: TARO });
});
