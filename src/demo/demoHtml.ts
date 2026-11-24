// デモのページの外枠（色・部品の見た目・アプリへの知らせ）。ページは文字で作り、WebView に html として渡す
// （src/components/DemoAppView.tsx）。サーバーのページは読まない。
//
// 色は、本物のページにかぶせている色（src/webview/page/ezcraftSkin.ts の --myapp-*）と同じ。ライト / ダークは端末に合わせる。
//
// ページからアプリへの知らせ（window.ReactNativeWebView.postMessage の JSON）:
//   { type: 'open', app, form, q, sheet } … 次の画面を開く（data-open を付けたものを押したとき）
//   { type: 'action', id, action, data, back } … 登録・申請（data-action を付けた form・ボタン）。返事は window.__demoResult(id, ok, message)
//   { type: 'steps', id, day } … その日の歩数を端末から読む。返事は window.__demoSteps(id, steps)
//   { type: 'back' } … この画面を閉じる

/** 文字を HTML に入れられる形にする */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 値を <script> の中に入れられる JSON にする（</script> で閉じられないように） */
export function jsonForScript(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** 1,234 円 */
export function yen(n: number): string {
  return `${n.toLocaleString('ja-JP')} 円`;
}

/** 次の画面を開くリンクの属性（q は「key=value&...」） */
export function openAttrs(form: string, q: Record<string, string> = {}, options: { app?: string; sheet?: boolean } = {}): string {
  const query = new URLSearchParams(q).toString();
  return [
    `data-open="${esc(form)}"`,
    query ? `data-q="${esc(query)}"` : '',
    options.app ? `data-app="${esc(options.app)}"` : '',
    options.sheet ? 'data-sheet="1"' : '',
    'role="button"',
  ]
    .filter(Boolean)
    .join(' ');
}

export type PageOptions = {
  appId: string;
  body: string;
  /** ページだけで使う JavaScript */
  script?: string;
  /** 画面の下に空ける高さ（ホームに戻るバーのぶん） */
  bottomInset?: number;
};

const CSS = `
:root {
  color-scheme: light dark;
  --bg: #F2F2F7; --surface: #FFFFFF; --inset: #F2F2F7; --text: #111114; --text2: #6E6E73; --border: #E3E3E8;
  --accent: #007AFF; --selected: rgba(0, 122, 255, 0.12); --warn: #C93400; --danger: #D92D20; --success: #1E7B34;
  --ok-bg: #E3F5E7; --warn-bg: #FFF1D6; --ng-bg: #FDE7E5;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000; --surface: #1C1C1E; --inset: #2C2C2E; --text: #F5F5F7; --text2: #98989F; --border: #2C2C2E;
    --accent: #0A84FF; --selected: rgba(10, 132, 255, 0.18); --warn: #FF9F0A; --danger: #FF6B5E; --success: #7EE2A0;
    --ok-bg: #123620; --warn-bg: #3A2A09; --ng-bg: #3D1714;
  }
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; background: var(--bg); color: var(--text); }
body {
  font: 17px/1.4 -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  padding: 8px 0 calc(32px + var(--safe-bottom, 0px));
  -webkit-text-size-adjust: 100%;
}
.demo-banner {
  margin: 4px 16px 12px; padding: 8px 12px; border-radius: 12px; background: var(--warn-bg); color: var(--warn);
  font-size: 13px; line-height: 1.35;
}
h2 { margin: 20px 20px 8px; font-size: 13px; font-weight: 600; color: var(--text2); }
.card { margin: 0 16px 16px; background: var(--surface); border-radius: 22px; overflow: hidden; }
.pad { padding: 14px 16px; }
.row {
  display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 10px 16px; position: relative;
  color: inherit; text-decoration: none;
}
.row + .row::before { content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 0.5px solid var(--border); }
[data-open].row:active, .row.tap:active { background: var(--inset); }
.row .main { flex: 1; min-width: 0; }
.row .title { font-size: 17px; }
.row .sub { font-size: 13px; color: var(--text2); margin-top: 2px; }
.row .value { color: var(--text2); font-size: 15px; text-align: right; white-space: nowrap; }
.chev::after { content: '›'; color: var(--text2); font-size: 22px; line-height: 1; margin-left: 4px; }
.tile {
  width: 40px; height: 40px; border-radius: 10px; background: var(--selected); color: var(--accent);
  display: flex; align-items: center; justify-content: center; font-size: 20px; flex: none;
}
.tag { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.tag.ok { color: var(--success); background: var(--ok-bg); }
.tag.wait { color: var(--warn); background: var(--warn-bg); }
.tag.ng { color: var(--danger); background: var(--ng-bg); }
.tag.off { color: var(--text2); background: var(--inset); }
.big { font-size: 34px; font-weight: 700; letter-spacing: 0.5px; }
.muted { color: var(--text2); font-size: 13px; }
.center { text-align: center; }
label.field { display: block; padding: 10px 16px; position: relative; }
label.field + label.field::before { content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 0.5px solid var(--border); }
label.field > span { display: block; font-size: 13px; color: var(--text2); margin-bottom: 4px; }
input, select, textarea {
  width: 100%; font: inherit; color: var(--text); background: var(--inset); border: 0; border-radius: 10px;
  padding: 10px 12px; min-height: 44px; appearance: none; -webkit-appearance: none;
}
textarea { min-height: 80px; resize: vertical; }
input[type=search] { background: var(--surface); }
.seg { display: flex; background: var(--inset); border-radius: 10px; padding: 2px; }
.seg label { flex: 1; text-align: center; }
.seg input { display: none; }
.seg span { display: block; padding: 8px 0; border-radius: 8px; font-size: 15px; }
.seg input:checked + span { background: var(--surface); font-weight: 600; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12); }
.btn {
  display: block; width: calc(100% - 32px); margin: 8px 16px 12px; min-height: 50px; border: 0; border-radius: 14px;
  background: var(--accent); color: #FFFFFF; font: inherit; font-weight: 600; text-align: center; text-decoration: none;
  line-height: 50px; padding: 0 16px;
}
.btn.sub { background: var(--surface); color: var(--accent); }
.btn.danger { background: var(--surface); color: var(--danger); }
.btn.small { display: inline-block; width: auto; margin: 0; min-height: 36px; line-height: 36px; font-size: 15px; }
.btn:active { opacity: 0.6; }
.btn[disabled] { opacity: 0.4; }
.error { margin: 0 20px 12px; color: var(--danger); font-size: 15px; }
.error:empty { display: none; }
table.lines { width: 100%; border-collapse: collapse; }
table.lines td { padding: 10px 16px; border-top: 0.5px solid var(--border); }
table.lines tr:first-child td { border-top: 0; }
table.lines td:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
table.lines tr.sum td { font-weight: 700; }
.toast {
  position: fixed; left: 50%; bottom: calc(32px + var(--safe-bottom, 0px)); transform: translateX(-50%);
  background: rgba(30, 30, 32, 0.92); color: #FFFFFF; padding: 12px 18px; border-radius: 14px; font-size: 15px;
  max-width: calc(100% - 48px); text-align: center; opacity: 0; transition: opacity 0.2s; pointer-events: none;
}
.toast.show { opacity: 1; }
.hidden { display: none !important; }
`;

const SCRIPT = `
(function () {
  function post(m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  var seq = 0;
  var waiting = {};
  function toast(text) {
    var t = document.getElementById('demo-toast');
    if (!t || !text) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }
  window.demoToast = toast;
  /** 登録・申請をアプリに送る。done(ok, message) で返事を受け取る */
  window.demoAction = function (action, data, back, done) {
    var id = 'r' + (++seq);
    waiting[id] = done;
    post({ type: 'action', id: id, action: action, data: data, back: !!back });
  };
  window.__demoResult = function (id, ok, message) {
    var done = waiting[id];
    delete waiting[id];
    if (done) done(ok, message);
  };
  window.demoSteps = function (day, done) {
    var id = 's' + (++seq);
    waiting[id] = done;
    post({ type: 'steps', id: id, day: day });
  };
  window.__demoSteps = function (id, steps) {
    var done = waiting[id];
    delete waiting[id];
    if (done) done(steps);
  };
  function finish(el, ok, message, back) {
    var err = el.querySelector('.error') || document.querySelector('.error');
    if (!ok) {
      if (err) err.textContent = message;
      else toast(message);
      return;
    }
    if (err) err.textContent = '';
    toast(message);
    if (back) setTimeout(function () { post({ type: 'back' }); }, 900);
  }
  document.addEventListener('click', function (e) {
    var open = e.target.closest('[data-open]');
    if (open) {
      e.preventDefault();
      post({ type: 'open', app: open.getAttribute('data-app') || '', form: open.getAttribute('data-open'), q: open.getAttribute('data-q') || '', sheet: open.getAttribute('data-sheet') === '1' });
      return;
    }
    var button = e.target.closest('button[data-action]');
    if (button) {
      e.preventDefault();
      var ask = button.getAttribute('data-confirm');
      if (ask && !window.confirm(ask)) return;
      var data = {};
      try { data = JSON.parse(button.getAttribute('data-data') || '{}'); } catch (x) {}
      var back = button.getAttribute('data-back') === '1';
      button.disabled = true;
      window.demoAction(button.getAttribute('data-action'), data, back, function (ok, message) {
        button.disabled = false;
        finish(button.closest('.card') || document.body, ok, message, back);
      });
    }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-action]');
    if (!form) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      data[el.name] = el.value;
    });
    var back = form.getAttribute('data-back') === '1';
    var submit = form.querySelector('[type=submit]');
    if (submit) submit.disabled = true;
    window.demoAction(form.getAttribute('data-action'), data, back, function (ok, message) {
      if (submit) submit.disabled = false;
      finish(form, ok, message, back);
    });
  });
})();
`;

/** デモのページの HTML（どのページも、上に「デモ」の知らせを出す） */
export function demoDocument({ appId, body, script, bottomInset = 0 }: PageOptions): string {
  return `<!DOCTYPE html>
<html lang="ja" data-demo-app="${esc(appId)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<style>:root { --safe-bottom: ${Math.max(0, Math.round(bottomInset))}px; }${CSS}</style>
</head>
<body>
<div class="demo-banner">デモ: 見本のデータです。保存してもサーバーには送りません。<br>Demo mode: sample data only. Nothing is sent to the server.</div>
${body}
<div id="demo-toast" class="toast" role="status" aria-live="polite"></div>
<script>${SCRIPT}</script>
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}
