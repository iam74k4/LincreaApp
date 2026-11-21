// ページの中で、画面の定義（initApp）の読み込みに、アプリの控えで答える（控えは src/webview/initAppCache.ts）。
//
// EZCraft のページは、動き出すと /RunApp/initApp/?appid=…&formid=…&id=… を XMLHttpRequest（jQuery）で読み、
// 中身の JavaScript を実行して画面を作る。ここでは、ページが動き出す前に XMLHttpRequest に手を入れて:
//   - 控えがあり、同じアプリ・同じ画面の要求なら: 通信せずに、読み終わったことにして控えを渡す（1回だけ）
//   - 控えがなければ: ふつうに読み、読めたら中身をアプリに渡して控えてもらう（次から速い）
// ほかの通信には何もしない。
import type { InitAppForm } from './initAppCache';
import type { RefModeReply } from './refModeCache';

/** ページが動き出す前に入れる。cached は、この画面の定義の控え（なければ null） */
export function initAppJs(cached: (InitAppForm & { id: string; text: string }) | null): string {
  return `(function () {
  if (window.__myappInitApp) return;
  window.__myappInitApp = true;
  var cached = ${cached ? JSON.stringify(cached) : 'null'};
  var open = XMLHttpRequest.prototype.open;
  var send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__myappInitAppUrl = /\\/RunApp\\/initApp\\//i.test(String(url)) ? String(url) : null;
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    var url = xhr.__myappInitAppUrl;
    if (!url) return send.apply(this, arguments);
    var q = {};
    try { new URL(url, location.href).searchParams.forEach(function (v, k) { q[k] = v; }); } catch (e) { return send.apply(this, arguments); }

    // 同じ画面でも、ID が違えば（EZCraft で画面を出し直した）控えは使わない。古い画面の定義で動かさないように
    if (cached && q.appid === cached.app && q.formid === cached.form && q.id === cached.id) {
      var text = cached.text;
      cached = null; // 控えで答えるのは1回だけ
      var set = function (name, value) { Object.defineProperty(xhr, name, { configurable: true, get: function () { return value; } }); };
      set('readyState', 4);
      set('status', 200);
      set('statusText', 'OK');
      set('responseText', text);
      set('response', text);
      set('responseURL', new URL(url, location.href).href);
      xhr.getAllResponseHeaders = function () { return 'content-type: text/html; charset=utf-8\\r\\n'; };
      xhr.getResponseHeader = function (name) { return /^content-type$/i.test(String(name)) ? 'text/html; charset=utf-8' : null; };
      setTimeout(function () {
        ['readystatechange', 'load', 'loadend'].forEach(function (type) {
          try { xhr.dispatchEvent(new Event(type)); } catch (e) {}
        });
      }, 0);
      return;
    }

    xhr.addEventListener('load', function () {
      try {
        if (xhr.status !== 200 || typeof xhr.responseText !== 'string' || !q.appid || !q.formid || !q.id) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'initApp', app: q.appid, form: q.formid, id: q.id, text: xhr.responseText }));
      } catch (e) {}
    });
    return send.apply(this, arguments);
  };
})();
true;
`;
}

/**
 * ページが動き出す前に入れる。ログインした人の「参照モード」（/user/getRefMode/）の問い合わせに、アプリの控えで答える
 * （なぜ・控えの持ち方は src/webview/refModeCache.ts）。cached は、問い合わせの方法と中身ごとの返事の控え。
 *   - 控えがあれば: 通信せずに、読み終わったことにして控えを渡す（同期の問い合わせなら、その場で。非同期なら、すぐあとで）
 *   - 控えがなければ: ふつうに聞き、答えられたら返事をアプリに渡して控えてもらう（次に開く画面から速い）
 * 中身が文字でない問い合わせと、ほかの通信には何もしない。
 */
export function refModeJs(cached: Record<string, RefModeReply>): string {
  return `(function () {
  if (window.__myappRefMode) return;
  window.__myappRefMode = true;
  var cached = ${JSON.stringify(cached)};
  var open = XMLHttpRequest.prototype.open;
  var send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, async) {
    this.__myappRefModeReq = /\\/user\\/getRefMode\\/?(?:[?#]|$)/i.test(String(url))
      ? { url: String(url), method: String(method || 'GET').toUpperCase(), sync: async === false }
      : null;
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    var xhr = this;
    var req = xhr.__myappRefModeReq;
    if (!req || (body != null && typeof body !== 'string')) return send.apply(this, arguments);
    var key = req.method + ' ' + (body == null ? '' : body);
    var hit = Object.prototype.hasOwnProperty.call(cached, key) ? cached[key] : null;
    if (hit) {
      var set = function (name, value) { Object.defineProperty(xhr, name, { configurable: true, get: function () { return value; } }); };
      set('readyState', 4);
      set('status', 200);
      set('statusText', 'OK');
      set('responseText', hit.text);
      set('response', hit.text);
      set('responseURL', new URL(req.url, location.href).href);
      var headers = hit.type ? 'content-type: ' + hit.type + '\\r\\n' : '';
      xhr.getAllResponseHeaders = function () { return headers; };
      xhr.getResponseHeader = function (name) { return /^content-type$/i.test(String(name)) && hit.type ? hit.type : null; };
      var fire = function () {
        ['readystatechange', 'load', 'loadend'].forEach(function (type) {
          try { xhr.dispatchEvent(new Event(type)); } catch (e) {}
        });
      };
      if (req.sync) fire(); else setTimeout(fire, 0);
      return;
    }
    xhr.addEventListener('load', function () {
      try {
        if (xhr.status !== 200 || typeof xhr.responseText !== 'string' || xhr.responseText.length > 2000) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'refMode', key: key, text: xhr.responseText, contentType: xhr.getResponseHeader('content-type') || '' }));
      } catch (e) {}
    });
    return send.apply(this, arguments);
  };
})();
true;
`;
}
