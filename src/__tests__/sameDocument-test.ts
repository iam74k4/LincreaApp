// ページを読み込まずにアドレスだけ変わったときは、読み込みの始まりとして片づけない（src/components/EzcraftWebView/EzcraftWebView.tsx の onLoadStart）。
// Android は、# のあとだけの変更や pushState でも、読み込みの始まり（onLoadStart）を知らせてくる（doUpdateVisitedHistory）。
// 片づけると、保存の見張りが切れて「保存しています」が消え、保存の途中で戻れてしまう（2026-11-22）。
import { JSDOM } from 'jsdom';

import { parseBridgeMessage } from '../webview/bridge';
import { onlyHashChanged } from '../webview/origin';
import { BRIDGE_JS } from '../webview/page/bridgeJs';

const PAGE = 'https://lincrea-all.ezcraft.com/runapp/L_Tims/frmAttendance/';

describe('onlyHashChanged: # のあとだけが変わったか', () => {
  test('# のあとだけが変わったら true（読み込みではない）', () => {
    expect(onlyHashChanged(PAGE, `${PAGE}#tab2`)).toBe(true);
    expect(onlyHashChanged(`${PAGE}#a`, `${PAGE}#b`)).toBe(true);
    expect(onlyHashChanged(`${PAGE}#a`, PAGE)).toBe(true);
  });
  test('同じ URL（読み直し）・ほかのページ・まだページがないときは false（読み込みとして片づける）', () => {
    expect(onlyHashChanged(PAGE, PAGE)).toBe(false);
    expect(onlyHashChanged(PAGE, 'https://lincrea-all.ezcraft.com/runapp/L_Tims/frmApply/')).toBe(false);
    expect(onlyHashChanged(PAGE, `${PAGE}?q=1`)).toBe(false);
    expect(onlyHashChanged('', PAGE)).toBe(false);
  });
});

describe('ページが読み込まずにアドレスを変える（pushState・replaceState）ときは、先にアプリに知らせる', () => {
  let dom: JSDOM;
  let closeDom: () => void; // jsdom の本当の close（ページの window.close は、BRIDGE_JS が替える）
  let posted: { type: string; url?: string }[];

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: PAGE, runScripts: 'outside-only' });
    posted = [];
    const w = dom.window as unknown as { ReactNativeWebView: unknown; eval: (js: string) => unknown };
    w.ReactNativeWebView = { postMessage: (json: string) => posted.push(JSON.parse(json)) };
    closeDom = dom.window.close.bind(dom.window);
    w.eval(BRIDGE_JS);
  });
  afterEach(() => {
    closeDom();
  });

  test('pushState・replaceState の行き先（URL を省いたら、いまの URL）を知らせてから、アドレスを変える', () => {
    dom.window.history.pushState({}, '', '/runapp/L_Tims/frmAttendance/?tab=2');
    dom.window.history.replaceState({}, '');
    const changes = posted.filter((m) => m.type === 'urlChange').map((m) => m.url);
    expect(changes).toEqual([`${PAGE}?tab=2`, `${PAGE}?tab=2`]);
    expect(dom.window.location.href).toBe(`${PAGE}?tab=2`);
  });

  test('アプリは、知らせを URL として読む', () => {
    expect(parseBridgeMessage(JSON.stringify({ type: 'urlChange', url: `${PAGE}?tab=2` }))).toEqual({ type: 'urlChange', url: `${PAGE}?tab=2` });
    expect(parseBridgeMessage(JSON.stringify({ type: 'urlChange', url: 1 }))).toBeNull();
  });
});
