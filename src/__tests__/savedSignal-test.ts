// 保存がうまく終わった、というページの中の知らせ（src/webview/page/bridgeJs.ts の myapp-saved）。
// 勤怠実績登録は、これを見て残業申請を開き、残業申請は、これを見て理由と「作成済み」を覚える（timsSkin.ts）。
// 保存の途中の書き込みで出すと、確定する前（8〜9 秒の保存の 1 秒め）に残業申請が開き、あとで取り消されても
// 開いたまま・理由も覚えたままになっていた（2026-11-22）。確定してから、うまくいったときだけ出す。
import { JSDOM } from 'jsdom';

import { BRIDGE_JS, SAVE_WATCH_JS } from '../webview/page/bridgeJs';

/** 同期の通信（beginTrans・commit・rollBack）に返す中身（テストが書き換える） */
let SYNC_REPLY: Record<string, string>;

/**
 * 偽の通信。非同期のものは、テストが finish() で終わらせる。本物と同じく、ページが付けた onreadystatechange が先、
 * そのあと load → loadend の順（ページの処理が、返事を受けてすぐ次の通信（確定など）を送ることがある）
 */
function makeFakeXHR() {
  return class FakeXHR {
    url = '';
    async = true;
    status = 0;
    responseText = '';
    onreadystatechange: (() => void) | null = null;
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
      this.onreadystatechange?.call(this);
      for (const type of ['load', 'loadend']) (this.listeners[type] ?? []).forEach((fn) => fn.call(this));
    }
  };
}
type FakeXHR = InstanceType<ReturnType<typeof makeFakeXHR>>;

let dom: JSDOM;
/** jsdom の本当の close（ページの window.close は、BRIDGE_JS がアプリへの「閉じて」に替える） */
let closeDom: () => void;
let XHR: ReturnType<typeof makeFakeXHR>;
let saved: number;
/** アプリに届いた知らせの種類（順に）。「保存した」はページの中の知らせなので saved として並べる */
let events: string[];

/** EZCraft の Db.js と同じ形で通信する（async: false は同期）。then があれば、返事を受けたページの処理として先に走らせる */
function request(cmd: string, { sync = false, query = '', then }: { sync?: boolean; query?: string; then?: () => void } = {}): FakeXHR {
  const xhr = new XHR();
  xhr.open(sync ? 'GET' : 'POST', `/procedure/BigData/${cmd}/${query ? `?${query}` : ''}`, !sync);
  if (then) xhr.onreadystatechange = then;
  xhr.send();
  return xhr;
}
const wait = (ms: number) => new Promise((resolve) => dom.window.setTimeout(resolve, ms));

beforeEach(() => {
  SYNC_REPLY = {
    beginTrans: '{"status":"success","meta":{"transID":"77"},"data":[]}',
    commit: '{"status":"success","meta":{},"data":[]}',
    rollBack: '{"status":"success","meta":{},"data":[]}',
  };
  events = [];
  XHR = makeFakeXHR();
  dom = new JSDOM('<!doctype html><html><body><div class="tcc-btn" id="ins"><a>登 録</a></div></body></html>', {
    runScripts: 'outside-only',
  });
  const w = dom.window as unknown as { ReactNativeWebView: unknown; XMLHttpRequest: unknown; eval: (js: string) => unknown };
  w.ReactNativeWebView = { postMessage: (json: string) => events.push((JSON.parse(json) as { type: string }).type) };
  w.XMLHttpRequest = XHR;
  closeDom = dom.window.close.bind(dom.window);
  // ページに入れるのと同じ順（EzcraftWebView の afterLoadJs）
  w.eval(BRIDGE_JS);
  w.eval(SAVE_WATCH_JS);
  saved = 0;
  dom.window.addEventListener('myapp-saved', () => {
    saved += 1;
    events.push('saved');
  });
});
afterEach(() => {
  closeDom();
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
  SYNC_REPLY.commit = '{"status":"error","message":"x"}';
  request('commit', { sync: true, query: 'transId=77' });
  expect(saved).toBe(0);
});

test('ページが、最後の書き込みの返事を受けてすぐ確定・取り消しを送っても、確定したときだけ1回知らせる', () => {
  // ページの処理（onreadystatechange）が、アプリの見張りより先に走り、その中で同期の確定を送る
  request('beginTrans', { sync: true });
  request('upsert', { then: () => request('rollBack', { sync: true, query: 'transId=77' }) }).finish();
  expect(saved).toBe(0);
  request('beginTrans', { sync: true });
  request('upsert', { then: () => request('commit', { sync: true, query: 'transId=77' }) }).finish();
  expect(saved).toBe(1);
});

test('トランザクションを使わない保存（登録を押してからの書き込み）: 通信が止んでから知らせる', async () => {
  (dom.window.document.querySelector('#ins a') as HTMLElement).click();
  request('insert').finish();
  expect(saved).toBe(0);
  await wait(1100); // 通信が止んで 1 秒（SAVE_WATCH_JS）
  expect(saved).toBe(1);
});

test('トランザクションを使わない保存で、書き込みの返事がエラーなら、知らせない（失敗として終わる）', async () => {
  (dom.window.document.querySelector('#ins a') as HTMLElement).click();
  request('insert').finish('{"status":"error","message":"x"}');
  await wait(1100);
  expect(saved).toBe(0);
  expect(events).toContain('saveEnd');
});

test('トランザクションを使わない保存のすぐあとにページが閉じたら、閉じる前に保存を終わりにして知らせる', () => {
  (dom.window.document.querySelector('#ins a') as HTMLElement).click();
  request('insert').finish();
  // EZCraft が書き込みのすぐあとに閉じる（BRIDGE_JS がアプリへの「閉じて」に替えてある）
  (dom.window as unknown as { eval: (js: string) => unknown }).eval('window.close()');
  expect(events.filter((e) => ['saveEnd', 'saved', 'close'].includes(e))).toEqual(['saveEnd', 'saved', 'close']);
});

test('書き込みの返事を受けたページの処理の中で閉じても、閉じる前に保存を終わりにして知らせる', async () => {
  (dom.window.document.querySelector('#ins a') as HTMLElement).click();
  const w = dom.window as unknown as { eval: (js: string) => unknown };
  request('insert', { then: () => w.eval('window.close()') }).finish();
  await wait(10);
  expect(events.filter((e) => ['saveEnd', 'saved', 'close'].includes(e))).toEqual(['saveEnd', 'saved', 'close']);
});

test('アプリがあきらめた保存も見張り続け、続きの書き込みでは知らせず、自分の確定で知らせる（アプリには知らせない）', () => {
  request('beginTrans', { sync: true });
  request('upsert').finish();
  (dom.window as unknown as { __myappSaveGiveUp: () => void }).__myappSaveGiveUp();
  expect(dom.window.document.documentElement.classList.contains('myapp-saving')).toBe(false);
  request('upsert').finish(); // あきらめたあとも、ページの保存は続いている
  expect(saved).toBe(0);
  request('rollBack', { sync: true, query: 'transId=77' });
  expect(saved).toBe(0);
  // あきらめる前の2歩（beginTrans と、1つめの upsert）だけ
  expect(events.filter((e) => e === 'saveEnd' || e === 'saveStep')).toEqual(['saveStep', 'saveStep']);
});

test('アプリがあきらめた保存が終わらないまま、次の保存が始まったら、新しい保存として数える', () => {
  request('beginTrans', { sync: true });
  request('upsert').finish();
  (dom.window as unknown as { __myappSaveGiveUp: () => void }).__myappSaveGiveUp();
  expect(events.filter((e) => e === 'saveEnd')).toEqual([]); // アプリには、もう知らせない
  // 次の保存は、新しい保存として数えて、確定したら知らせる
  SYNC_REPLY.beginTrans = '{"status":"success","meta":{"transID":"78"},"data":[]}';
  request('beginTrans', { sync: true });
  request('upsert').finish();
  request('commit', { sync: true, query: 'transId=78' });
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
