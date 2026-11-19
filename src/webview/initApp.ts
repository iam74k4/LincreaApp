// ページの中で、画面の定義（initApp）の読み込みに、アプリの控えで答える（控えは src/webview/initAppCache.ts）。
//
// EZCraft のページは、動き出すと /RunApp/initApp/?appid=…&formid=…&id=… を XMLHttpRequest（jQuery）で読み、
// 中身の JavaScript を実行して画面を作る。ここでは、ページが動き出す前に XMLHttpRequest に手を入れて:
//   - 控えがあり、同じアプリ・同じ画面の要求なら: 通信せずに、読み終わったことにして控えを渡す（1回だけ）
//   - 控えがなければ: ふつうに読み、読めたら中身をアプリに渡して控えてもらう（次から速い）
// ほかの通信には何もしない。
import type { InitAppForm } from './initAppCache';

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
