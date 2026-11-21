// 起動したときの、前のログインの確かめ（src/auth/savedSession.ts の restoreSession）。
// ログイン画面へ戻されたら、その画面から Cognito の設定を読んでおく（Face ID で入り直すとき、ログイン画面を読み直さない）。
import { NetworkError, serverFetch } from '../api/http';
import { restoreSession } from '../auth/savedSession';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api/http', () => ({ ...jest.requireActual('../api/http'), serverFetch: jest.fn() }));
const mockedFetch = serverFetch as jest.MockedFunction<typeof serverFetch>;

type Res = Awaited<ReturnType<typeof serverFetch>>;
const page = (url: string, html: string, ok = true) => ({ ok, status: ok ? 200 : 500, url, text: async () => html }) as unknown as Res;
const LOGIN_HTML = '<head><meta name="userPoolId" content="ap-northeast-1_abc"><meta name="appClientId" content="client1"></head>';

afterEach(() => mockedFetch.mockReset());

test('ログイン画面へ戻されたら expired。その画面の Cognito の設定も返す', async () => {
  mockedFetch.mockResolvedValue(page('https://x.test/login?r=https%3A%2F%2Fx.test%2Fmain%2F', LOGIN_HTML));
  expect(await restoreSession()).toEqual({ status: 'expired', pool: { userPoolId: 'ap-northeast-1_abc', clientId: 'client1' } });
});

test('ログイン画面に設定がない・サーバーが失敗したときは、設定なし（Face ID はログイン画面を読み直す）', async () => {
  mockedFetch.mockResolvedValue(page('https://x.test/login', '<html></html>'));
  expect(await restoreSession()).toEqual({ status: 'expired', pool: null });
  mockedFetch.mockResolvedValue(page('https://x.test/main/', LOGIN_HTML, false));
  expect(await restoreSession()).toEqual({ status: 'expired', pool: null });
});

test('ログインしたままなら valid', async () => {
  mockedFetch.mockResolvedValue(page('https://x.test/main/', '<html _t="abc"></html>'));
  expect((await restoreSession()).status).toBe('valid');
});

test('つながらなければ offline', async () => {
  mockedFetch.mockRejectedValue(new NetworkError());
  expect((await restoreSession()).status).toBe('offline');
});
