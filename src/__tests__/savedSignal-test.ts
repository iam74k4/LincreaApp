// 保存がうまく終わった、というページの中の知らせ（src/webview/page/bridgeJs.ts の myapp-saved）。
// 勤怠実績登録は、これを見て残業申請を開き、残業申請は、これを見て理由と「作成済み」を覚える（timsSkin.ts）。
// 保存の途中の書き込みで出すと、確定する前（8〜9 秒の保存の 1 秒め）に残業申請が開き、あとで取り消されても
// 開いたまま・理由も覚えたままになっていた（2026-11-22）。確定してから、うまくいったときだけ出す。
import { JSDOM } from 'jsdom';

import { BRIDGE_JS, SAVE_WATCH_JS } from '../webview/page/bridgeJs';

/** 同期の通信（beginTrans・commit・rollBack）に返す中身 */
const SYNC_REPLY: Record<string, string> = {
  beginTrans: '{"status":"success","meta":{"transID":"77"},"data":[]}',
  commit: '{"status":"success","meta":{},"data":[]}',
  rollBack: '{"status":"success","meta":{},"data":[]}',
};

/** 偽の通信。非同期のものは、テストが finish() で終わらせる（本物と同じく load → loadend の順） */
function makeFakeXHR() {
  return class FakeXHR {
    url = '';
    async = true;
    status = 0;
    responseText = '';
    private listeners: Record<string, (() => void)[]> = {};
    open(_method: string, url: string, async?: boolean) {
      this.url = url;
      this.async = async !== false;
    }
    send() {
      if (!this.async) {
        const cmd = /BigData\/([A-Za-z]+)/.exec(this.url)?.[1] ?? '';
        this.status = 200;
        this.responseText = SYNC_REPLY[cmd] ?? '{"status":"success"}';
      }
    }
    addEventListener(type: string, fn: () => void) {
      (this.listeners[type] ??= []).push(fn);
    }
    finish(text = '{"status":"success","meta":{},"data":[]}', status = 200) {
      this.status = status;
      this.responseText = text;
      for (const type of ['load', 'loadend']) (this.listeners[type] ?? []).forEach((fn) => fn.call(this));
    }
  };
}
type FakeXHR = InstanceType<ReturnType<typeof makeFakeXHR>>;

let dom: JSDOM;
let XHR: ReturnType<typeof makeFakeXHR>;
let saved: number;

/** EZCraft の Db.js と同じ形で通信する（async: false は同期） */
function request(cmd: string, { sync = false, query = '' } = {}): FakeXHR {
  const xhr = new XHR();
  xhr.open(sync ? 'GET' : 'POST', `/procedure/BigData/${cmd}/${query ? `?${query}` : ''}`, !sync);
  xhr.send();
  return xhr;
}
const wait = (ms: number) => new Promise((resolve) => dom.window.setTimeout(resolve, ms));

beforeEach(() => {
  XHR = makeFakeXHR();
  dom = new JSDOM('<!doctype html><html><body><div class="tcc-btn" id="ins"><a>登 録</a></div></body></html>', {
    runScripts: 'outside-only',
  });
  const w = dom.window as unknown as { ReactNativeWebView: unknown; XMLHttpRequest: unknown; eval: (js: string) => unknown };
  w.ReactNativeWebView = { postMessage: () => {} };
  w.XMLHttpRequest = XHR;
  // ページに入れるのと同じ順（EzcraftWebView の afterLoadJs）
  w.eval(BRIDGE_JS);
  w.eval(SAVE_WATCH_JS);
  saved = 0;
  dom.window.addEventListener('myapp-saved', () => {
    saved += 1;
  });
});
afterEach(() => {
  dom.window.close();
});

test('トランザクションの保存: 途中の書き込みでは知らせず、確定（commit）してから1回だけ知らせる', () => {
  request('beginTrans', { sync: true });
  request('delete').finish();
  request('getData').finish();
  request('upsert').finish();
  expect(saved).toBe(0);
  request('commit', { sync: true, query: 'transId=77' });
  expect(saved).toBe(1);
});

test('トランザクションの保存が取り消された（rollBack）ら、知らせない', () => {
  request('beginTrans', { sync: true });
  request('upsert').finish();
  request('rollBack', { sync: true, query: 'transId=77' });
  expect(saved).toBe(0);
});

test('確定の返事がエラーなら、知らせない', () => {
  request('beginTrans', { sync: true });
  request('upsert').finish();
  const commit = new XHR();
  commit.open('GET', '/procedure/BigData/commit/?transId=77', false);
  commit.send = function () {
    this.status = 200;
    this.responseText = '{"status":"error","message":"x"}';
  };
  commit.send();
  expect(saved).toBe(0);
});

test('トランザクションを使わない保存（登録を押してからの書き込み）: 通信が止んでから知らせる', async () => {
  (dom.window.document.querySelector('#ins a') as HTMLElement).click();
  request('insert').finish();
  expect(saved).toBe(0);
  await wait(1100); // 通信が止んで 1 秒（SAVE_WATCH_JS）
  expect(saved).toBe(1);
});

test('保存として見ていない書き込みは、うまくいったらすぐ知らせる（中身がエラーなら知らせない）', () => {
  request('insert').finish();
  expect(saved).toBe(1);
  request('update').finish('{"status":"error","message":"x"}');
  expect(saved).toBe(1);
  request('update').finish('', 500);
  expect(saved).toBe(1);
});
