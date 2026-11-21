// マイアプリの一覧（src/api/ezcraft/myApps.ts）: なりすまし防止の合言葉（CSRF トークン）を覚えて、/main/ を読み直さないこと。
import { fetch as expoFetch } from 'expo/fetch';

import { forgetCsrf, rememberCsrf } from '../api/ezcraft/server';
import { NetworkError } from '../api/http';
import { fetchMyApps } from '../api/ezcraft/myApps';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const mockedFetch = expoFetch as jest.MockedFunction<typeof expoFetch>;

const MAIN = '<html lang="ja" _t="token-1"><body></body></html>';
const APPS = { data: [{ id: '1', application_name: '勤怠', application_logic_name: 'L_Tims', form_logic_name: 'frmLTiMSTop', description: null, icon: null, production_app_status: '01', development_app_status: null, released_at: null, released_id: null, released_notes: null }] };

type Reply = { url: string; status?: number; text?: string; json?: unknown };
function reply({ url, status = 200, text = '', json }: Reply) {
  return { url, status, ok: status >= 200 && status < 300, text: async () => text, json: async () => json } as unknown as Awaited<ReturnType<typeof expoFetch>>;
}
const calls = () => mockedFetch.mock.calls.map(([url]) => new URL(String(url)).pathname);
const tokenOf = (i: number) => (mockedFetch.mock.calls[i][1]?.headers as Record<string, string>)['X-CSRF-Token'];

beforeEach(() => {
  forgetCsrf();
  mockedFetch.mockReset();
});

test('合言葉を覚えていなければ /main/ で読み、2 回目からは読み直さない', async () => {
  mockedFetch.mockImplementation(async (url) =>
    String(url).endsWith('/main/') ? reply({ url: String(url), text: MAIN }) : reply({ url: String(url), json: APPS }),
  );
  expect((await fetchMyApps())[0].logicName).toBe('L_Tims');
  expect(await fetchMyApps()).toHaveLength(1);
  expect(calls()).toEqual(['/main/', '/application/find/', '/application/find/']);
  expect(tokenOf(2)).toBe('token-1');
});

test('起動のときに読んだ /main/ の合言葉を使う', async () => {
  rememberCsrf(MAIN);
  mockedFetch.mockImplementation(async (url) => reply({ url: String(url), json: APPS }));
  await fetchMyApps();
  expect(calls()).toEqual(['/application/find/']);
});

test('覚えていた合言葉が古くて断られたら、読み直してもう一度聞く', async () => {
  rememberCsrf('<html _t="old">');
  mockedFetch.mockImplementation(async (url, init) => {
    if (String(url).endsWith('/main/')) return reply({ url: String(url), text: MAIN });
    const token = (init?.headers as Record<string, string>)['X-CSRF-Token'];
    return token === 'token-1' ? reply({ url: String(url), json: APPS }) : reply({ url: String(url), status: 403 });
  });
  expect(await fetchMyApps()).toHaveLength(1);
  expect(calls()).toEqual(['/application/find/', '/main/', '/application/find/']);
});

test('つながらないときは、読み直さずにそのまま知らせる', async () => {
  rememberCsrf(MAIN);
  mockedFetch.mockRejectedValue(new TypeError('Network request failed'));
  await expect(fetchMyApps()).rejects.toBeInstanceOf(NetworkError);
  expect(mockedFetch).toHaveBeenCalledTimes(1);
});
