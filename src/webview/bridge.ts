// EZCraft の Web ページを、スマホのアプリの中で「ふつうに」動かすためのつなぎ。
//
// 1. 1回のタップで押せるようにする
//    EZCraft のボタンや表の行は、マウスを乗せたとき（説明の表示・行の色）に見た目を変える。
//    iOS はそれを見て、1回目のタップを「マウスを乗せただけ」として扱い、2回目でやっと押したことにする。
//    そこでボタンと表の行は、指を動かさずに離したら、iOS の扱いを止めて、こちらで「押した」ことにする。
//    （入力欄など、ほかのタップは iOS にそのまま任せる。指を動かしたらスクロールなので押さない）
//
// 2. 別の画面を開く（window.open）
//    EZCraft は、画面から画面へ移るとき新しいウインドウを開き、開いた先は「開いた元のウインドウ」
//    （window.opener）から次のものを受け取る:
//      - App.data … アプリの共有データ（ログインした人の情報など）
//      - 引数     … 開いた元が Forms('画面').setParam(...) で渡したもの（勤怠の日付など）。
//                   開いた元は、引数を持った画面の情報を「ウインドウの名前」で預けておき、
//                   開いた先は自分の名前（window.name）で opener.FALCON.apps.procedure.Forms から取り出す
//    アプリでは画面ごとに WebView が分かれていて、元のウインドウが見えない。そこで:
//      - 開く側: 本当には開かず、行き先・ウインドウの名前・引数・App.data をアプリに渡す（アプリが次の画面を重ねる）
//      - 開いた側: ページが動き出す前に、名前を付け、それらを持った「元のウインドウの代わり」を置いておく
//    どれも画面を開くあいだメモリに置くだけで、保存もログもしない。
//
// 3. 「閉じる」でアプリの画面を戻す
//    EZCraft は、開いた画面を window.close() で閉じる。代わりにアプリへ知らせて、ひとつ前の画面に戻る。
//
// 6. PDF・CSV・Excel などのファイルを、アプリに渡す
//    EZCraft は、PDF をページの中で作り（PdfMan）、画面の中に出すか、サーバーに送り返して「添付ファイル」として
//    受け取らせる（/runapp/loopBack）。Excel・CSV は、ページの中で作ったファイルをリンクのクリックで保存させる。
//    アプリの WebView はどれも保存できないので、その手前でファイルの中身（base64）をアプリに渡す。
//    アプリは一時的な場所に置いて、PDF は画面に出し、「保存・共有」から iPhone の「ファイル」などに保存できるようにする。
//
// 5. データを書き込んだら知らせる
//    書き込みの通信（/procedure/BigData/update・insert・delete・upsert など）と、登録・削除・申請などのボタン。
//    アプリは、重ねて開いた画面から戻ったとき、その間に書き込みがあったときだけ元の画面を読み直す。
//    書き込みの通信がうまく終わったら、ページの中にも myapp-saved を出す（勤怠実績登録が、登録のあと残業申請を開くため）
//
// 8. ダイアログ（EZCraft の .tcc-modal と、アプリが出すシート .myapp-pick）が開いているかを知らせる（modal）。
//    開いているあいだは、ヘッダーの ‹ や横へのスワイプで画面ごと戻らず、まずダイアログを閉じる
//    （window.__myappCloseModal。src/components/EzcraftWebView.tsx）
// 7. 別の申請をその場で作る（apply）
//    ページ（勤怠実績登録の残業など）が、申請の画面と、そこに入れておく値を知らせる。アプリは申請の画面をシートで重ねる。
// 9. 保存の進み具合を知らせる（saveStart・saveStep・saveEnd。SAVE_WATCH_JS）
import type { Handoff } from './handoff';

/** ページからアプリへの知らせ */
export type BridgeMessage =
  | { type: 'close' }
  | { type: 'open'; url: string; handoff: Handoff }
  | { type: 'scroll'; y: number; target: string }
  | { type: 'write'; label: string }
  | { type: 'childRefreshed'; ok: boolean }
  | { type: 'title'; text: string }
  | { type: 'file'; base64: string; name: string; mime: string }
  | { type: 'apply'; form: string; prefill: Record<string, string>; auto: boolean }
  | { type: 'initApp'; app: string; form: string; id: string; text: string }
  | { type: 'applyQueue'; form: string; items: Record<string, string>[] }
  | { type: 'modal'; open: boolean }
  | { type: 'tick' }
  | { type: 'skinMissing'; form: string; ids: string[] }
  | { type: 'steps'; id: string; day: string }
  | { type: 'saveStart' }
  | { type: 'saveWait' }
  | { type: 'saveError'; text: string }
  | { type: 'saveStep'; cmd: string; ms: number; ok: boolean; steps: number; writes: number }
  | { type: 'saveEnd'; ok: boolean; steps: number; writes: number; ms: number }
  | { type: 'ready' };

/** ページから来た数（0 以上の整数で、大きすぎないもの）。違えば null */
function count(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

/** 入れておく値: 短い文字だけ（ページから来たものなので、長いものや文字でないものは捨てる） */
function shortValues(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length <= 40) out[key] = v;
    }
  }
  return out;
}

export function parseBridgeMessage(data: string): BridgeMessage | null {
  try {
    const message = JSON.parse(data) as Record<string, unknown>;
    if (message.type === 'close') return { type: 'close' };
    if (message.type === 'write') return { type: 'write', label: typeof message.label === 'string' ? message.label.slice(0, 20) : '' };
    // 重ねて開いた画面から戻ったときの、データだけの読み直し（childClosedJs）ができたか
    if (message.type === 'childRefreshed') return { type: 'childRefreshed', ok: message.ok === true };
    // ページが決めた、いまの画面の名前（勤務表のタブなど。空ならアプリが決めた名前に戻す）
    if (message.type === 'title' && typeof message.text === 'string') return { type: 'title', text: message.text.slice(0, 20) };
    if (message.type === 'file' && typeof message.base64 === 'string' && message.base64) {
      const text = (value: unknown, fallback: string) => (typeof value === 'string' && value ? value : fallback);
      return { type: 'file', base64: message.base64, name: text(message.name, ''), mime: text(message.mime, 'application/octet-stream') };
    }
    if (message.type === 'ready') return { type: 'ready' };
    // 保存の進み具合（SAVE_WATCH_JS）。通信の種類・数・かかった時間だけ
    if (message.type === 'saveStart') return { type: 'saveStart' };
    // ほかの画面の保存が終わるのを待たせた（SAVE_WATCH_JS）
    if (message.type === 'saveWait') return { type: 'saveWait' };
    // 保存に失敗したときに、ページが出したエラーの文（アプリの知らせに出すだけ。200 字まで）
    if (message.type === 'saveError') return { type: 'saveError', text: typeof message.text === 'string' ? message.text.slice(0, 200) : '' };
    if (message.type === 'saveStep') {
      const ms = count(message.ms, 600_000);
      const steps = count(message.steps, 10_000);
      const writes = count(message.writes, 10_000);
      if (typeof message.cmd !== 'string' || !/^[A-Za-z]{1,20}$/.test(message.cmd) || ms === null || steps === null || writes === null) return null;
      return { type: 'saveStep', cmd: message.cmd, ms, ok: message.ok === true, steps, writes };
    }
    if (message.type === 'saveEnd') {
      const ms = count(message.ms, 3_600_000);
      const steps = count(message.steps, 10_000);
      const writes = count(message.writes, 10_000);
      if (ms === null || steps === null || writes === null) return null;
      return { type: 'saveEnd', ok: message.ok === true, steps, writes, ms };
    }
    // ヘルスケアの歩数をください（Walk the Talk の歩数の登録。アプリは stepsReplyJs で答える）
    if (message.type === 'steps' && typeof message.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(message.id) && typeof message.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(message.day)) {
      return { type: 'steps', id: message.id, day: message.day };
    }
    // 開発中だけ: 見た目の直しが名前で指している部品が、画面に見つからない（ezcraftSkin.ts の CHECK_JS）
    if (message.type === 'skinMissing' && typeof message.form === 'string' && Array.isArray(message.ids)) {
      const ids = message.ids.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_]{1,120}$/.test(id));
      return { type: 'skinMissing', form: message.form.slice(0, 80), ids: ids.slice(0, 200) };
    }
    // 時刻のダイヤル（timsSkin.ts の openDial）を1目もり回した
    if (message.type === 'tick') return { type: 'tick' };
    if (message.type === 'modal') return { type: 'modal', open: message.open === true };
    // 画面の定義（src/webview/initApp.ts）。名前と ID の形を確かめる（中身は initAppCache が確かめる）
    if (
      message.type === 'initApp' &&
      typeof message.app === 'string' &&
      /^[A-Za-z0-9_]+$/.test(message.app) &&
      typeof message.form === 'string' &&
      /^[A-Za-z0-9_]+$/.test(message.form) &&
      typeof message.id === 'string' &&
      /^[A-Za-z0-9_\-+/=.]{1,80}$/.test(message.id) &&
      typeof message.text === 'string' &&
      message.text.length < 8_000_000
    ) {
      return { type: 'initApp', app: message.app, form: message.form, id: message.id, text: message.text };
    }
    if (message.type === 'apply' && typeof message.form === 'string' && /^[A-Za-z0-9_]+$/.test(message.form)) {
      return { type: 'apply', form: message.form, prefill: shortValues(message.prefill), auto: message.auto === true };
    }
    // まとめて申請（勤務表の「残業をまとめて申請」）: 入れておく値の組を、1日ずつ（多くても1か月分）
    if (message.type === 'applyQueue' && typeof message.form === 'string' && /^[A-Za-z0-9_]+$/.test(message.form) && Array.isArray(message.items)) {
      const items = (message.items as unknown[]).slice(0, 31).map(shortValues).filter((v) => Object.keys(v).length > 0);
      return items.length > 0 ? { type: 'applyQueue', form: message.form, items } : null;
    }
    if (message.type === 'scroll' && typeof message.y === 'number') {
      return { type: 'scroll', y: message.y, target: typeof message.target === 'string' ? message.target : '' };
    }
    if (message.type === 'open' && typeof message.url === 'string') {
      const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
      return {
        type: 'open',
        url: message.url,
        handoff: { appData: text(message.appData), name: text(message.name), params: text(message.params) },
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** ページを読み込んだあとに入れる（1・2の開く側・3） */
export const BRIDGE_JS = `
(function () {
  if (window.__myappBridge) return;
  window.__myappBridge = true;
  var post = function (message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); };

  // 1. ボタンは1回のタップで押す
  var start = null;
  document.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    start = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, time: Date.now() } : null;
  }, { capture: true, passive: true });
  document.addEventListener('touchend', function (e) {
    if (!start) return;
    var t = e.changedTouches[0];
    var moved = Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10;
    var long = Date.now() - start.time > 600;
    start = null;
    if (moved || long) return;
    if (!e.target.closest) return;
    // 表の行: 押した場所に、マウスで押したときと同じ知らせ（mousedown → mouseup → click）を送る。
    // 同じ行をすぐにもう一度押したら、ダブルクリックとして送る（パソコンと同じく、選んで決める画面がある）
    var tr = e.target.closest('.TccGridBodyScroll tr');
    if (tr) {
      // EZCraft は、押されたのが列の中身（_col の付いた div）のときだけ行を選ぶ。
      // 行の余白（カードにした行のふち）を押したときは、その行の見えている最初の列を押したことにする
      var cell = e.target.closest('td');
      if (!cell || getComputedStyle(cell).display === 'none') {
        cell = Array.prototype.find.call(tr.children, function (td) {
          return td.tagName === 'TD' && !/rowHead|_tdCol0(?!\\d)/.test(td.className) && getComputedStyle(td).display !== 'none';
        });
      }
      if (!cell) return;
      var hit = e.target.closest('td') === cell ? e.target : cell.firstElementChild || cell;
      e.preventDefault();
      var opts = { bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY };
      ['mousedown', 'mouseup', 'click'].forEach(function (type) { hit.dispatchEvent(new MouseEvent(type, opts)); });
      // 押した行にしるしを付ける（EZCraft の表には、選んでも色が変わらないものがあるため。色は skin の CSS）
      Array.prototype.forEach.call(tr.parentElement.children, function (r) { if (r !== tr) r.classList.remove('myapp-tapped'); });
      tr.classList.add('myapp-tapped');
      var now = Date.now();
      if (lastRow && lastRow.tr === tr && now - lastRow.time < 400) {
        hit.dispatchEvent(new MouseEvent('dblclick', opts));
        lastRow = null;
      } else {
        lastRow = { tr: tr, time: now };
      }
      // 行を押したら決まるダイアログ（skin が data-myapp-pick に OK ボタンを書く）: 選んだらそのまま決める
      var pick = tr.closest('[data-myapp-pick]');
      if (pick) {
        setTimeout(function () {
          var ok = pick.querySelector(pick.getAttribute('data-myapp-pick'));
          if (ok) ok.click();
        }, 150);
      }
      return;
    }
    // タブの見出し: EZCraft は、マウスで押したときの知らせ（mousedown → mouseup → click）で切り替える。
    // iOS に任せると、1回目のタップが「マウスを乗せただけ」になり、2回押さないと切り替わらない
    var tab = e.target.closest('ul.tcc-tab-head > li > a, ul.tcc-tab-head > li');
    if (tab) {
      var li = tab.tagName === 'LI' ? tab : tab.closest('li');
      var a = tab.tagName === 'A' ? tab : tab.querySelector('a') || tab;
      e.preventDefault();
      var o = { bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY };
      var pressTab = function () { ['mousedown', 'mouseup', 'click'].forEach(function (type) { a.dispatchEvent(new MouseEvent(type, o)); }); };
      pressTab();
      // EZCraft は、ページを開いた直後などに1回目を受け付けないことがある。切り替わっていなければ、もう一度押す
      var at = Date.now();
      lastTab = at;
      [350, 1000].forEach(function (ms) {
        setTimeout(function () { if (lastTab === at && li && li.isConnected && !li.classList.contains('active')) pressTab(); }, ms);
      });
      return;
    }
    // お知らせ・確認のメッセージの OK などと、ダイアログの × も、1回のタップで押す
    var button = e.target.closest('a.tcc-btn, button, .tcc-msg-box-btn, .tcc-msg-box-quit, .tcc-modal-quit');
    if (!button || button.closest('[disabled], .disabled')) return;
    e.preventDefault(); // iOS が自分で mouse の知らせや click を出さないように（2回押したことになるのを防ぐ）
    if (button.focus) button.focus();
    button.click();
  }, { capture: true, passive: false });
  var lastRow = null;
  var lastTab = 0;

  // 2. 新しいウインドウで開く → 行き先・ウインドウの名前・引数・App.data をアプリに渡す
  //    （ファイルの中身そのもの（data:）を開こうとしたときは、6 のファイルとして渡す）
  var realOpen = window.open;
  window.open = function (url, target) {
    if (target === '_self' || target === '_top' || target === '_parent') return realOpen.apply(window, arguments);
    if (/^data:/.test(String(url || ''))) {
      sendFile(String(url), '', '');
      return { closed: false, close: function () {}, focus: function () {}, blur: function () {}, postMessage: function () {}, location: {} };
    }
    var P = window.FALCON && FALCON.apps && FALCON.apps.procedure;
    var name = target && target !== '_blank' ? String(target) : null;
    var appData = null;
    var params = null;
    try { appData = JSON.stringify(P && P.App.data); } catch (e) {}
    try {
      var cached = name && P && P.Forms && P.Forms._getCashedform && P.Forms._getCashedform(name);
      if (cached && cached.getParams) params = JSON.stringify(cached.getParams());
    } catch (e) {}
    post({ type: 'open', url: new URL(String(url), location.href).href, appData: appData || null, name: name, params: params || null });
    // 開いたウインドウを返す約束なので、何もしない代わりを返す
    return { closed: false, close: function () {}, focus: function () {}, blur: function () {}, postMessage: function () {} };
  };

  // 3. window.close() → アプリに「閉じて」と知らせる
  window.close = function () { post({ type: 'close' }); };

  // 4. スクロールの位置をアプリに知らせる（別の画面から戻って読み直したとき、同じ位置に戻すため）。
  //    EZCraft は、ページ全体ではなく中の箱（#main など）をスクロールさせることがあるので、どれが動いたかも知らせる
  var scrollTimer = null;
  document.addEventListener('scroll', function (e) {
    var el = e.target;
    var page = el === document || el === document.documentElement || el === document.body;
    if (!page && !el.id) return; // 名前のない小さな箱（表の中など）は覚えない
    if (!page && el.closest && el.closest('.tcc-modal, .TccGridContainer')) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      post({ type: 'scroll', y: Math.round(page ? window.scrollY : el.scrollTop), target: page ? '' : '#' + el.id });
    }, 200);
  }, { capture: true, passive: true });

  // 6. PDF・CSV・Excel などのファイルを、アプリに渡す（中身は base64。アプリが一時的に置いて、見せる・保存させる）
  var sendFile = function (data, name, mime) {
    // 名前がなければ、アプリごとの決め方（appStyles.ts の script が window.__myappFileName を決める）で
    if (!name && typeof window.__myappFileName === 'function') { try { name = window.__myappFileName() || ''; } catch (e) {} }
    var m = /^data:([^;,]*)(;base64)?,/.exec(data || '');
    var base64 = m ? data.slice(m[0].length) : data;
    if (!base64) return;
    post({ type: 'file', base64: base64, name: name || '', mime: (m && m[1]) || mime || 'application/octet-stream' });
  };
  // PDF（PdfMan）: 画面に出す・新しいウインドウで開く・ダウンロードする、のどれも、アプリに渡す
  function patchPdfMan() {
    var P = window.FALCON && FALCON.apps && FALCON.apps.procedure && FALCON.apps.procedure.PdfMan;
    if (!P || P.prototype.__myappFiles) return;
    P.prototype.__myappFiles = true;
    P.prototype._showPdfView = function (base64) { sendFile(base64, '', 'application/pdf'); };
    P.prototype._download = function (base64, name) { sendFile(base64, name, 'application/pdf'); };
    P.prototype._openPdfWindow = function () { this.win = { close: function () {} }; return Promise.resolve(true); };
    P.prototype._showPdfWindow = function (base64) { sendFile(base64, '', 'application/pdf'); };
  }
  patchPdfMan();
  setTimeout(patchPdfMan, 1000);
  // サーバーに送り返して添付ファイルとして受け取る形（/runapp/loopBack）: 送らずに、中身をアプリに渡す
  var formSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () {
    try {
      if (/\\/runapp\\/loopBack\\/?$/.test(this.getAttribute('action') || '')) {
        var field = function (form, name) { var el = form.querySelector('[name="' + name + '"]'); return el ? el.value : ''; };
        var data = field(this, 'base64');
        if (data) {
          var type = field(this, 'contentType');
          sendFile(data, field(this, 'attachmentFilename'), /octet-stream/.test(type) ? '' : type);
          return;
        }
      }
    } catch (e) {}
    return formSubmit.apply(this, arguments);
  };
  // ページの中で作ったファイルを、リンク（download 付き）のクリックで保存させる形（Excel・CSV など）
  function readLink(a) {
    var href = a.href || '';
    if (!a.hasAttribute('download') || !/^(blob|data):/.test(href)) return false;
    var name = a.getAttribute('download') || '';
    if (/^data:/.test(href)) { sendFile(href, name, ''); return true; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', href);
    xhr.responseType = 'blob';
    xhr.onload = function () {
      var reader = new FileReader();
      reader.onload = function () { sendFile(String(reader.result || ''), name, xhr.response && xhr.response.type); };
      reader.readAsDataURL(xhr.response);
    };
    xhr.send();
    return true;
  }
  var linkClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (readLink(this)) return;
    return linkClick.apply(this, arguments);
  };
  var dispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (event) {
    if (this instanceof HTMLAnchorElement && event && event.type === 'click' && readLink(this)) return false;
    return dispatch.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[download]');
    if (a && readLink(a)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // 5. データを書き込んだら、アプリに知らせる（書き込みの通信と、登録・削除・申請などのボタン）
  var wrote = function (label) { post({ type: 'write', label: label || '' }); };
  var xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      if (/\\/(update|insert|delete|upsert)\\/?$/i.test(String(url).split('?')[0])) {
        wrote();
        // 書き込みがうまく終わったら、ページの中に知らせる
        this.addEventListener('load', function () {
          if (this.status >= 200 && this.status < 300) window.dispatchEvent(new Event('myapp-saved'));
        });
      }
    } catch (e) {}
    return xhrOpen.apply(this, arguments);
  };
  var WRITE_LABEL = /登録|削除|申請|更新|保存|取消|取り消|承認|却下|確定|送信/;
  var NOT_WRITE_LABEL = /コピー|検索|クリア|閉じる|キャンセル|戻る/;
  document.addEventListener('click', function (e) {
    var button = e.target && e.target.closest && e.target.closest('.tcc-btn');
    if (!button) return;
    var label = (button.textContent || '').replace(/\\s+/g, '');
    // 押したボタンの名前も知らせる（登録が終わってこの画面が閉じたとき、元の画面に「登録」で閉じたと伝えるため）
    if (label && WRITE_LABEL.test(label) && !NOT_WRITE_LABEL.test(label)) wrote(label.slice(0, 20));
  }, true);

  // 8. ダイアログが開いているかを知らせる。閉じるボタン（×）のあるものだけ（ない「お知らせ」は、OK で閉じる）
  function topModalQuit() {
    // アプリがページの上に出すシート（今月のプロジェクト・残業をまとめて申請。timsSkin.ts。年月・日付を選ぶシート。ezcraftSkin.ts）がいちばん上。
    // 後ろの暗い面を押すと閉じる。開いているあいだは、横にずらしても画面ごと戻らないようにする
    var sheet = document.querySelector('.myapp-pick-back, .myapp-cal-back');
    if (sheet) return sheet;
    // 確認のメッセージ（スマホでは EZCraft が .tcc-msg-bar で出す。削除確認など）。× がないので、
    // 戻る操作は「キャンセル」「いいえ」を押したことにする（ボタンが1つだけなら、それで閉じる）。決める方は押さない
    var bar = document.querySelector('.tcc-msg-bar-back');
    if (bar) {
      var buttons = Array.prototype.slice.call(bar.querySelectorAll('.tcc-msg-bar-btn'));
      var cancel = buttons.filter(function (b) { return /^(キャンセル|いいえ|閉じる)$/.test((b.textContent || '').trim()); })[0];
      if (cancel) return cancel;
      if (buttons.length === 1) return buttons[0];
    }
    var best = null;
    var bestZ = -Infinity;
    document.querySelectorAll('.tcc-modal').forEach(function (m) {
      var r = m.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var cs = getComputedStyle(m);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var quit = m.querySelector('.tcc-modal-quit');
      if (!quit) return;
      var z = parseInt(cs.zIndex, 10) || 0;
      if (z >= bestZ) { bestZ = z; best = quit; }
    });
    return best;
  }
  window.__myappCloseModal = function () {
    var quit = topModalQuit();
    if (quit) quit.click();
  };
  var modalOpen = false;
  setInterval(function () {
    var open = topModalQuit() !== null;
    if (open === modalOpen) return;
    modalOpen = open;
    post({ type: 'modal', open: open });
  }, 300);
})();
true;
`;

/**
 * 9. 保存の進み具合を、アプリに知らせる（ページを読み込んだあとに入れる）。
 *
 * EZCraft の保存は、トランザクションの始め（beginTrans）→ 読む・書く通信を1つずつ順に → 確定（commit）か取り消し（rollBack）。
 * 勤怠実績の登録では、通信が 37 回・8〜9 秒かかった（2026-11-18 に測った。1 秒ほどの読み込みが 5 回と、2.6 秒の削除が 1 回）。
 * アプリはこれを見て「保存しています（n/m）」と、長いときの声かけを出し、保存の途中で画面ごと戻らないようにする
 * （戻ると、ページが消えて確定が送られず、保存が途中で切れる。src/components/EzcraftWebView.tsx）。
 *
 * 知らせるのは、通信の種類（insert など）・かかった時間・数だけ。データの中身は送らない。
 *   - 始まり: beginTrans。トランザクションを使わない画面は、書き込みのボタンを押してから 5 秒以内の書き込みの通信
 *   - 終わり: 自分のトランザクションの commit・rollBack。使わない画面は、通信が止んで 1 秒たったとき
 *     （EZCraft は、表を開くたびに、ほかの人の 100 秒を超えたトランザクションを rollBack する。番号が違うので、それでは終わらない）
 * 保存のあいだは、EZCraft の読み込み中の印を隠す（アプリが代わりに出す）。押せないようにする面はそのまま残す。
 *
 * 保存は、アプリ全体で1つずつ（src/webview/backgroundSaves.ts）。ほかの画面が保存しているあいだ（アプリが
 * window.__myappSaveBusy を立てる）は、書き込みのボタンを押しても EZCraft に渡さずに待たせ（saveWait）、
 * 終わったら（アプリが window.__myappSaveFree を呼ぶ）押し直す
 */
export const SAVE_WATCH_JS = `
(function () {
  if (window.__myappSaveWatch) return;
  window.__myappSaveWatch = true;
  var post = function (message) { try { window.ReactNativeWebView.postMessage(JSON.stringify(message)); } catch (e) {} };
  var DB_URL = /\\/(?:procedure\\/BigData|tblCmn)\\/([A-Za-z]+)\\/?(?:\\?(.*))?$/;
  var WRITE_CMD = /^(insert|update|upsert|delete|delIns)$/;
  var WRITE_LABEL = /登録|削除|申請|更新|保存|取消|取り消|承認|却下|確定|送信/;
  var NOT_WRITE_LABEL = /コピー|検索|クリア|閉じる|キャンセル|戻る/;
  var saving = null;
  var armedAt = 0;
  var held = null; // ほかの画面の保存が終わるのを待っている、押されたボタン

  document.addEventListener('click', function (e) {
    var button = e.target && e.target.closest && e.target.closest('.tcc-btn');
    var label = button ? (button.textContent || '').replace(/\\s+/g, '') : '';
    if (!label || !WRITE_LABEL.test(label) || NOT_WRITE_LABEL.test(label)) return;
    // ほかの画面が保存している（アプリが __myappSaveBusy で知らせる）。いまは押さず、終わってから押す
    if (window.__myappSaveBusy) {
      e.preventDefault();
      e.stopImmediatePropagation();
      held = e.target;
      post({ type: 'saveWait' });
      return;
    }
    armedAt = Date.now();
  }, true);
  // アプリが「ほかの保存が終わった」と知らせてくる。待たせていたボタンを押す
  window.__myappSaveFree = function () {
    window.__myappSaveBusy = false;
    var target = held;
    held = null;
    if (target && target.isConnected) target.click();
  };

  function start() {
    saving = { at: Date.now(), steps: 0, writes: 0, pending: 0, trans: '', idle: null };
    document.documentElement.classList.add('myapp-saving');
    post({ type: 'saveStart' });
  }
  function end(ok) {
    if (!saving) return;
    clearTimeout(saving.idle);
    post({ type: 'saveEnd', ok: ok, steps: saving.steps, writes: saving.writes, ms: Date.now() - saving.at });
    saving = null;
    document.documentElement.classList.remove('myapp-saving');
    // 失敗したら、EZCraft が出したエラーの知らせの文を、少し待ってから知らせる（裏で保存していたとき、アプリが理由として出す）
    if (!ok) setTimeout(function () { post({ type: 'saveError', text: errorText() }); }, 400);
  }
  function errorText() {
    var boxes = Array.prototype.filter.call(document.querySelectorAll('.tcc-msg-box, .tcc-modal'), function (b) { return b.offsetParent !== null; });
    var box = boxes[boxes.length - 1];
    if (!box) return '';
    return (box.innerText || '').split('\\n').map(function (line) { return line.trim(); })
      .filter(function (line) { return line && !/^(OK|はい|いいえ|キャンセル|閉じる|×)$/.test(line); })
      .join(' ').slice(0, 200);
  }
  function done(xhr) {
    var db = xhr.__myappDb;
    if (!db || db.done || !db.save || db.save !== saving) return;
    db.done = true;
    var small = db.cmd === 'beginTrans' || db.cmd === 'commit' || db.cmd === 'rollBack';
    var head = '';
    try { head = String(xhr.responseText || '').slice(0, small ? 4000 : 300); } catch (e) {}
    var ok = xhr.status >= 200 && xhr.status < 300 && !/"status"\\s*:\\s*"error"/.test(head);
    saving.pending -= 1;
    saving.steps += 1;
    if (db.cmd === 'beginTrans' || db.cmd === 'commit' || WRITE_CMD.test(db.cmd)) saving.writes += 1;
    if (db.cmd === 'beginTrans' && !saving.trans) saving.trans = (/"transID"\\s*:\\s*"?(\\d+)/.exec(head) || [])[1] || '';
    post({ type: 'saveStep', cmd: db.cmd, ms: Date.now() - db.at, ok: ok, steps: saving.steps, writes: saving.writes });
    if ((db.cmd === 'commit' || db.cmd === 'rollBack') && (!saving.trans || db.trans === saving.trans)) {
      end(db.cmd === 'commit' && ok);
      return;
    }
    if (!saving.trans && saving.pending === 0) {
      var current = saving;
      current.idle = setTimeout(function () { if (saving === current && current.pending === 0) end(true); }, 1000);
    }
  }

  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, async) {
    this.__myappDb = null;
    try {
      var m = DB_URL.exec(String(url));
      if (m) this.__myappDb = { cmd: m[1], trans: (/(?:^|&)transId=(\\d+)/.exec(m[2] || '') || [])[1] || '', sync: async === false };
    } catch (e) {}
    return open.apply(this, arguments);
  };
  var send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    var db = this.__myappDb;
    if (db) {
      try {
        if (!saving && (db.cmd === 'beginTrans' || (WRITE_CMD.test(db.cmd) && Date.now() - armedAt < 5000))) start();
        if (saving) {
          db.save = saving;
          db.at = Date.now();
          saving.pending += 1;
          clearTimeout(saving.idle);
          if (!db.sync) xhr.addEventListener('loadend', function () { done(xhr); });
        }
      } catch (e) {}
    }
    try {
      return send.apply(this, arguments);
    } finally {
      // 同期の通信（beginTrans・commit など）は、send が戻ったときに終わっている
      if (db && db.sync && db.save) done(xhr);
    }
  };
})();
true;
`;

/** ページが動き出す前に入れる（2の開いた側）。handoff は開いた元から預かったもの */
export function openerStubJs(handoff: Handoff | null): string {
  if (!handoff || (!handoff.appData && !handoff.name)) return 'true;';
  return `
(function () {
  try {
    var name = ${JSON.stringify(handoff.name)};
    var data = JSON.parse(${JSON.stringify(handoff.appData ?? '{}')});
    var params = JSON.parse(${JSON.stringify(handoff.params ?? '{}')}) || {};
    if (name) window.name = name;

    // 開いた元が Forms('画面') で作り、名前で預けておく「画面の情報」の代わり（引数の出し入れだけ）
    var cached = { uniqueId: name };
    Object.defineProperties(cached, {
      getParam: { value: function (key) { return key && key in params ? params[key] : key && key in this ? this[key] : null; } },
      getParams: { value: function () { return params; } },
      setParam: { value: function (key, value) { params[key] = value; } },
      closedCb: { value: function () {}, writable: true },
      closed: { value: function (cb) { this.closedCb = cb; } }
    });
    var forms = {
      _getUniqueId: function () { return name || ''; }, // 開いた元が最後に開いた画面の名前（= この画面）
      _getCashedform: function (id) { return name && id === name ? cached : undefined; },
      _delCashedform: function () {}
    };
    var app = { data: data };
    window.opener = { closed: false, App: app, FALCON: { apps: { procedure: { App: app, Forms: forms } } } };
  } catch (e) {}
})();
true;
`;
}

/**
 * 近道のために、ページの準備ができたら決まったボタンを1回押す。
 * readyKey があれば App.data にそのデータ（ログインした人の情報など）が入るのを待つ。
 * どちらの場合も、ボタンが見えていて、EZCraft の読み込み中の表示が出ていないことを待ってから押す。
 * 押した結果開く画面は、アプリがこの画面と入れ替えて出す（EzcraftWebView の autoClick。残りの段はその画面で押す）。
 */
export function autoClickJs(button: string, readyKey: string): string {
  return `
(function () {
  var tries = 0;
  var stable = 0;
  var timer = setInterval(function () {
    tries++;
    if (tries > 120) { clearInterval(timer); return; }
    var P = window.FALCON && FALCON.apps && FALCON.apps.procedure;
    var data = P && P.App && P.App.data;
    var readyKey = ${JSON.stringify(readyKey)};
    if (readyKey && !(data && data[readyKey])) return;
    var loading = document.getElementById('loadingIcon');
    if (loading && loading.offsetParent !== null) { stable = 0; return; }
    var target = document.querySelector('#' + ${JSON.stringify(button)} + ' .tcc-btn');
    if (!target || target.getBoundingClientRect().width === 0) { stable = 0; return; }
    if (++stable < 3) return; // 描き終わって落ち着くまで、少し待つ
    clearInterval(timer);
    target.click();
  }, 150);
})();
true;
`;
}

/**
 * 読み直したページを、前のスクロール位置に戻す。
 * EZCraft は中身をあとから描くので、ページがその位置まで伸びるのを待ってから戻す（長くても数秒であきらめる）
 */
export function restoreScrollJs(position: { y: number; target: string }): string {
  if (position.y <= 0) return '';
  return `
(function () {
  var y = ${Math.round(position.y)};
  var target = ${JSON.stringify(position.target)};
  // EZCraft は描き終わったあとに先頭へ戻すことがあるので、戻せてからもしばらく（2.5秒）見張る。
  // 指で触ったら、それ以上は動かさない（使う人のスクロールを邪魔しない）
  var start = Date.now();
  var reached = 0;
  var touched = false;
  document.addEventListener('touchstart', function () { touched = true; }, { capture: true, once: true });
  var timer = setInterval(function () {
    if (touched || Date.now() - start > 10000) { clearInterval(timer); return; }
    var el = target ? document.querySelector(target) : document.scrollingElement || document.documentElement;
    if (!el) return;
    if (Math.abs(el.scrollTop - y) >= 4 && el.scrollHeight >= y + el.clientHeight * 0.5) el.scrollTop = y;
    if (Math.abs(el.scrollTop - y) < 4) {
      if (!reached) reached = Date.now();
      else if (Date.now() - reached > 2500) clearInterval(timer);
    }
  }, 150);
})();
true;
`;
}

/**
 * 重ねて開いた画面が「登録」などで閉じて戻ってきたときに、元の画面で走らせる。
 * ページを丸ごと読み直す代わりに、Web 版と同じく、その画面が用意した「閉じたあとの処理」（データだけ読み直す）を呼ぶ。
 * できる画面だけ（アプリごとの調整が window.__myappChildClosed を用意したもの）。できたかどうかを childRefreshed で返す
 */
export function childClosedJs(label: string): string {
  return `
(function () {
  var ok = false;
  try { ok = !!(window.__myappChildClosed && window.__myappChildClosed(${JSON.stringify(label)})); } catch (e) {}
  try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'childRefreshed', ok: ok })); } catch (e) {}
})();
true;
`;
}

/**
 * ヘルスケアが使えることを、ページが動き出す前に知らせる（使えるときだけ、歩数の登録に「ヘルスケアから入れる」を出す）
 */
export function healthFlagJs(available: boolean): string {
  return available ? 'window.__myappHealth = true;\n' : '';
}

/** ページが頼んだ歩数を返す（steps が null なら、読めなかった） */
export function stepsReplyJs(id: string, steps: number | null): string {
  return `window.__myappStepsReply && window.__myappStepsReply(${JSON.stringify(id)}, ${steps === null ? 'null' : Math.max(0, Math.round(steps))}); true;`;
}
