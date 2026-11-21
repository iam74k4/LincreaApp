// ログインした人の「参照モード」（/user/getRefMode/）の返事の控え（src/webview/refModeCache.ts）と、
// ページの中で控えで答えるスクリプト（src/webview/page/initApp.ts の refModeJs）。スクリプトは jsdom の中で、偽の通信を相手に動かす。
import { JSDOM } from 'jsdom';

import { parseBridgeMessage } from '../webview/bridge';
import { refModeJs } from '../webview/page/initApp';
import { forgetRefModes, recallRefModes, rememberRefMode, type RefModeReply } from '../webview/refModeCache';

const URL_REF = '/user/getRefMode/';
const BODY = 'appId=L_Tims&formId=frmAttendance';
const KEY = `POST ${BODY}`;
const REPLY: RefModeReply = { text: '{"refMode":"0"}', type: 'application/json; charset=utf-8' };

type FakeXHR = EventTarget & {
  url: string;
  sync: boolean;
  sent: boolean;
  status: number;
  responseText: string;
  open: (method: string, url: string, async?: boolean) => void;
  send: (body?: unknown) => void;
  getResponseHeader: (name: string) => string | null;
  finish: (text: string) => void;
};

/** ページを用意して、スクリプトを入れる。posted はページがアプリに送った知らせ */
function page(cached: Record<string, RefModeReply>) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/runapp/L_Tims/frmAttendance/', runScripts: 'outside-only' });
  const w = dom.window as unknown as Window & typeof globalThis & { ReactNativeWebView: { postMessage: (s: string) => void } };
  const posted: unknown[] = [];
  w.ReactNativeWebView = { postMessage: (s: string) => posted.push(parseBridgeMessage(s)) };
  class XHR extends w.EventTarget {
    url = '';
    sync = false;
    sent = false;
    status = 0;
    responseText = '';
    open(_method: string, url: string, async?: boolean) {
      this.url = url;
      this.sync = async === false;
    }
    send() {
      this.sent = true;
    }
    getResponseHeader(name: string) {
      return /^content-type$/i.test(name) ? REPLY.type : null;
    }
    finish(text: string) {
      this.status = 200;
      this.responseText = text;
      this.dispatchEvent(new w.Event('load'));
    }
  }
  (w as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = XHR;
  (w as unknown as { eval: (code: string) => unknown }).eval(refModeJs(cached));
  // スクリプトが prototype を書き換えたあとの XMLHttpRequest（= XHR）で作る
  const Fake = XHR as unknown as new () => FakeXHR;
  return { w, posted, xhr: () => new Fake() };
}

afterEach(() => forgetRefModes());

test('控えがなければ、ふつうに聞き、返事をアプリに渡して控えてもらう', () => {
  const { xhr, posted } = page({});
  const x = xhr();
  x.open('POST', URL_REF, true);
  x.send(BODY);
  expect(x.sent).toBe(true);
  x.finish(REPLY.text);
  expect(posted).toEqual([{ type: 'refMode', key: KEY, text: REPLY.text, contentType: REPLY.type }]);
});

test('控えがあれば、通信せずに控えで答える（非同期の問い合わせは、すぐあとで load が届く）', async () => {
  const { xhr, posted } = page({ [KEY]: REPLY });
  const x = xhr();
  const loaded = jest.fn();
  x.addEventListener('load', loaded);
  x.open('POST', URL_REF, true);
  x.send(BODY);
  expect(x.sent).toBe(false);
  expect(loaded).not.toHaveBeenCalled();
  await new Promise((r) => setTimeout(r, 5));
  expect(loaded).toHaveBeenCalledTimes(1);
  expect(x.status).toBe(200);
  expect(x.responseText).toBe(REPLY.text);
  expect(x.getResponseHeader('Content-Type')).toBe(REPLY.type);
  expect(posted).toEqual([]);
});

test('同期の問い合わせには、send が戻る前に答える', () => {
  const { xhr } = page({ [KEY]: REPLY });
  const x = xhr();
  const loaded = jest.fn();
  x.addEventListener('load', loaded);
  x.open('POST', URL_REF, false);
  x.send(BODY);
  expect(loaded).toHaveBeenCalledTimes(1);
  expect(x.responseText).toBe(REPLY.text);
});

test('中身が違う問い合わせ・ほかの通信・中身が文字でない問い合わせには、控えを使わない', () => {
  const { xhr } = page({ [KEY]: REPLY });
  const other = xhr();
  other.open('POST', URL_REF, true);
  other.send('appId=L_Other');
  expect(other.sent).toBe(true);
  const unrelated = xhr();
  unrelated.open('POST', '/procedure/BigData/getData/', true);
  unrelated.send(BODY);
  expect(unrelated.sent).toBe(true);
  const binary = xhr();
  binary.open('POST', URL_REF, true);
  binary.send({ appId: 'L_Tims' });
  expect(binary.sent).toBe(true);
});

test('アプリの控え: 30 分で捨てる・ログイン（ログアウト）で捨てる', () => {
  rememberRefMode('L_Tims', KEY, REPLY, 0);
  expect(recallRefModes('L_Tims', 29 * 60_000)).toEqual({ [KEY]: REPLY });
  expect(recallRefModes('L_Tims', 31 * 60_000)).toEqual({});
  rememberRefMode('L_Tims', KEY, REPLY, 0);
  forgetRefModes();
  expect(recallRefModes('L_Tims', 1)).toEqual({});
});

test('アプリの控え: 控えたアプリの画面にだけ渡す（ほかのアプリのページが控えさせた答えを、給与明細などに渡さない）', () => {
  rememberRefMode('X_Other', KEY, { text: '{"refMode":"偽物"}', type: 'application/json' }, 0);
  expect(recallRefModes('L_Payslip', 1)).toEqual({});
  expect(recallRefModes('X_Other', 1)).toEqual({ [KEY]: { text: '{"refMode":"偽物"}', type: 'application/json' } });
  rememberRefMode('L_Payslip', KEY, REPLY, 0);
  expect(recallRefModes('L_Payslip', 1)).toEqual({ [KEY]: REPLY });
});

test('アプリの控え: 20 個を超えたら、古いものから捨てる', () => {
  for (let i = 0; i < 22; i++) rememberRefMode('L_Tims', `POST n=${i}`, REPLY, i);
  const keys = Object.keys(recallRefModes('L_Tims', 100));
  expect(keys).toHaveLength(20);
  expect(keys).not.toContain('POST n=0');
  expect(keys).toContain('POST n=21');
});

test('ページからの知らせは、大きすぎるものを受け付けない', () => {
  expect(parseBridgeMessage(JSON.stringify({ type: 'refMode', key: KEY, text: 'x'.repeat(2001), contentType: '' }))).toBeNull();
  expect(parseBridgeMessage(JSON.stringify({ type: 'refMode', key: KEY, text: REPLY.text, contentType: REPLY.type }))).toEqual({
    type: 'refMode',
    key: KEY,
    text: REPLY.text,
    contentType: REPLY.type,
  });
});
