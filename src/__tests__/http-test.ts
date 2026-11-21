// サーバーとの通信の道具（src/api/http.ts）: 待ちすぎ・つながらないときの失敗と、画面に出す文。
import { fetch as expoFetch } from 'expo/fetch';

import { CanceledError, describeError, NetworkError, serverFetch, SessionExpiredError, TimeoutError } from '../api/http';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const mockedFetch = expoFetch as jest.MockedFunction<typeof expoFetch>;

afterEach(() => {
  jest.useRealTimers();
  mockedFetch.mockReset();
});

test('つながらなければ NetworkError（英語の文を出さない）', async () => {
  mockedFetch.mockRejectedValue(new TypeError('Network request failed'));
  await expect(serverFetch('https://example.com/')).rejects.toBeInstanceOf(NetworkError);
});

test('待ちすぎたら、取りやめて TimeoutError', async () => {
  jest.useFakeTimers();
  mockedFetch.mockImplementation(
    (_url, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );
  const pending = serverFetch('https://example.com/', {}, 1000);
  jest.advanceTimersByTime(1000);
  await expect(pending).rejects.toBeInstanceOf(TimeoutError);
});

test('呼んだ側が止めたら（signal）、取りやめて CanceledError（待ちすぎの TimeoutError とは分ける）', async () => {
  mockedFetch.mockImplementation(
    (_url, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );
  const controller = new AbortController();
  const pending = serverFetch('https://example.com/', { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toBeInstanceOf(CanceledError);
});

test('はじめから止められていたら、すぐ CanceledError', async () => {
  mockedFetch.mockImplementation(
    (_url, init) => (init?.signal?.aborted ? Promise.reject(new Error('aborted')) : new Promise(() => {})),
  );
  const controller = new AbortController();
  controller.abort();
  await expect(serverFetch('https://example.com/', { signal: controller.signal })).rejects.toBeInstanceOf(CanceledError);
});

test('返事が来れば、そのまま返す', async () => {
  const res = { ok: true } as unknown as Awaited<ReturnType<typeof expoFetch>>;
  mockedFetch.mockResolvedValue(res);
  await expect(serverFetch('https://example.com/')).resolves.toBe(res);
});

describe('describeError: 画面に出す文', () => {
  test('アプリが作った日本語の文は、そのまま', () => {
    expect(describeError(new Error('一覧を読み込めませんでした（HTTP 500）'))).toBe('一覧を読み込めませんでした（HTTP 500）');
    expect(describeError(new SessionExpiredError())).toBe(new SessionExpiredError().message);
  });
  test('通信の仕組みの英語の文は、つながらないことを伝える文に', () => {
    expect(describeError(new TypeError('Network request failed'))).toBe(new NetworkError().message);
    expect(describeError(new Error('The Internet connection appears to be offline.'))).toBe(new NetworkError().message);
  });
  test('ほかの英語の文は、中身を出さずに言い換える', () => {
    expect(describeError(new Error('Unexpected token < in JSON at position 0'))).not.toMatch(/JSON/);
  });
});
