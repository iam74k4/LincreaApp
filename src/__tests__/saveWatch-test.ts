// 保存の見張り（src/webview/bridge.ts の SAVE_WATCH_JS）と、「保存しています（n/m）」の数（src/webview/saveSizes.ts）。
// ページのスクリプトは jsdom の中で、偽の通信（XMLHttpRequest）を相手に動かす。
// EZCraft の保存の流れ（beginTrans → 読む・書く → commit）は、2026-11-18 に勤怠実績登録で測ったものに合わせる。
import { JSDOM } from 'jsdom';

import { parseBridgeMessage, SAVE_WATCH_JS } from '../webview/bridge';
import { describeSave, rememberSaveSize, saveKey, saveProgress, saveSizeOf, savingText } from '../webview/saveSizes';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/** 同期の通信（beginTrans・commit・rollBack）に返す中身 */
const SYNC_REPLY: Record<string, string> = {
  beginTrans: '{"status":"success","meta":{"transID":"77"},"data":[]}',
  commit: '{"status":"success","meta":{},"data":[]}',
  rollBack: '{"status":"success","meta":{},"data":[]}',
};

/** 偽の通信。非同期のものは、テストが finish() で終わらせる（ページのスクリプトが prototype を書き換えるので、テストごとに作り直す） */
function makeFakeXHR() {
  return class FakeXHR {
    url = '';
    async = true;
    status = 0;
    responseText = '';
    private listeners: (() => void)[] = [];
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
      if (type === 'loadend') this.listeners.push(fn);
    }
    finish(text = '{"status":"success","meta":{},"data":[]}', status = 200) {
      this.status = status;
      this.responseText = text;
      this.listeners.forEach((fn) => fn());
    }
  };
}

type FakeXHR = InstanceType<ReturnType<typeof makeFakeXHR>>;
let XHR: ReturnType<typeof makeFakeXHR>;

let dom: JSDOM;
let post: jest.Mock;
type Message = { type: string; [key: string]: unknown };
const messages = (): Message[] => post.mock.calls.map(([json]) => JSON.parse(json as string) as Message);
const ends = () => messages().filter((m) => m.type === 'saveEnd');

/** EZCraft の Db.js と同じ形で通信する（async: false は同期） */
function request(cmd: string, { sync = false, query = '' } = {}): FakeXHR {
  const xhr = new XHR();
  const path = cmd === 'execSql' ? '/tblCmn/execSql/' : `/procedure/BigData/${cmd}/`;
  xhr.open(sync ? 'GET' : 'POST', `${path}${query ? `?${query}` : ''}`, !sync);
  xhr.send();
  return xhr;
}

beforeEach(() => {
  jest.useFakeTimers();
  XHR = makeFakeXHR();
  dom = new JSDOM('<!doctype html><html><body><div class="tcc-btn" id="ins"><a>登 録</a></div><div class="tcc-btn" id="copy"><a>コピー</a></div></body></html>');
  post = jest.fn();
  const win = dom.window as unknown as { ReactNativeWebView: { postMessage: jest.Mock } };
  win.ReactNativeWebView = { postMessage: post };
  // ページに入れるのと同じ文を、そのページ（window・document）と偽の通信で動かす
  new Function('window', 'document', 'XMLHttpRequest', SAVE_WATCH_JS)(dom.window, dom.window.document, XHR);
});
afterEach(() => {
  jest.useRealTimers();
  dom.window.close();
});

describe('トランザクションを使う保存（勤怠実績の登録など）', () => {
  test('beginTrans で始まり、自分の commit で終わる。数えるのは通信の種類と数だけ', () => {
    request('beginTrans', { sync: true });
    request('getData').finish();
    request('upsert').finish();
    request('commit', { sync: true, query: 'transId=77' });
    const types = messages().map((m) => m.type);
    expect(types[0]).toBe('saveStart');
    expect(types.filter((t) => t === 'saveStep')).toHaveLength(4);
    expect(ends()).toEqual([{ type: 'saveEnd', ok: true, steps: 4, writes: 3, ms: expect.any(Number) }]);
    // データの中身（通信の返事）は送らない
    expect(JSON.stringify(messages())).not.toContain('transID');
  });

  test('EZCraft がほかの人の古いトランザクションを取り消す rollBack（番号が違う）では、終わらない', () => {
    request('beginTrans', { sync: true });
    request('execSql', { sync: true });
    request('rollBack', { sync: true, query: 'transId=12345' });
    expect(ends()).toHaveLength(0);
    request('commit', { sync: true, query: 'transId=77' });
    expect(ends()).toHaveLength(1);
  });

  test('自分の rollBack で終わったら、失敗として知らせ、EZCraft が出したエラーの文も知らせる', () => {
    request('beginTrans', { sync: true });
    request('upsert').finish('{"status":"error","error":{"errMsg":"x"}}');
    request('rollBack', { sync: true, query: 'transId=77' });
    const steps = messages().filter((m) => m.type === 'saveStep');
    expect(steps[1]).toMatchObject({ cmd: 'upsert', ok: false });
    expect(ends()[0]).toMatchObject({ ok: false });
    // EZCraft のエラーの知らせ（jsdom は innerText を持たないので、文を直接入れる）
    const box = dom.window.document.createElement('div');
    box.className = 'tcc-msg-box';
    Object.defineProperty(box, 'offsetParent', { get: () => dom.window.document.body });
    Object.defineProperty(box, 'innerText', { get: () => 'エラー\nLock wait timeout exceeded\nOK' });
    dom.window.document.body.appendChild(box);
    jest.advanceTimersByTime(400);
    expect(messages().at(-1)).toEqual({ type: 'saveError', text: 'エラー Lock wait timeout exceeded' });
  });

  test('保存のあいだだけ、ページに myapp-saving を付ける（EZCraft のくるくるを隠す）', () => {
    const html = dom.window.document.documentElement;
    request('beginTrans', { sync: true });
    expect(html.classList.contains('myapp-saving')).toBe(true);
    request('commit', { sync: true, query: 'transId=77' });
    expect(html.classList.contains('myapp-saving')).toBe(false);
  });
});

describe('トランザクションを使わない保存', () => {
  test('書き込みのボタンを押してからの書き込みを見張り、通信が止んで1秒で終わる', () => {
    dom.window.document.querySelector<HTMLElement>('#ins a')!.click();
    request('upsert').finish();
    expect(ends()).toHaveLength(0);
    jest.advanceTimersByTime(1000);
    expect(ends()).toEqual([{ type: 'saveEnd', ok: true, steps: 1, writes: 1, ms: expect.any(Number) }]);
  });

  test('読むだけの通信や、書き込みのボタンでないボタン（コピー）のあとは、見張らない', () => {
    request('getData').finish();
    dom.window.document.querySelector<HTMLElement>('#copy a')!.click();
    request('upsert').finish();
    jest.advanceTimersByTime(2000);
    expect(messages()).toEqual([]);
  });
});

describe('ほかの画面が保存しているあいだ（保存はアプリ全体で1つずつ）', () => {
  type Win = { __myappSaveBusy?: boolean; __myappSaveFree?: () => void };
  test('書き込みのボタンは EZCraft に渡さずに待たせ、前の保存が終わったら押し直す', () => {
    const win = dom.window as unknown as Win;
    const button = dom.window.document.querySelector<HTMLElement>('#ins a')!;
    const pressed = jest.fn(); // EZCraft のボタンの処理の代わり
    button.addEventListener('click', pressed);
    win.__myappSaveBusy = true;
    button.click();
    expect(pressed).not.toHaveBeenCalled();
    expect(messages()).toEqual([{ type: 'saveWait' }]);
    win.__myappSaveFree!();
    expect(pressed).toHaveBeenCalledTimes(1);
    expect(win.__myappSaveBusy).toBe(false);
  });
  test('書き込みでないボタン（コピー）は待たせない', () => {
    const win = dom.window as unknown as Win;
    const button = dom.window.document.querySelector<HTMLElement>('#copy a')!;
    const pressed = jest.fn();
    button.addEventListener('click', pressed);
    win.__myappSaveBusy = true;
    button.click();
    expect(pressed).toHaveBeenCalledTimes(1);
    expect(messages()).toEqual([]);
  });
  test('待たせていたボタンがもう画面にないときは、押さない', () => {
    const win = dom.window as unknown as Win;
    const button = dom.window.document.querySelector<HTMLElement>('#ins a')!;
    const pressed = jest.fn();
    button.addEventListener('click', pressed);
    win.__myappSaveBusy = true;
    button.click();
    button.remove();
    win.__myappSaveFree!();
    expect(pressed).not.toHaveBeenCalled();
  });
});

describe('知らせの形（ページから来るものは信用しない）', () => {
  const parse = (message: unknown) => parseBridgeMessage(JSON.stringify(message));
  test('形の合うものだけ通す', () => {
    expect(parse({ type: 'saveStep', cmd: 'upsert', ms: 53, ok: true, steps: 3, writes: 2 })).toEqual({
      type: 'saveStep',
      cmd: 'upsert',
      ms: 53,
      ok: true,
      steps: 3,
      writes: 2,
    });
    expect(parse({ type: 'saveEnd', ok: true, steps: 37, writes: 9, ms: 8800 })).toMatchObject({ type: 'saveEnd', steps: 37 });
  });
  test('待たせた知らせは、種類だけ', () => {
    expect(parse({ type: 'saveWait', extra: 'x' })).toEqual({ type: 'saveWait' });
  });
  test('エラーの文は 200 字まで。文字でなければ空にする', () => {
    expect(parse({ type: 'saveError', text: 'あ'.repeat(300) })).toEqual({ type: 'saveError', text: 'あ'.repeat(200) });
    expect(parse({ type: 'saveError', text: 5 })).toEqual({ type: 'saveError', text: '' });
  });
  test.each([
    ['通信の種類に記号がある', { type: 'saveStep', cmd: 'up<sert>', ms: 1, steps: 1, writes: 1 }],
    ['数がマイナス', { type: 'saveStep', cmd: 'upsert', ms: -1, steps: 1, writes: 1 }],
    ['数が小数', { type: 'saveEnd', ok: true, steps: 1.5, writes: 1, ms: 1 }],
    ['数が文字', { type: 'saveEnd', ok: true, steps: '3', writes: 1, ms: 1 }],
  ])('%s ものは捨てる', (_, message) => {
    expect(parse(message)).toBeNull();
  });
});

describe('「保存しています（n/m）」の数', () => {
  test('画面の名前と押したボタンで覚える', () => {
    expect(saveKey('https://example.test/runapp/L_Tims/frmAttendanceDtl/?q=1', '登録')).toBe('frmAttendanceDtl:登録');
  });
  test('測った数があるので、勤怠実績の登録は初めてでも（n/9）を出す', () => {
    const size = saveSizeOf('frmAttendanceDtl:登録');
    expect(savingText(3, size)).toBe('保存しています（3/9）');
    expect(savingText(12, size)).toBe('保存しています（9/9）'); // 前より多くても、9 を超えて出さない
  });
  test('知らない保存は、数を出さない', () => {
    expect(savingText(3, saveSizeOf('frmUnknown:登録'))).toBe('保存しています');
    expect(saveProgress(3, null)).toBeNull();
  });
  test('棒は、終わるまで端まで行かない', () => {
    expect(saveProgress(10, { writes: 9, steps: 40 })).toBeCloseTo(0.25);
    expect(saveProgress(80, { writes: 9, steps: 40 })).toBe(0.95);
  });
  test('保存できたときの数を、次から使う', () => {
    rememberSaveSize('frmApply:申請', { writes: 4, steps: 12 });
    expect(saveSizeOf('frmApply:申請')).toEqual({ writes: 4, steps: 12 });
  });
  test('開発中に出す1行には、時間と通信の種類と数だけを書く', () => {
    const line = describeSave('frmAttendanceDtl:登録', { ok: true, steps: 37, writes: 9, ms: 8794 }, [
      { cmd: 'getData', ms: 887 },
      { cmd: 'upsert', ms: 53 },
      { cmd: 'delete', ms: 2646 },
    ]);
    expect(line).toBe('[保存] frmAttendanceDtl「登録」 8.8秒・通信 37 回（書き込み 9）・時間のかかった通信: getData 0.9秒、delete 2.6秒');
  });
});
