// EZCraft のアプリ画面（WebView の中の Web ページ）に、このアプリの見た目をかぶせる。
//
// 中のアプリの動きやデータには手を付けない。変えるのは見た目だけ:
//   1. 画面の幅に収める（決まった幅で作られたページを縮める。スマホ向けに作り直した画面はそのまま）
//   2. 共通のスタイル（入力欄・ボタン・タブ・表・見出し）をモダンでシンプルに
//   3. ライト / ダークを端末の設定に合わせる
//   4. アプリごとの調整（appStyles.ts）
//
// 色の考え方: 設計者がわざわざ付けた色（緑のボタン、青い見出しなど）は残す。
// 白い地・黒い文字・灰色の線のような「無彩色」だけを、テーマの色に置き換える。
import { compactCss, compactJs } from './compact';
import { APP_SKINS, roleCss, type AppSkin } from './appStyles';
import { SEARCH_ICON } from './layout';

/** WebView に読み込ませる JavaScript を作る（appId はアプリケーション ID。アプリごとの調整に使う） */
// 作ったスクリプトは、アプリごとに控えて使い回す（TiMS は 600KB を超える。画面を描き直すたびに作り直さない）
const skinCache = new Map<string, string>();

export function buildSkinScript(appId: string): string {
  let js = skinCache.get(appId);
  if (js === undefined) {
    js = compactJs(makeSkinScript(appId));
    skinCache.set(appId, js);
  }
  return js;
}

function makeSkinScript(appId: string): string {
  const skin = APP_SKINS[appId];
  const css = BASE_CSS + GLASS_CSS + (skin ? roleCss(skin) : '');
  const mobileForms = skin?.mobileForms ?? [];
  const mobileWhen = skin?.mobileWhen ?? {};
  const config = {
    bottomBars: skin?.bottomBars ?? {},
    numeric: skin?.numeric ?? [],
    pickers: skin?.pickers ?? [],
    liveSearch: skin?.liveSearch ?? [],
    rowOpens: skin?.rowOpens ?? [],
    emptyGrids: skin?.emptyGrids ?? {},
    relabel: skin?.relabel ?? {},
    placeholders: skin?.placeholders ?? {},
    tabBars: skin?.tabBars ?? {},
    cards: (skin?.cards ?? []).map((card) => card.button),
  };
  return `
(function () {
  if (window.__myappSkin) return;
  window.__myappSkin = true;
  var root = document.documentElement;
  root.setAttribute('data-myapp', ${JSON.stringify(appId)});
  var MOBILE_FORMS = ${JSON.stringify(mobileForms)};
  var MOBILE_WHEN = ${JSON.stringify(mobileWhen)};
  var CONFIG = ${JSON.stringify(config)};
  var CHECK_IDS = ${JSON.stringify(DEV && skin ? skinIds(skin, css) : null)};

  // ---- スタイルを差し込む ----
  var style = document.createElement('style');
  style.id = 'myapp-skin';
  style.textContent = ${JSON.stringify(compactCss(css))};
  (document.head || root).appendChild(style);

  // ---- アプリごとの動き（appStyles.ts の script。window.__myappAppUpdate を決める） ----
  ${skin?.script ?? ''}

  ${GENERIC_JS}

  ${FIT_JS}
  ${DARK_JS}
  ${REVEAL_JS}
  ${CHECK_JS}
})();
true;
`;
}

/** 開発中か（アプリの外、npm run check:pages などで読み込んだときは false） */
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

/** EZCraft の部品 ID の形（フォーム ID_部品名。最後が _ で終わるものは、途中まで書いて足す名前なので除く） */
const PART_ID = /^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]*[A-Za-z0-9]$/;

/**
 * このアプリの見た目の直しが、名前で指している EZCraft の部品 ID（CSS の #ID、設定に書いた部品、スクリプトの getElementById）。
 * 開発中だけ、画面にあるかを確かめる（CHECK_JS）
 */
function skinIds(skin: AppSkin, css: string): string[] {
  const ids = new Set<string>();
  const add = (id: string | undefined) => {
    if (id && PART_ID.test(id)) ids.add(id);
  };
  for (const m of css.matchAll(/#([A-Za-z][A-Za-z0-9_]*)/g)) add(m[1]);
  // 「'#frmX_txtPrj' + n」のように、後ろに番号を足して使う名前は、部品の名前そのものではないので数えない
  for (const m of (skin.script ?? '').matchAll(/getElementById\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)|['"]#([A-Za-z][A-Za-z0-9_]*)(?=[\s'"])(?!['"]\s*\+)/g)) add(m[1] ?? m[2]);
  [skin.hidden, skin.panels, skin.sections, skin.notes, skin.chips, skin.primary, skin.danger, skin.numeric, skin.mobileForms].forEach((list) => list?.forEach(add));
  (skin.cards ?? []).forEach((card) => {
    add(card.button);
    add(card.subtitle);
  });
  Object.values(skin.bottomBars ?? {}).forEach((list) => list.forEach(add));
  (skin.pickers ?? []).forEach((p) => add(p.ok));
  (skin.liveSearch ?? []).forEach((l) => {
    add(l.input);
    add(l.button);
  });
  (skin.rowOpens ?? []).forEach((r) => {
    add(r.grid);
    add(r.button);
  });
  [skin.emptyGrids, skin.relabel, skin.placeholders, skin.tabBars].forEach((map) => Object.keys(map ?? {}).forEach(add));
  return [...ids].sort();
}

// ---------------------------------------------------------------------------
// 開発中だけ: 見た目の直しが名前で指している部品が、開いている画面にあるか確かめる。
// EZCraft の画面が作り直されて部品の名前が変わると、その部品の直しが黙って効かなくなる（パソコン向けの見た目に戻る）。
// 見つからない部品があれば、アプリに知らせる（アプリは Metro と画面の下に黄色い知らせを出す）。
//   - 確かめるのは、開いている画面（.tcc-form）の名前で始まる部品だけ（ほかの画面の部品は、その画面を開いたときに）
//   - 「frmApply_yukyu_R1」のように、途中までの名前（frmApply_yukyu）が、中に部品を持たない部品
//     （別の画面を開くボタン）なら、それは別の画面の部品なので数えない
//   - 画面ができて 2.5 秒たってから、1つの部品は1回だけ知らせる
// ---------------------------------------------------------------------------
const CHECK_JS = `
  (function () {
    if (!CHECK_IDS || !CHECK_IDS.length) return;
    var reported = {};
    var lastForms = '';
    var timer = null;
    function openForms() {
      return Array.prototype.map.call(document.querySelectorAll('.tcc-form[id]'), function (f) { return f.id; });
    }
    function check() {
      var forms = openForms();
      if (!forms.length) return;
      var missing = {};
      CHECK_IDS.forEach(function (id) {
        if (reported[id] || document.getElementById(id)) return;
        var owner = '';
        forms.forEach(function (f) { if (id.indexOf(f + '_') === 0 && f.length > owner.length) owner = f; });
        if (!owner) return;
        var parts = id.slice(owner.length + 1).split('_');
        for (var i = 1; i < parts.length; i++) {
          var part = owner + '_' + parts.slice(0, i).join('_');
          if (document.getElementById(part) && !document.querySelector('[id^="' + part + '_"]')) return;
        }
        (missing[owner] = missing[owner] || []).push(id);
      });
      Object.keys(missing).forEach(function (form) {
        missing[form].forEach(function (id) { reported[id] = true; });
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'skinMissing', form: form, ids: missing[form] })); } catch (e) {}
      });
    }
    new MutationObserver(function () {
      var forms = openForms().join(',');
      if (forms === lastForms) return;
      lastForms = forms;
      clearTimeout(timer);
      timer = setTimeout(check, 2500);
    }).observe(document.documentElement, { childList: true, subtree: true });
  })();
`;

/**
 * ページが動き出す前に入れる。整える前の EZCraft の見た目（白い地・パソコン向けの並び）が一瞬見えないように、
 * 地の色だけ先に塗り、中身は隠しておく（整ったら REVEAL_JS が見せる）。background はアプリの地の色
 */
export function bootJs(background: string): string {
  const css = `html{background:${background} !important}html.myapp-booting body{visibility:hidden !important}`;
  return `(function () {
  var root = document.documentElement;
  root.classList.add('myapp-booting');
  var style = document.createElement('style');
  style.id = 'myapp-boot';
  style.textContent = ${JSON.stringify(css)};
  root.appendChild(style);
  // 読み込み中の通信の数（REVEAL_JS が見る。データを読み終わってから見せ、あとから並びが動かないように）
  var pending = 0;
  window.__myappXhr = function () { return pending; };
  // 通信がなく、最後の通信が終わってから ms ミリ秒以上たったか（データを読み終わって、描き直しも済んだころか）
  window.__myappXhrIdle = function (ms) { return pending === 0 && Date.now() - (window.__myappXhrAt || 0) >= ms; };
  // 数え漏れを残さない: 終わりの知らせ（loadend）が来ない終わり方（通信中に open し直した）と、返事が来ないまま 2 分たったものも、終わったことにする
  // （数が 0 に戻らないと、空の一覧の知らせなどが、いつまでも「読み込み中」のまま出ない）
  var send = XMLHttpRequest.prototype.send;
  var reopen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    if (this.__myappEnd) this.__myappEnd();
    return reopen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    var done = false;
    var timer = null;
    var end = function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (xhr.__myappEnd === end) xhr.__myappEnd = null;
      pending--;
      window.__myappXhrAt = Date.now();
    };
    pending++;
    xhr.__myappEnd = end;
    timer = setTimeout(end, 120000);
    this.addEventListener('loadend', end);
    try { return send.apply(this, arguments); } catch (e) { end(); throw e; }
  };
  // EZCraft は、お知らせ（「登録しました」・エラーなど）を出すたびに音を鳴らす。WebView のページの音は、
  // そのままだと iPhone のマナーモード（消音）でも鳴る。「周りの音」の扱いにして、マナーモードでは鳴らさない
  // （Audio Session API。マナーモードでないときは今までどおり鳴る。ほかのアプリの音楽も止めない）
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {}
})();
true;
`;
}

/** 隠していたページを、すぐに見せる（REVEAL_JS の合図が来ないときに、アプリから使う） */
export const SHOW_PAGE_JS = "document.documentElement.classList.remove('myapp-booting'); true;";

// ---------------------------------------------------------------------------
// 整ってから見せる: EZCraft が画面を描き、こちらが一度整え直し（並べ直し・色）、読み込み中の表示が消えて
// 落ち着いたら、隠していた中身を見せて、アプリに知らせる（アプリは、それまで読み込み中の印を出している）。
// EZCraft の画面でなければすぐに、長くかかっても 6 秒で見せる
// ---------------------------------------------------------------------------
const REVEAL_JS = `
  (function () {
    var start = Date.now();
    var formSeenAt = -1;
    var waited = 0;
    var readyAt = 0;
    var timer = null;
    function reveal() {
      if (timer) clearInterval(timer);
      root.classList.remove('myapp-booting');
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' })); } catch (e) {}
    }
    if (!window.FALCON) { reveal(); return; }
    timer = setInterval(function () {
      if (Date.now() - start > 6000) { reveal(); return; }
      var form = document.querySelector('.form-content');
      var loading = document.getElementById('loadingIcon');
      if (!form || (loading && loading.offsetParent !== null)) return;
      var count = window.__myappUpdates || 0;
      if (formSeenAt < 0) { formSeenAt = count; return; }
      if (count <= formSeenAt) return; // 画面ができてから、まだ整え直していない
      // 続けてデータを読んでいるあいだは待つ（読み終わってから見せる。あとから中身が増えて並びが下にずれないように）。
      // 待つのは長くても 0.8 秒（それ以上かかるときは、先に見せる）
      if (!readyAt) readyAt = Date.now();
      var idle = !window.__myappXhrIdle || window.__myappXhrIdle(120);
      if (!idle && Date.now() - readyAt < 800) return;
      if (waited++ < 1) return; // 整え直したあと、もう 0.05 秒だけ待つ（色や並びが行き渡るまで）
      reveal();
    }, 50);
  })();
`;

// ---------------------------------------------------------------------------
// 0. アプリごとの設定（appStyles.ts の AppSkin）にしたがって、どの画面でも同じように動かすもの
//    画面が変わるたびに呼ばれる（applyConfig）。同じ結果なら何も書き換えない
// ---------------------------------------------------------------------------
const GENERIC_JS = `
  function byId(id) { return document.getElementById(id); }
  function hidden(el) { return !el || (el.getAttribute('style') || '').indexOf('visibility: hidden') >= 0; }

  // 下に固定するボタン: ボタンの部品を、画面（またはダイアログ）の下の帯に移す。見えているうちの最後を主なボタンにする
  function bottomBars() {
    Object.keys(CONFIG.bottomBars).forEach(function (formId) {
      var form = byId(formId);
      var bar = document.querySelector('.myapp-bottom-bar[data-form="' + formId + '"]');
      if (!form) { if (bar) bar.remove(); return; }
      var modal = form.closest('.tcc-modal');
      var host = modal ? modal.querySelector('.tcc-modal-content') || modal : document.body;
      if (!bar || bar.parentElement !== host) {
        if (bar) bar.remove();
        bar = document.createElement('div');
        bar.className = 'myapp-bottom-bar' + (modal ? ' in-modal' : '');
        bar.setAttribute('data-form', formId);
        bar.setAttribute('data-myapp-nodark', '');
        host.appendChild(bar);
      }
      var visible = [];
      CONFIG.bottomBars[formId].forEach(function (id) {
        var el = byId(id);
        if (!el) return;
        if (el.parentElement !== bar) {
          // EZCraft が画面を作り直すと、同じ ID の新しいボタンができる（帯の中のものより前にあるので、byId はそちらを返す）。
          // 帯に残った古いボタン（もう押しても動かない）は外してから、新しいほうを移す
          Array.prototype.slice.call(bar.children).forEach(function (child) { if (child.id === id) child.remove(); });
          bar.appendChild(el);
        }
        if (!hidden(el)) visible.push(el);
      });
      CONFIG.bottomBars[formId].forEach(function (id) {
        var el = byId(id);
        if (el) el.classList.toggle('myapp-bar-primary', el === visible[visible.length - 1]);
      });
      bar.classList.toggle('myapp-empty-bar', visible.length === 0);
    });
    var pageBar = document.querySelector('body > .myapp-bottom-bar:not(.myapp-empty-bar)');
    root.classList.toggle('myapp-has-bar', !!pageBar);
  }

  // 数字だけを入れる欄は、数字のキーボードにする
  function numericInputs() {
    CONFIG.numeric.forEach(function (id) {
      var input = document.querySelector('#' + id + ' input');
      if (input && input.getAttribute('inputmode') !== 'numeric') input.setAttribute('inputmode', 'numeric');
    });
  }

  // 行を押したら決まるダイアログに、押す OK ボタンを書いておく（押したときの動きは bridge.ts）
  function pickers() {
    CONFIG.pickers.forEach(function (p) {
      var dialog = byId(p.dialog);
      var target = '#' + p.ok + ' .tcc-btn';
      if (dialog && dialog.getAttribute('data-myapp-pick') !== target) dialog.setAttribute('data-myapp-pick', target);
    });
    // 検索ボックスの選択ダイアログ（ID の末尾が _mdl）は、どのアプリでも同じ作り
    document.querySelectorAll('.tcc-modal[id$="_mdl"]').forEach(function (m) {
      if (m.getAttribute('data-myapp-pick') !== '#btnOK .tcc-btn') m.setAttribute('data-myapp-pick', '#btnOK .tcc-btn');
    });
  }

  // 打つたびに検索する（打ち終わって少し待ってから）
  function liveSearch() {
    var list = CONFIG.liveSearch.map(function (l) {
      return { input: document.querySelector('#' + l.input + ' input'), go: function () { var b = document.querySelector('#' + l.button + ' .tcc-btn'); if (b) b.click(); } };
    });
    document.querySelectorAll('.tcc-modal[id$="_mdl"] #txtSearch').forEach(function (box) {
      list.push({ input: box.querySelector('input'), go: function () {
        var input = box.querySelector('input');
        ['keydown', 'keypress', 'keyup'].forEach(function (type) {
          input.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        });
      } });
    });
    list.forEach(function (l) {
      if (!l.input || l.input.__myappLive) return;
      l.input.__myappLive = true;
      // 日本語の入力（かなを漢字に変える途中）のあいだは検索しない。確定したら検索する
      var timer = null;
      var later = function () {
        clearTimeout(timer);
        timer = setTimeout(l.go, 500);
      };
      l.input.addEventListener('input', function (e) { if (!e.isComposing) later(); });
      l.input.addEventListener('compositionend', later);
    });
  }

  // 行を押したら開く（行が選ばれてから、隠したボタンを押す）
  function rowOpens() {
    CONFIG.rowOpens.forEach(function (r) {
      var grid = byId(r.grid);
      if (!grid || grid.__myappOpens) return;
      grid.__myappOpens = true;
      grid.addEventListener('click', function (e) {
        if (!e.target.closest || !e.target.closest('.TccGridBodyScroll tr')) return;
        setTimeout(function () { var b = document.querySelector('#' + r.button + ' .tcc-btn'); if (b) b.click(); }, 120);
      }, true);
    });
  }

  // 中身のない一覧に、文を出す。
  // ただし、一覧が見えてすぐのあいだと、データを読んでいるあいだは、新しくは出さない
  // （タブを開いてデータが届くまでに「データはありません」が一瞬出て、すぐ消えないように）。
  // 出ている文は、また中身が入るまでそのまま（ほかの通信のたびに消えたり出たりしないように）
  var EMPTY_GRACE_MS = 700;
  var emptyRecheck = null;
  function emptyGrids() {
    var now = Date.now();
    var busy = window.__myappXhrIdle && !window.__myappXhrIdle(150);
    var wait = 0;
    Object.keys(CONFIG.emptyGrids).forEach(function (id) {
      var grid = byId(id);
      if (!grid) return;
      var seen = grid.getClientRects().length > 0;
      if (!seen) grid.__myappSeenAt = 0;
      else if (!grid.__myappSeenAt) grid.__myappSeenAt = now;
      var age = seen ? now - grid.__myappSeenAt : 0;
      // 行番号の列（rowHead・tdCol0）は数えない。空の一覧にも、行番号だけの行が残ることがある
      var rows = grid.querySelectorAll('.TccGridBodyScroll tbody tr');
      var empty = !Array.prototype.some.call(rows, function (tr) {
        return Array.prototype.some.call(tr.children, function (td) {
          return !/rowHead|_tdCol0(?!\\d)/.test(td.className) && (td.textContent || '').trim() !== '';
        });
      });
      if (grid.getAttribute('data-myapp-empty-msg') !== CONFIG.emptyGrids[id]) grid.setAttribute('data-myapp-empty-msg', CONFIG.emptyGrids[id]);
      // 並び（空の一覧の高さなど）は、今までどおりすぐ変える。待たせるのは文だけ（myapp-empty-wait のあいだは文を隠す）
      grid.classList.toggle('myapp-empty', empty);
      if (!empty || !seen) grid.__myappMsgShown = false;
      else if (!busy && age >= EMPTY_GRACE_MS) grid.__myappMsgShown = true;
      // 隠れている一覧（ほかのタブ）にも、先に印を付けておく（タブを開いた瞬間に文が出ないように）
      var hold = empty && !grid.__myappMsgShown;
      // まだ出さない文は、落ち着くころにもう一度見る（そのあいだにページが何も変わらなくても出るように）
      if (hold && seen) wait = Math.max(wait, busy ? 200 : EMPTY_GRACE_MS - age);
      if (grid.classList.contains('myapp-empty-wait') !== hold) grid.classList.toggle('myapp-empty-wait', hold);
    });
    clearTimeout(emptyRecheck);
    if (wait > 0) emptyRecheck = setTimeout(emptyGrids, wait + 20);
  }

  // 見出しやボタンの文字を置き換える（中の文字だけ。アイコンは残す）
  function relabel() {
    Object.keys(CONFIG.relabel).forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      var box = el.querySelector('.tcc-btn, .tcc-label-text') || el;
      var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      var first = null;
      var node;
      while ((node = walker.nextNode())) {
        if (!node.nodeValue.trim()) continue;
        if (!first) { first = node; if (node.nodeValue !== CONFIG.relabel[id]) node.nodeValue = CONFIG.relabel[id]; }
        else if (node.nodeValue) node.nodeValue = '';
      }
    });
  }

  function placeholders() {
    Object.keys(CONFIG.placeholders).forEach(function (id) {
      var input = document.querySelector('#' + id + ' input');
      if (input && input.placeholder !== CONFIG.placeholders[id]) input.placeholder = CONFIG.placeholders[id];
    });
  }

  // 検索ボックスの選択ダイアログの一覧: 同じ行の中で、前の列と同じ文字の列は出さない。最後の列（いちばん細かい分類）を目立たせる
  function dedupeRows() {
    document.querySelectorAll('.tcc-modal[id$="_mdl"] .TccGridBodyScroll tbody tr').forEach(function (tr) {
      if (tr.__myappText === tr.textContent) return;
      tr.__myappText = tr.textContent;
      var seen = [];
      var main = null;
      Array.prototype.forEach.call(tr.children, function (td) {
        if (td.tagName !== 'TD' || /rowHead|_tdCol0(?!\\d)/.test(td.className)) return;
        var t = (td.textContent || '').trim();
        var dup = t !== '' && seen.indexOf(t) >= 0;
        td.classList.toggle('myapp-dup', dup);
        td.classList.remove('myapp-main');
        if (t && !dup) { seen.push(t); main = td; }
      });
      if (main) main.classList.add('myapp-main');
    });
  }

  // 一覧のカード（cardGrid）のために: 値のない欄にしるし（見出しだけが出ないように）、
  // ページが1つしかない一覧にもしるし（« < 1 / 1p > » を出さないように）
  // 一覧のマスを見直すのは、中身が変わった一覧（gridsDirty）だけ。ページのどこかが変わるたびに、全部の一覧の全部のマスを
  // 調べ直すと重いため（勤務表の出力は 1,000 マスを超える）。見落としのないよう、全部の見直しも 1.5 秒に 1 回はする
  var gridsDirty = [];
  var gridsFullAt = 0;
  function markGridsIn(node) {
    if (!node || node.nodeType !== 1) node = node && node.parentElement;
    if (!node || !node.closest) return;
    var body = node.closest('.TccGridBodyScroll');
    if (body) { if (gridsDirty.indexOf(body) < 0) gridsDirty.push(body); return; }
    if (node.getElementsByClassName('TccGridBodyScroll').length) {
      Array.prototype.forEach.call(node.getElementsByClassName('TccGridBodyScroll'), function (b) {
        if (gridsDirty.indexOf(b) < 0) gridsDirty.push(b);
      });
    }
  }
  window.__myappNoteMutations = function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      markGridsIn(r.target);
      for (var k = 0; k < r.addedNodes.length; k++) if (r.addedNodes[k].nodeType === 1) markGridsIn(r.addedNodes[k]);
    }
  };
  // チェックを入れた・外した（中身の文字は変わらない）
  document.addEventListener('change', function (e) { markGridsIn(e.target); }, true);
  function tidyCell(td) {
    var text = td.textContent || '';
    // 名前の中に、文字の番号のまま入っているもの（「ハ&#12442;スキー」= パスキー）は、文字に直して見せる（見せるだけ。データはそのまま）
    if (text.indexOf('&#') >= 0) {
      var w = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = w.nextNode())) {
        if (node.nodeValue.indexOf('&#') < 0) continue;
        var v = node.nodeValue.replace(/&#(x[0-9a-fA-F]+|\\d+);/g, function (all, code) {
          var n = code.charAt(0) === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10);
          return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
        });
        if (v.normalize) v = v.normalize('NFC');
        if (v !== node.nodeValue) node.nodeValue = v;
      }
      text = td.textContent || '';
    }
    // 「----」（値なし）も、空として扱う（見出しだけが「合計 ----」と出ないように）
    var blank = !/[^\\s\\-－―ー]/.test(text) && !td.querySelector('input:checked, img, i');
    if (td.hasAttribute('data-myapp-blank') !== blank) td.toggleAttribute('data-myapp-blank', blank);
  }
  function tidyGrids() {
    var now = Date.now();
    var bodies = gridsDirty;
    gridsDirty = [];
    if (now - gridsFullAt > 1500) {
      gridsFullAt = now;
      bodies = Array.prototype.slice.call(document.getElementsByClassName('TccGridBodyScroll'));
    }
    bodies.forEach(function (body) {
      if (body.isConnected) body.querySelectorAll('td').forEach(tidyCell);
    });
    document.querySelectorAll('.tcc-component.grid').forEach(function (grid) {
      var pager = grid.querySelector('.tcc-pager-navi');
      if (!pager) return;
      var m = /\\/\\s*(\\d+)\\s*p/.exec(pager.textContent || '');
      // 続きをスクロールで足す一覧（growLists）も、ページ送りは出さない。ただし、アプリが持っている行（rowBuf）で
      // 足せるぶんを越えてページがある（サーバーから次のページを読む一覧）なら、ページ送りを残す（2 ページ目より先に行けるように）
      var one = !!m && +m[1] <= 1;
      if (!one && grid.__myappGrow && window.jQuery) {
        var t = window.jQuery(grid).data('tcc');
        var rows = (t && t.rowBuf && t.rowBuf.length) || 0;
        var size = (t && t._pageSize) || 1;
        one = !m || +m[1] <= Math.ceil(rows / size);
      }
      if (grid.hasAttribute('data-myapp-onepage') !== one) grid.toggleAttribute('data-myapp-onepage', one);
    });
  }

  // 大きなカード型のボタン（メニューのカードなど）には、しるしを付ける（CSS でカプセルにせず、角を丸めるだけにする）
  function tallButtons() {
    document.querySelectorAll('.tcc-btn').forEach(function (b) {
      var tall = b.offsetHeight > 60;
      if (b.classList.contains('myapp-tall-btn') !== tall) b.classList.toggle('myapp-tall-btn', tall);
    });
  }

  // 下のタブ: 横に並んだ文字のタブ（スマホでははみ出して横にスクロールする）の代わりに、画面の下にガラスのタブを出す。
  // 押すと、元のタブを押す（切り替えの動きは EZCraft のまま）。選んでいるタブは、元のタブに合わせる
  var SVG = 'http://www.w3.org/2000/svg';
  function tabIcon(path) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', path);
    svg.appendChild(p);
    return svg;
  }
  function tabBars() {
    var any = false;
    Object.keys(CONFIG.tabBars).forEach(function (tabId) {
      var tab = byId(tabId);
      var nav = document.querySelector('.myapp-tabbar[data-tab="' + tabId + '"]');
      var lis = tab ? Array.prototype.filter.call(tab.querySelectorAll(':scope > ul.tcc-tab-head > li'), function (li) {
        return getComputedStyle(li).display !== 'none';
      }) : [];
      if (lis.length < 2) {
        if (nav) nav.remove();
        if (tab) tab.removeAttribute('data-myapp-tabbar');
        return;
      }
      any = true;
      if (!tab.hasAttribute('data-myapp-tabbar')) tab.setAttribute('data-myapp-tabbar', '');
      var conf = CONFIG.tabBars[tabId];
      var key = lis.map(function (li) { return (li.textContent || '').trim(); }).join('|');
      if (!nav || nav.__key !== key) {
        if (!nav) {
          nav = document.createElement('nav');
          nav.className = 'myapp-tabbar';
          nav.setAttribute('data-tab', tabId);
          nav.setAttribute('role', 'tablist');
          nav.setAttribute('data-myapp-nodark', '');
          document.body.appendChild(nav);
        }
        nav.__key = key;
        nav.textContent = '';
        lis.forEach(function (li) {
          var text = (li.textContent || '').trim();
          var item = conf.filter(function (c) { return c.match === text; })[0] || conf.filter(function (c) { return text.indexOf(c.match) >= 0; })[0];
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('role', 'tab');
          if (item && item.icon) b.appendChild(tabIcon(item.icon));
          var label = document.createElement('span');
          label.textContent = item ? item.label : text;
          b.appendChild(label);
          b.__li = li;
          // EZCraft のタブは、マウスで押したときの知らせ（mousedown → mouseup → click）で切り替わる。
          // 一覧を読み込んでいる最中は受け付けないことがあるので、切り替わらなければ、少し待ってもう一度押す
          b.addEventListener('click', function () {
            var li = b.__li;
            var press = function () {
              var a = li.querySelector('a') || li;
              var r = a.getBoundingClientRect();
              var opts = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
              ['mousedown', 'mouseup', 'click'].forEach(function (type) { a.dispatchEvent(new MouseEvent(type, opts)); });
            };
            var at = Date.now();
            Array.prototype.forEach.call(nav.children, function (o) { o.__pressedAt = o === b ? at : 0; });
            press();
            // ほかのタブを押し直したときは、前のぶんはやめる
            // 確かめのメッセージやダイアログが出ている（「保存していない変更があります」など）ときは、押し直さない
            // （後ろから押すと、メッセージが重なったり、一覧を二度読んだりする）
            var blocked = function () {
              return !!document.querySelector('.tcc-msg-bar-back, .myapp-pick-back') ||
                Array.prototype.some.call(document.querySelectorAll('.tcc-modal'), function (m) { return m.offsetParent !== null; });
            };
            [400, 1200, 2500].forEach(function (ms) {
              setTimeout(function () {
                if (li.isConnected && !li.classList.contains('active') && b.__pressedAt === at && !blocked()) press();
              }, ms);
            });
          });
          nav.appendChild(b);
        });
      }
      Array.prototype.forEach.call(nav.children, function (b) {
        var on = b.__li.classList.contains('active');
        if (b.classList.contains('active') !== on) {
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        }
      });
    });
    document.querySelectorAll('.myapp-tabbar').forEach(function (nav) {
      if (!byId(nav.getAttribute('data-tab'))) nav.remove();
    });
    if (root.classList.contains('myapp-has-tabbar') !== any) root.classList.toggle('myapp-has-tabbar', any);
  }

  // ラベルの文字を整える: 見出しの最後の「：」「:」は取る（アプリの見出しには付けない）。頭の空白（全角も）も取る。
  // 長い文（注意書きなど）の「：」は、文の一部なので取らない。同じなら書き換えない
  function tidyLabels() {
    document.querySelectorAll('.tcc-component.lbl .tcc-label-text').forEach(function (el) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var nodes = [];
      var node;
      while ((node = walker.nextNode())) if (node.nodeValue.trim()) nodes.push(node);
      if (nodes.length === 0) return;
      var first = nodes[0];
      var lead = first.nodeValue.replace(/^[\\s\\u3000]+/, '');
      if (lead !== first.nodeValue) first.nodeValue = lead;
      var last = nodes[nodes.length - 1];
      var whole = (el.textContent || '').trim();
      if (whole.length <= 14 && /[:：]\\s*$/.test(last.nodeValue) && !/\\d\\s*[:：]\\s*$/.test(last.nodeValue)) {
        last.nodeValue = last.nodeValue.replace(/\\s*[:：]\\s*$/, '');
      }
    });
  }

  // EZCraft のお知らせの帯（#TccNotifyBoxes の .TccNotify。「健診予約が登録されていません。」「権限がありません」など）:
  // 色は CSS で、アプリの小さな知らせにそろえる。ここでは、
  //   - 見出しが「Information」だけのときは出さない（中身の文だけで分かる）
  //   - 赤い帯（エラー）には、しるしを付けて赤い印にする
  //   - 25 秒出たままなので、8 秒（エラーは 12 秒）で消す。押しても消える（EZCraft の動き）
  function notices() {
    document.querySelectorAll('#TccNotifyBoxes .TccNotify:not([data-myapp-notice])').forEach(function (box) {
      box.setAttribute('data-myapp-notice', '');
      box.setAttribute('data-myapp-nodark', '');
      var title = box.querySelector('span');
      if (title && /^\\s*information\\s*$/i.test(title.textContent || '')) box.setAttribute('data-myapp-plain', '');
      var m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(box.style.backgroundColor || getComputedStyle(box).backgroundColor);
      var error = m && +m[1] > 150 && +m[2] < 110 && +m[3] < 110;
      if (error) box.setAttribute('data-myapp-error', '');
      setTimeout(function () { box.setAttribute('data-myapp-gone', ''); }, error ? 12000 : 8000);
    });
  }

  // 確認のメッセージ（スマホでは EZCraft が「メッセージバー」.tcc-msg-bar で出す。勤怠の「削除確認」など）:
  // 見た目は CSS で、ほかのダイアログと同じカードにする。ここでは、
  //   - ダーク用の色の書き換え（DARK_JS）が、ボタンに色を直接書き込まないようにする（色は CSS で決める）
  //   - 削除・取り消しの確認なら、決めるボタン（OK）を赤にするしるしを付ける（ボタンの文字は変えない。EZCraft は文字で押されたボタンを見分ける）
  //   - 決めるボタンは、並びの位置ではなく文字で見分ける（「キャンセル」「いいえ」でないもの）。目立たせるのはそちらだけ
  // EZCraft はメッセージバーを使い回すことがあるので、題と文が変わったら、もう一度見る
  var CANCEL_LABEL = /^(キャンセル|いいえ|閉じる|戻る)$/;
  function msgBars() {
    document.querySelectorAll('.tcc-msg-bar-back').forEach(function (back) {
      var bar = back.querySelector('.tcc-msg-bar');
      var key = bar ? (bar.textContent || '') : '';
      if (back.__myappMsgKey === key) return;
      back.__myappMsgKey = key;
      back.setAttribute('data-myapp-nodark', '');
      back.querySelectorAll('[style]').forEach(function (el) {
        ['background-color', 'border-color', 'color'].forEach(function (prop) { el.style.removeProperty(prop); });
      });
      var title = back.querySelector('.tcc-msg-bar-text > span');
      if (bar) bar.toggleAttribute('data-myapp-danger', !!title && /削除|取消|取り消/.test(title.textContent || ''));
      var buttons = Array.prototype.slice.call(back.querySelectorAll('.tcc-msg-bar-btn'));
      var primary = buttons.filter(function (b) { return !CANCEL_LABEL.test((b.textContent || '').trim()); }).pop();
      buttons.forEach(function (b) { b.toggleAttribute('data-myapp-primary', b === primary); });
      // 題の前の印（？など）と空白は出さない（iOS の確認と同じく、題と文だけを真ん中に）
      if (title) {
        title.querySelectorAll('i').forEach(function (i) { i.remove(); });
        var lead = title.firstChild;
        if (lead && lead.nodeType === 3) lead.nodeValue = lead.nodeValue.replace(/^[\\s\u00a0]+/, '');
      }
    });
  }

  // メニューのカード（skin の cards）: 押したら、次の画面が出るまでのあいだ、カードに読み込み中の印を出す。
  // EZCraft はダイアログを読み込んでから出すので、1〜2 秒なにも起きないように見えるため。
  // ダイアログが出たら（または 5 秒たったら）消す
  // （ボタンは、アプリの「1回のタップで押す」（bridge.ts）が click だけを送るので、click で見る）
  var opening = null;
  document.addEventListener('click', function (e) {
    var card = e.target && e.target.closest && e.target.closest('.tcc-component');
    if (!card || CONFIG.cards.indexOf(card.id) < 0) return;
    if (opening) opening.el.classList.remove('myapp-opening');
    card.classList.add('myapp-opening');
    opening = { el: card, modals: openModals(), at: Date.now() };
  }, true);
  function openModals() {
    return Array.prototype.filter.call(document.querySelectorAll('.tcc-modal'), function (m) { return m.offsetParent !== null; }).length;
  }
  function openingDone() {
    if (!opening) return;
    if (opening.el.isConnected && openModals() <= opening.modals && Date.now() - opening.at < 5000) {
      setTimeout(update, 300);
      return;
    }
    opening.el.classList.remove('myapp-opening');
    opening = null;
  }

  // 年月・日付を選ぶ部品（EZCraft の #TccYmPicker・.tcc-component.datepicker）は、画面の下から出るシートにする（形は CSS）。
  // 開いているあいだは後ろを暗くする（.myapp-cal-back）。暗い所を押したら閉じて、後ろの行やボタンを押したことにしない。
  // EZCraft は部品を一度作ったら、style の display で出し入れするので、それを見張る
  var CAL_SEL = '#TccYmPicker, .tcc-component.datepicker';
  function openCalendars() {
    return Array.prototype.filter.call(document.querySelectorAll(CAL_SEL), function (p) {
      return p.style.display !== 'none' && getComputedStyle(p).display !== 'none';
    });
  }
  // シートの上の段: つまみ（CSS）・題名・閉じる（✕）。EZCraft が中身を作り直しても、なければ足す
  function calendarHead(p) {
    if (p.querySelector(':scope > .myapp-cal-head')) return;
    var head = document.createElement('div');
    head.className = 'myapp-cal-head';
    // 題名は span にしない（EZCraft は、曜日の名前を部品の中の span に順に入れるので、ずれる）
    var title = document.createElement('div');
    title.className = 'myapp-cal-title';
    title.textContent = p.id === 'TccYmPicker' ? '月を選ぶ' : '日付を選ぶ';
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'myapp-cal-close';
    x.setAttribute('aria-label', '閉じる');
    x.textContent = '✕';
    x.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      p.style.display = 'none';
      calendarSheets();
    });
    head.appendChild(title);
    head.appendChild(x);
    p.insertBefore(head, p.firstChild);
  }
  function calendarSheets() {
    document.querySelectorAll(CAL_SEL).forEach(function (p) {
      calendarHead(p);
      if (p.__myappCal) return;
      p.__myappCal = true;
      p.setAttribute('data-myapp-nodark', '');
      new MutationObserver(calendarSheets).observe(p, { attributes: true, attributeFilter: ['style'] });
      new MutationObserver(function () { calendarHead(p); }).observe(p, { childList: true });
    });
    var open = openCalendars().length > 0;
    // 選んで閉じたら、EZCraft は入力欄にフォーカスを戻して文字を選ぶ（スマホでは選択の印やキーボードが出る）。
    // シートが入力欄を覆っていたので、このフォーカスは人が押したものではない。外す
    if (calendarSheets.open && !open) {
      [60, 250].forEach(function (ms) {
        setTimeout(function () {
          var a = document.activeElement;
          if (a && a.tagName === 'INPUT' && !openCalendars().length) a.blur();
          try { window.getSelection().removeAllRanges(); } catch (e) {}
        }, ms);
      });
    }
    calendarSheets.open = open;
    var back = document.querySelector('body > .myapp-cal-back');
    if (open && !back) {
      back = document.createElement('div');
      back.className = 'myapp-cal-back';
      back.setAttribute('data-myapp-nodark', '');
      back.addEventListener('click', function (e) {
        e.preventDefault();
        openCalendars().forEach(function (p) { p.style.display = 'none'; });
        calendarSheets();
      });
      document.body.appendChild(back);
    } else if (!open && back) {
      back.remove();
    }
  }

  // 一覧（表）: EZCraft の表は指の動きを自分で受け取って、少しずつしか動かさない（500pt なぞっても 120pt ほど。
  // 給与明細の一覧・資格取得者の検索・プロジェクト選択など）。指の動きは EZCraft に渡さず、iOS のふつうのスクロール
  // （勢いで流れる。一覧がページといっしょに流れる画面では、ページのスクロール）にする
  window.addEventListener('touchmove', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('.tcc-component.grid .TccGridBodyScroll')) e.stopPropagation();
  }, { capture: true, passive: true });

  // 検索して選ぶダイアログ（_mdl）は、開くと EZCraft が検索欄にフォーカスを当てる。キーボードと入力の補助の帯が
  // 一覧の半分を隠すので、開いた直後のフォーカスは外す（探したいときは、検索欄を押せばキーボードが出る）
  var mdlSeen = [];
  function quietDialogs() {
    var open = Array.prototype.filter.call(document.querySelectorAll('.tcc-modal[id$="_mdl"]'), function (m) { return m.offsetParent !== null; });
    open.forEach(function (m) {
      if (mdlSeen.indexOf(m) >= 0) return;
      mdlSeen.push(m);
      var at = Date.now();
      [50, 300, 700].forEach(function (ms) {
        setTimeout(function () {
          var a = document.activeElement;
          if (a && a.tagName === 'INPUT' && m.contains(a) && lastTouchAt < at) a.blur();
        }, ms);
      });
    });
    mdlSeen = mdlSeen.filter(function (m) { return open.indexOf(m) >= 0; });
  }
  var lastTouchAt = 0;
  document.addEventListener('touchstart', function () { lastTouchAt = Date.now(); }, { capture: true, passive: true });

  // 必須の印（＊）を、欄の右の外から、その欄の見出し（同じ高さの左、またはすぐ上）の後ろに移す。
  // EZCraft は場面によって必須を変える（「その他健診機関」を選ぶと健診機関名が必須に）ので、毎回見直す
  function requiredMarks() {
    document.querySelectorAll('div.tcc-component.text').forEach(function (field) {
      // 勤怠の申請のフォーム（.myapp-row に並べ直したもの・有給休暇申請）は、＊ を出さずに「任意」を添える決まりなので、ここでは触らない
      if (field.closest('.myapp-row, [id^="frmApply"]')) return;
      var required = field.offsetParent !== null && /[＊*]/.test(getComputedStyle(field, '::after').content || '');
      var label = field.__myappReqLabel;
      if (required && !label) {
        var fr = field.getBoundingClientRect();
        var best = null;
        var bestScore = Infinity;
        Array.prototype.forEach.call(field.parentElement.children, function (el) {
          if (!el.classList.contains('lbl') || el.offsetParent === null) return;
          if ((el.textContent || '').trim().length <= 2) return; // 「〜」「：」のようなつなぎの言葉は見出しではない
          var r = el.getBoundingClientRect();
          var sameRow = Math.abs(r.top - fr.top) < 8 && r.right <= fr.left + 4;
          var above = r.bottom <= fr.top + 2 && fr.top - r.bottom < 16 && Math.abs(r.left - fr.left) < 8;
          if (!sameRow && !above) return;
          var score = sameRow ? fr.left - r.right : fr.top - r.bottom;
          if (score < bestScore) { bestScore = score; best = el; }
        });
        label = best;
        field.__myappReqLabel = label;
      }
      var moved = !!(required && label);
      if (field.classList.contains('myapp-req-moved') !== moved) field.classList.toggle('myapp-req-moved', moved);
      if (label && label.classList.contains('myapp-required') !== moved) label.classList.toggle('myapp-required', moved);
    });
  }

  function applyConfig() {
    quietDialogs();
    notices();
    msgBars();
    requiredMarks();
    calendarSheets();
    openingDone();
    tidyLabels();
    tidyGrids();
    tallButtons();
    tabBars();
    bottomBars();
    numericInputs();
    pickers();
    liveSearch();
    rowOpens();
    emptyGrids();
    relabel();
    placeholders();
    dedupeRows();
    textButtons();
    growLists();
    emptyChoices();
  }

  // 文字のあるボタン（登録・検索・表示・クリアなど）からは、EZCraft の Font Awesome のアイコンを外す（文字だけのボタンにそろえる）。
  // アイコンが内容に合っていないもの（表示に開いたフォルダ、目標に地球）や、アイコンの後ろの四角い地が出るものがあるため。
  // アイコンだけのボタン（ごみ箱など）と、大きなカード型のボタン（メニュー）は、そのまま
  function textButtons() {
    document.querySelectorAll('.tcc-btn').forEach(function (b) {
      if (b.__myappText === b.textContent) return;
      b.__myappText = b.textContent;
      var has = !!b.querySelector('i.fa') && /\\S/.test(b.textContent || '');
      if (b.classList.contains('myapp-text-btn') !== has) b.classList.toggle('myapp-text-btn', has);
    });
  }

  // ダイアログの一覧（検索して選ぶもの）: 50 件ずつのページ送り（« ‹ 1 / 2p › »）はやめて、下までスクロールしたら続きを足す。
  // EZCraft の表は、読んだ全部を手元に持ち、1ページぶん（_pageSize 件）だけを並べるので、1ページの件数を増やして並べ直す
  var GROW_STEP = 100;
  function growLists() {
    document.querySelectorAll('.tcc-modal .tcc-component.grid').forEach(function (grid) {
      if (grid.__myappGrow || !grid.offsetWidth || !window.jQuery) return;
      var t = window.jQuery(grid).data('tcc');
      var body = grid.querySelector('.TccGridBodyScroll');
      if (!t || !t._pager || !body || typeof t.showPage !== 'function' || typeof t.calcPage !== 'function') return;
      grid.__myappGrow = true;
      var grow = function (size) {
        var top = body.scrollTop;
        t._pageSize = size;
        try { t.calcPage(); t.showPage(1); } catch (e) {}
        body.scrollTop = top;
      };
      if (t._pageSize < GROW_STEP) grow(GROW_STEP);
      body.addEventListener('scroll', function () {
        var total = (t.rowBuf && t.rowBuf.length) || 0;
        if (total <= t._pageSize || grow.busy) return;
        if (body.scrollTop + body.clientHeight < body.scrollHeight - 400) return;
        grow.busy = true;
        grow(t._pageSize + GROW_STEP);
        setTimeout(function () { grow.busy = false; }, 200);
      }, { passive: true });
    });
  }

  // 選択欄の一覧の、名前のない選択肢（「なし」の意味の空の行）に、「なし」と書く（CSS）
  function emptyChoices() {
    document.querySelectorAll('body > .tcc-component.cmblist > .cmblist-item').forEach(function (item) {
      var none = !/\\S/.test((item.textContent || '').replace(/\\u00a0/g, ' '));
      if (item.hasAttribute('data-myapp-none') !== none) item.toggleAttribute('data-myapp-none', none);
    });
  }

  // 日付の欄（右に 📅 のある入力欄）: 欄のどこを押しても、キーボードではなく、日付を選ぶシートを出す
  var dateStart = null;
  document.addEventListener('touchstart', function (e) {
    var t = e.touches && e.touches[0];
    dateStart = t ? { x: t.clientX, y: t.clientY } : null;
  }, { capture: true, passive: true });
  document.addEventListener('touchend', function (e) {
    var input = e.target && e.target.closest && e.target.closest('.tcc-component.text input.text-box');
    if (!input || input.disabled || input.readOnly || document.activeElement === input) return;
    var icon = input.parentElement && input.parentElement.querySelector(':scope > div.icon-rt');
    if (!icon || !icon.querySelector('i.fa-calendar, i.fa-calendar-o, i.fa-calendar-alt')) return;
    var t = e.changedTouches && e.changedTouches[0];
    if (dateStart && t && Math.abs(t.clientX - dateStart.x) + Math.abs(t.clientY - dateStart.y) > 10) return; // スクロールだった
    e.preventDefault();
    icon.click();
  }, true);
`;

// ---------------------------------------------------------------------------
// 1. 画面の幅に収める
// ---------------------------------------------------------------------------
const FIT_JS = `
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    (document.head || root).appendChild(meta);
  }
  // スマホの幅で出すときは、入力欄を押したときに iOS が画面を勝手に拡大しないようにする（指で広げる拡大はできる）
  var deviceViewport = 'width=device-width,initial-scale=1.0,maximum-scale=1.0';
  var screenWidth = window.screen.width;
  var fittedWidth = 0;
  // 必要な幅 = いま見えているフォームの「設計された幅」の最大（スマホ向けに作り直したフォームは数えない）。
  // 画面の幅に合わせて伸び縮みする幅ではなく、設計された幅で測るので、縮めたあとも測り直せる。
  function neededWidth() {
    var forms = document.querySelectorAll('.tcc-form');
    if (forms.length === 0) return Math.max(root.scrollWidth, document.body ? document.body.scrollWidth : 0);
    var need = 0;
    forms.forEach(function (f) {
      // スマホ向けに作り直したフォーム（条件付きのものは、条件に合うときだけ）は数えない
      if (MOBILE_FORMS.indexOf(f.id) >= 0 && (!MOBILE_WHEN[f.id] || document.querySelector(MOBILE_WHEN[f.id]))) return;
      if (f.getBoundingClientRect().width === 0) return; // 隠れているフォーム
      need = Math.max(need, parseFloat(f.style.width) || f.scrollWidth);
    });
    return need;
  }
  function fit() {
    var need = neededWidth();
    var target = need > screenWidth + 1 ? Math.ceil(need) : 0;
    if (target === fittedWidth) return;
    fittedWidth = target;
    meta.setAttribute('content', target ? 'width=' + target : deviceViewport);
  }
`;

// ---------------------------------------------------------------------------
// 3. ダークモード（ページに直接書かれた色も、無彩色だけ置き換える）
// ---------------------------------------------------------------------------
const DARK_JS = `
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  var DARK = { surface: [28, 28, 30], text: [245, 245, 247], border: [56, 56, 58] };
  var changed = []; // ダーク用に書き換えた要素（ライトに戻すとき元に戻す）

  function parse(c) {
    var m = c && c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function isNeutral(c) { return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 24; }
  function lum(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
  function rgb(a) { return 'rgb(' + a.join(',') + ')'; }

  // その要素の後ろに、画面の上で実際に見えている地の色。
  // EZCraft は部品を座標で重ねて置くので、親ではない別の部品（色付きの帯など）が後ろにあることがある。
  // そこで、その位置に重なっている部品を上から順に見て、最初に色の付いているものを地とする。
  // 画面に少しでも見えているか（全部が入っていなくてよい。幅の広いラベルや、少しはみ出した部品も塗る）
  function inViewport(r) {
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }
  // 要素のしるし（クラスと style）。変わっていなければ、前に決めた色のままでよい（getComputedStyle を呼ばずにすむ）
  function sigOf(el) {
    return (typeof el.className === 'string' ? el.className : '') + '|' + (el.getAttribute('style') || '');
  }
  function backdrop(el) {
    var r = el.getBoundingClientRect();
    // 見えている部分の中の点で調べる（画面の外の点では、重なっている部品が分からない）
    var left = Math.max(r.left, 0);
    var top = Math.max(r.top, 0);
    var bottom = Math.min(r.bottom, innerHeight);
    var width = Math.min(r.right, innerWidth) - left;
    var stack = document.elementsFromPoint(left + Math.min(width / 2, 8), (top + bottom) / 2);
    for (var i = 0; i < stack.length; i++) {
      var c = parse(getComputedStyle(stack[i]).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function remember(el, prop) {
    if (!el.__myappOrig) { el.__myappOrig = {}; changed.push(el); }
    if (!(prop in el.__myappOrig)) {
      el.__myappOrig[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
    }
  }
  function set(el, prop, value) { remember(el, prop); el.style.setProperty(prop, value, 'important'); }

  function darken() {
    if (!document.body) return;
    var all = document.body.querySelectorAll('*');
    // 先に地の色を決める（文字の色は、地が無彩色のときだけ明るくする）
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      // data-myapp-nodark の中は、アプリごとのスタイルが色まで決めているので触らない。
      // 前に調べたあと、クラスも style も変わっていなければ、もう一度は調べない（重いので）
      if (el.__myappBgSig === sigOf(el) || el.closest('[data-myapp-nodark], .tcc-msg-bar-back')) continue;
      var s = getComputedStyle(el);
      var bg = parse(s.backgroundColor);
      if (bg && bg.a > 0.5 && isNeutral(bg) && lum(bg) > 0.75) set(el, 'background-color', rgb(DARK.surface));
      // 明るい無彩色のグラデーション（表の見出しなど）も、暗い単色にする
      if (s.backgroundImage.indexOf('gradient') >= 0) {
        var g = parse(s.backgroundImage);
        if (g && isNeutral(g) && lum(g) > 0.75) {
          set(el, 'background-image', 'none');
          set(el, 'background-color', rgb(DARK.surface));
        }
      }
      ['top', 'right', 'bottom', 'left'].forEach(function (side) {
        var bc = parse(s.getPropertyValue('border-' + side + '-color'));
        var bw = parseFloat(s.getPropertyValue('border-' + side + '-width'));
        if (bc && bw > 0 && isNeutral(bc) && lum(bc) > 0.6) set(el, 'border-' + side + '-color', rgb(DARK.border));
      });
      el.__myappBgSig = sigOf(el);
    }
    for (var j = 0; j < all.length; j++) {
      var t = all[j];
      // 決めたあとに EZCraft がクラスや style を変えたもの（使い回した部品など）は、もう一度決める
      if (t.__myappDone === sigOf(t) || t.closest('[data-myapp-nodark], .tcc-msg-bar-back')) continue;
      // 画面の外にあるものは、見えている地の色が分からないので、スクロールして見えてから決める
      if (!inViewport(t.getBoundingClientRect())) continue;
      var fg = parse(getComputedStyle(t).color);
      if (fg && lum(backdrop(t)) < 0.3) {
        if (isNeutral(fg) && lum(fg) < 0.45) {
          set(t, 'color', rgb(DARK.text)); // 黒い文字 → 白い文字
        } else if (!isNeutral(fg) && lum(fg) < 0.35) {
          // 濃い色の文字（青い注意書きなど）は、色味を残したまま明るくして読めるように
          set(t, 'color', rgb([fg.r, fg.g, fg.b].map(function (v) { return Math.round(v + (255 - v) * 0.55); })));
        }
      }
      t.__myappDone = sigOf(t);
    }
  }

  function lighten() {
    changed.forEach(function (el) {
      Object.keys(el.__myappOrig).forEach(function (prop) {
        var o = el.__myappOrig[prop];
        if (o[0]) el.style.setProperty(prop, o[0], o[1]);
        else el.style.removeProperty(prop);
      });
      el.__myappOrig = null;
    });
    changed = [];
    if (document.body) document.body.querySelectorAll('*').forEach(function (el) { el.__myappDone = null; el.__myappBgSig = null; });
  }

  // 画面より広いダイアログ（スマホ向けに作り直していないもの）にしるしを付ける（CSS で画面の幅に収める）。
  // 幅は EZCraft が付けた幅（style.width）で測る（収めたあとの幅で測ると、しるしが付いたり外れたりするため）
  function markWideModals() {
    document.querySelectorAll('.tcc-modal').forEach(function (m) {
      // 検索ボックスの選択ダイアログ（ID の末尾が _mdl）は、どれも同じ作りなので、下の CSS でまとめてスマホ向けにしてある
      var own = MOBILE_FORMS.indexOf(m.id) >= 0 || /_mdl$/.test(m.id);
      var wide = !own && (parseFloat(m.style.width) || m.offsetWidth) > window.innerWidth - 16;
      m.classList.toggle('myapp-wide-modal', wide);
    });
  }

  // 見えているタブの数を数え、1つ以下ならしるしを付ける（CSS で見出しを隠す）
  function markSingleTabs() {
    document.querySelectorAll('div.tcc-tab > ul.tcc-tab-head').forEach(function (ul) {
      var visible = Array.prototype.filter.call(ul.children, function (li) {
        return getComputedStyle(li).display !== 'none';
      }).length;
      ul.classList.toggle('myapp-single-tab', visible <= 1);
    });
  }

  // ---- 画面の中の箱が、横にスクロールできてしまうのを止める ----
  // EZCraft の画面には、パソコン向けの位置（右のほう）に置かれたまま見えなくしてある部品や、
  // 「左に 16px ずらして幅 100%」のように置かれた部品があり、入れ物（タブの中身・枠の中・ダイアログの中）が
  // そのぶん横に動いてしまう。見えている中身が入れ物に収まっている（か、少しだけはみ出している）なら、横には動かないようにする。
  // 見えている中身が大きくはみ出しているもの（本当に横に長い中身）と、わざと横に流すもの（最近使ったプロジェクトの札・
  // 横に並べたタブの見出し・data-myapp-hscroll の付いたもの）はそのまま
  var SIDE_MAX = 64;
  var sideAt = 0;
  function shown(el) {
    if (el.checkVisibility) return el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  }
  function noSideScroll() {
    var now = Date.now();
    if (now - sideAt < 400) return;
    sideAt = now;
    var all = document.body ? document.body.getElementsByTagName('*') : [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      // 止めたあとに中身の幅が変わった（データが入った・入れ替わった）ら、止めるのをやめて測り直す。
      // 中身が入る前に測って止めたままだと、あとから入った広い中身に横から届かなくなるため
      if (el.__myappNoSide) {
        if (el.__myappNoSide === el.scrollWidth) continue;
        el.__myappNoSide = 0;
        el.style.removeProperty('overflow-x');
      }
      if (el.scrollWidth - el.clientWidth <= 1) continue;
      var ox = getComputedStyle(el).overflowX;
      if (ox !== 'auto' && ox !== 'scroll') continue;
      // 画面より広いダイアログの中身は、わざと横にスクロールさせている（BASE_CSS の .myapp-wide-modal）
      if (el.closest('[data-myapp-hscroll]') || el.matches('.myapp-recent, ul.tcc-tab-head, .myapp-wide-modal .tcc-modal-body')) continue;
      // 見えている中身の右端が、入れ物の右端をどれだけ越えているか
      var box = el.getBoundingClientRect();
      var right = box.left + el.clientWidth;
      var over = 0;
      var kids = el.getElementsByTagName('*');
      for (var k = 0; k < kids.length; k++) {
        var r = kids[k].getBoundingClientRect();
        if (!r.width || !r.height || r.right - right <= over) continue;
        if (shown(kids[k])) over = r.right - right;
      }
      if (over > SIDE_MAX) continue;
      el.style.setProperty('overflow-x', 'hidden', 'important');
      el.__myappNoSide = el.scrollWidth || 1;
      el.scrollLeft = 0;
    }
  }

  var timer = null;
  // 1つの段でエラーが出ても、ほかの段（とくに、画面を見せる合図になる回数）は進める
  function step(fn) {
    try { fn(); } catch (e) { try { console.error('[myapp] 見た目の直し', e); } catch (_) {} }
  }
  function restyle() {
    clearTimeout(timer);
    step(applyConfig);
    if (window.__myappAppUpdate) step(window.__myappAppUpdate);
    step(markSingleTabs);
    step(markWideModals);
    step(fit);
    step(noSideScroll);
    if (media.matches) step(darken);
    window.__myappUpdates = (window.__myappUpdates || 0) + 1; // 整え直した回数（REVEAL_JS が見る）
  }
  // スクロールしたときは、見えてきたものの色を決めるだけ（ダークのとき）。整え直しを丸ごとはしない（重いので）。
  // アプリが出すシート（時刻のダイヤルなど）の中のスクロールでは何もしない
  var scrollTimer = null;
  function scrolled(e) {
    if (!media.matches) return;
    var target = e && e.target;
    if (target && target.closest && target.closest('.myapp-pick')) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { step(darken); }, 120);
  }
  // 中身が変わるたびに、少し（0.06 秒）まとめてから整え直す（続けて描き直されるあいだに、何度も整え直さないように）
  function update() {
    clearTimeout(timer);
    timer = setTimeout(restyle, 60);
  }
  // すぐに整え直す。描き直した一覧を、整える前の見た目で一度も見せたくないときに使う（bridge.ts の childClosedJs）
  window.__myappRestyleNow = restyle;
  function applyTheme() {
    root.setAttribute('data-myapp-theme', media.matches ? 'dark' : 'light');
    if (media.matches) update();
    else lighten();
  }

  media.addEventListener('change', applyTheme);
  // 中身はあとから描かれる・入れ替わるので、そのたびに測り直し、塗り直す
  new MutationObserver(function (records) {
    if (window.__myappNoteMutations) window.__myappNoteMutations(records);
    update();
  }).observe(root, { childList: true, subtree: true });
  if (window.ResizeObserver && document.body) new ResizeObserver(update).observe(document.body);
  document.addEventListener('click', function () { setTimeout(update, 300); }, true);
  document.addEventListener('input', update, true);
  document.addEventListener('change', update, true);
  window.addEventListener('scroll', scrolled, true);
  window.addEventListener('load', update);
  applyTheme();
  update();
`;

// ---------------------------------------------------------------------------
// 2. 共通のスタイル
// ---------------------------------------------------------------------------
const BASE_CSS = `
/* 画面より広いダイアログ（スマホ向けに作り直していないもの）: 画面の幅に収め、題名と × はいつも見えるように。
   中身はパソコン向けの並びのまま、ダイアログの中でスクロールする */
.tcc-modal.myapp-wide-modal {
  position: fixed !important;
  left: 8px !important;
  top: 8px !important;
  width: calc(100% - 16px) !important;
  height: auto !important;
  max-height: calc(100% - 16px) !important;
  display: flex !important;
  flex-direction: column !important;
}
.tcc-modal.myapp-wide-modal > .tcc-modal-content {
  width: 100% !important;
  height: auto !important;
  max-height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
.tcc-modal.myapp-wide-modal .tcc-modal-header { width: 100% !important; flex: none !important; box-sizing: border-box; }
.tcc-modal.myapp-wide-modal .tcc-modal-quit { width: 40px !important; height: 40px !important; font-size: 22px !important; }
.tcc-modal.myapp-wide-modal .tcc-modal-body {
  flex: 1 1 auto !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  overflow: auto !important;
  -webkit-overflow-scrolling: touch;
}
.tcc-modal.myapp-wide-modal .tcc-modal-footer { display: none !important; }

/* 検索ボックス（虫めがねの付いた入力欄）で出る選択ダイアログ。どのアプリでも同じ作り:
   題名と × / 検索欄 / OK・キャンセル / 一覧（ページ送り付き）。画面いっぱいのシートにして、一覧は1件1枚のカードに。
   一覧の列の表示・非表示は EZCraft が別の CSS で決めているので、それに勝たないよう :where() で弱く書く */
.tcc-modal[id$="_mdl"] {
  position: fixed !important;
  left: 0 !important;
  top: 0 !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important; /* EZCraft はダイアログを 5px ずらして置く */
  border-radius: 0 !important;
}
.tcc-modal[id$="_mdl"] > .tcc-modal-content {
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  border-radius: 0 !important;
}
.tcc-modal[id$="_mdl"] .tcc-modal-header {
  width: 100% !important;
  height: 44px !important;
  flex: none !important;
  display: flex !important;
  align-items: center;
  box-sizing: border-box;
}
.tcc-modal[id$="_mdl"] .tcc-modal-title { font-size: 17px !important; font-weight: 600 !important; }
/* 閉じる（×）は、ほかのダイアログと同じ丸いボタン（GLASS_CSS）。押せる広さは、まわりの余白で取る */
.tcc-modal[id$="_mdl"] .tcc-modal-footer { display: none !important; }
.tcc-modal[id$="_mdl"] .tcc-modal-body {
  position: relative !important;
  flex: 1 1 auto !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  padding-bottom: 0 !important; /* ホームに戻るバーのぶんは、一覧の下（ページ送りの帯・最後の行の下）で空ける */
}
.tcc-modal[id$="_mdl"] .tcc-modal-body > #txtSearch {
  left: 16px !important; top: 12px !important; width: calc(100% - 32px) !important; height: 40px !important;
}
.tcc-modal[id$="_mdl"] .tcc-modal-body > #txtSearch input { box-sizing: border-box !important; width: 100% !important; height: 100% !important; font-size: 16px !important; padding-right: 32px !important; }
.tcc-modal[id$="_mdl"] .tcc-modal-body > #txtSearch input::placeholder { color: var(--myapp-text2) !important; }
.tcc-modal[id$="_mdl"] .tcc-modal-body > #txtSearch div.icon-rt { left: auto !important; right: 4px !important; top: 0 !important; height: 100% !important; display: flex !important; align-items: center; }
/* 行を押したら決まるので、OK・キャンセルは出さない（閉じるのは上の ×） */
.tcc-modal[id$="_mdl"] .tcc-modal-body > #btnCancel,
.tcc-modal[id$="_mdl"] .tcc-modal-body > #btnOK { display: none !important; }
.tcc-modal[id$="_mdl"] .tcc-modal-body > #btnOK .tcc-btn-group,
.tcc-modal[id$="_mdl"] .tcc-modal-body > #btnOK .tcc-btn,
.tcc-modal[id$="_mdl"] .tcc-modal-body > #btnCancel .tcc-btn-group,
.tcc-modal[id$="_mdl"] .tcc-modal-body > #btnCancel .tcc-btn {
  display: flex !important; align-items: center; justify-content: center; width: 100% !important; height: 100% !important; font-size: 16px !important;
}
.tcc-modal[id$="_mdl"] .tcc-modal-body > #btnOK .tcc-btn { background-color: var(--myapp-accent) !important; color: #FFFFFF !important; }
.tcc-modal[id$="_mdl"] .tcc-modal-body > #btnOK .tcc-btn i { color: #FFFFFF !important; }
/* 一覧はシートの下の端まで。ページ送りは一覧の下の 56px の帯に（ボタン 44px が切れないように）。
   ホームに戻るバーのぶんは、ページ送りの帯（ページが1つなら一覧の最後）の下で空ける（下にぼんやりした帯を残さない） */
/* （ページの番号の欄も ID が _mdl_grd で終わるので、一覧そのもの（.grid）だけに当てる） */
.tcc-modal[id$="_mdl"] .tcc-component.grid[id$="_mdl_grd"] { left: 0 !important; top: 64px !important; width: 100% !important; height: calc(100% - 64px) !important; border: none !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccScrollOuter { width: 100% !important; height: calc(100% - 56px - var(--myapp-safe-bottom, 0px)) !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"][data-myapp-onepage] .TccScrollOuter { height: 100% !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"][data-myapp-onepage] .TccGridBodyScroll { padding-bottom: var(--myapp-safe-bottom, 0px) !important; box-sizing: border-box !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridHeadFixed,
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridHeadScroll,
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyFixed { display: none !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll {
  left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important;
  overflow-x: hidden !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch;
}
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll table,
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll tbody { display: block !important; width: 100% !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll thead { display: none !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll tr {
  display: flex !important; flex-wrap: wrap !important; align-items: baseline; column-gap: 10px; row-gap: 2px;
  width: 100% !important; height: auto !important; min-height: 48px; padding: 10px 16px !important;
  box-sizing: border-box !important; border-bottom: 1px solid var(--myapp-border) !important;
}
:where(.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll) td {
  display: inline-block;
  width: auto;
  height: auto;
  padding: 0;
  border: none;
  font-size: 15px;
  line-height: 1.35;
  white-space: normal;
}
:where(.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll) td:nth-child(2) { font-size: 13px; color: var(--myapp-text2); }
/* カードの中の値には、枠線も地の色も付けない（選んだ色は行全体に付ける） */
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll td {
  border: none !important;
  padding: 0 !important;
  height: auto !important;
  background: transparent !important;
}
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll tr.myapp-tapped { background-color: var(--myapp-selected) !important; }
/* 前の列と同じ文字の列は出さない。いちばん細かい分類（最後の列）を大きく */
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll td.myapp-dup { display: none !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll td.myapp-main {
  flex-basis: 100% !important;
  order: -1 !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: var(--myapp-text) !important;
}
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll td:not(.myapp-main) { font-size: 13px !important; color: var(--myapp-text2) !important; }
/* 補足の行（番号・分類）の中の文字も灰色に（EZCraft が中の要素に色を付けていることがある） */
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll td:not(.myapp-main) * { color: inherit !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll td.myapp-main * { color: inherit !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll td.rowHead,
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll td[class*="_tdCol0"] { display: none !important; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll td > * {
  width: auto !important; max-width: none !important; height: auto !important;
  overflow: visible !important; white-space: normal !important; text-overflow: clip !important; font-size: inherit !important;
}
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .tcc-pager-navi {
  position: absolute !important;
  left: 0 !important;
  top: auto !important;
  bottom: 0 !important;
  width: 100% !important;
  height: calc(56px + var(--myapp-safe-bottom, 0px)) !important;
  padding-bottom: var(--myapp-safe-bottom, 0px) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box;
  padding-left: 16px;
  padding-right: 16px;
  border-top: 1px solid var(--myapp-border);
  overflow: visible !important;
}
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"][data-myapp-onepage] .tcc-pager-navi { display: none !important; }

/* ダイアログの × は、ライトでもダークでも見える色に */
.tcc-modal .tcc-modal-quit,
.tcc-msg-box .tcc-msg-box-quit { color: var(--myapp-text2) !important; background: transparent !important; }

/* お知らせ・確認のメッセージ（どのアプリでも同じ作り）: 画面の左右に余白をとった幅に収め、文字は折り返す */
.tcc-msg-box {
  left: 16px !important;
  width: calc(100% - 32px) !important;
  max-width: none !important;
  box-sizing: border-box !important;
}
.tcc-msg-box .tcc-msg-box-content,
.tcc-msg-box .tcc-msg-box-header,
.tcc-msg-box .tcc-msg-box-body,
.tcc-msg-box .tcc-msg-box-footer { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
.tcc-msg-box .tcc-msg-box-txt {
  width: auto !important;
  max-width: 100% !important;
  white-space: normal !important;
  word-break: normal;
  overflow-wrap: anywhere; /* 英語の言葉は途中で切らない（収まらない長い英数字だけ折る） */
  font-size: 15px !important;
  line-height: 1.5 !important;
}
.tcc-msg-box .tcc-msg-box-footer {
  display: flex !important;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px !important;
}
.tcc-msg-box .tcc-msg-box-btn { min-width: 88px !important; height: 40px !important; font-size: 16px !important; }
.tcc-msg-box .tcc-msg-box-quit { width: 40px !important; height: 40px !important; font-size: 22px !important; }

/* ダイアログの入力欄の文字は 16px 以上に（iOS は、それより小さいと入力のときに画面を勝手に拡大する） */
.tcc-modal input,
.tcc-modal textarea,
.tcc-modal select { font-size: 16px !important; }

/* 表の、押した（選んだ）行 */
.TccGridBodyScroll tr.myapp-tapped,
.TccGridBodyScroll tr.myapp-tapped > td { background-color: var(--myapp-selected) !important; }
/* 入力欄の右の虫めがね・▼の置き場。入力中に白い四角にならないように、地は塗らない */
.tcc-component .icon-rt:not(input),
.tcc-component .icon-lt:not(input),
.tcc-component .icon-rt:not(input) *,
.tcc-component .icon-lt:not(input) * { background-color: transparent !important; background-image: none !important; }
/* 欄と印のあいだの縦の線（パソコン向けの区切り）は出さない。印は欄の中の飾りとして見せる */
.tcc-component div.icon-rt:not(input), .tcc-component div.icon-lt:not(input) { border-left: none !important; border-right: none !important; }

/* 入力欄の中の薄い説明（プレースホルダー）は、入れた値と見分けがつくように灰色に（読める濃さは残す） */
input::placeholder,
textarea::placeholder { color: var(--myapp-text2) !important; opacity: 0.75 !important; }

/* チェックボックス・ラジオボタン・選択肢などの部品も、ライト / ダークに合わせる */
:root { color-scheme: light; }
:root[data-myapp-theme="dark"] { color-scheme: dark; }
input[type="checkbox"], input[type="radio"] { accent-color: var(--myapp-accent); }
/* EZCraft は、チェックボックス・ラジオボタンを自分で描く（白い四角・丸）。ダークでは白く浮くので、入力欄と同じ面にし、
   選んだら差し色で塗る（チェックの印は白、ラジオの点は差し色） */
div.tcc-component.chkbox input[type="checkbox"] + label::before,
div.tcc-component.radioBtn input[type="radio"] + label::before {
  background: var(--myapp-fill) !important;
  border: 1.5px solid var(--myapp-text2) !important;
  box-shadow: none !important;
}
div.tcc-component.chkbox input[type="checkbox"] + label::before { border-radius: 6px !important; }
div.tcc-component.chkbox input[type="checkbox"]:checked + label::before {
  background: var(--myapp-accent) !important;
  border-color: var(--myapp-accent) !important;
}
div.tcc-component.chkbox input[type="checkbox"]:checked + label::after { border-color: #FFFFFF !important; }
/* チェックボックス・ラジオの文字と、欄の右の印（カレンダー・▼）は、EZCraft が決まった濃い灰色（rgb(76,79,83)）で塗る。
   ダークでは地に溶けて読めないので、テーマの色に */
div.tcc-component.chkbox label, div.tcc-component.radioBtn label { color: var(--myapp-text) !important; }
div.tcc-component div.icon-rt, div.tcc-component div.icon-rt i { color: var(--myapp-text2) !important; }
/* カレンダーの印（Font Awesome）は、字の形が上寄りに描かれる（欄の真ん中より 2.5pt ほど上に見える）。少し下げる */
div.tcc-component div.icon-rt i.fa-calendar, div.tcc-component div.icon-rt i.fa-calendar-o { transform: translateY(2px); }
/* ラジオボタンの組（.tcc-component.radio）: パソコン向けの細い四角い枠をやめて、入力欄と同じ角の丸い面にする（どの画面でも同じ見た目に） */
div.tcc-component.radio {
  border: none !important;
  border-radius: 16px !important;
  background-color: var(--myapp-inset) !important; /* field だと、ダークではシートの地と同じ色になって面が消える */
  box-sizing: border-box !important;
}
/* 画面の地（灰色）にじかに置いた組は、ほかの入力欄と同じ白い面に（灰色の inset だと、地と同じ色で面が見えない）。
   ダイアログ・シートの中と、白いカードの中は、上の inset のまま */
div.tcc-component.radio:not(.tcc-modal *):not(.myapp-card *) { background-color: var(--myapp-field) !important; }
/* 必須の印（EZCraft が欄の右の外に ::after で付ける「＊」）: 画面の端にはみ出し、欄の印とも重なるので、欄の見出しの後ろに移す
   （JS の requiredMarks が見出しに .myapp-required を付ける。見出しが見つからない欄は、そのまま） */
div.tcc-component.text.myapp-req-moved::after { display: none !important; }
/* 見出しが長いとき（健診予定日＊ など）も、欄にかからないよう少しだけ詰める */
.tcc-component.lbl.myapp-required .tcc-label-text { letter-spacing: -0.02em; }
.tcc-component.lbl.myapp-required .tcc-label-text::after {
  content: '＊';
  margin-left: 1px;
  font-size: 11px;
  font-weight: 700;
  color: var(--myapp-danger);
}
/* ダイアログの中の日付の欄（右にカレンダーの印）は、ほかの欄と同じく文字を左に寄せる（EZCraft の .center）。
   勤務表の「‹ 2026/11 ›」や時刻の小さな欄は、真ん中のまま */
.tcc-modal div.tcc-component.text input.text-box.icon-rt.center { text-align: left !important; }
div.tcc-component.radioBtn input[type="radio"]:checked + label::before { border: 2px solid var(--myapp-accent) !important; }
div.tcc-component.radioBtn input[type="radio"]:checked + label::after { background: var(--myapp-accent) !important; }
div.tcc-component.radioBtn input[disabled]:checked + label::after { background: var(--myapp-text2) !important; }

/* 読むだけの欄（入力できない欄）は、入力欄の枠を付けずに文字だけで見せる */
.tcc-component input:disabled,
.tcc-component textarea:disabled {
  background-color: transparent !important;
  border-color: transparent !important;
  color: var(--myapp-text) !important;
  -webkit-text-fill-color: var(--myapp-text) !important;
  opacity: 1 !important;
  padding-left: 0 !important;
}
.tcc-component:has(input:disabled) > .icon-rt:not(input),
.tcc-component:has(input:disabled) > .icon-lt:not(input) { display: none !important; }

/* 下に固定するボタンの帯（画面の下、またはダイアログの下） */
.myapp-bottom-bar {
  display: flex;
  gap: 12px;
  box-sizing: border-box;
  background-color: var(--myapp-bg);
  border-top: 1px solid var(--myapp-border);
}
body > .myapp-bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 900;
  /* 下は、ホームに戻るバー（画面の下の線）のぶん空ける。--myapp-safe-bottom はアプリが入れる（WebView の env() は 0 のことがある） */
  padding: 10px 16px calc(10px + max(env(safe-area-inset-bottom), var(--myapp-safe-bottom, 0px)));
}
.myapp-bottom-bar.in-modal { flex: none; padding: 10px 16px 14px; background-color: var(--myapp-surface); }
.myapp-bottom-bar.myapp-empty-bar { display: none !important; }
/* 小さな知らせ（ヘルスケアの歩数を入れた など）: 画面の下に浮かぶ、濃い色のカプセル。ダイアログより上に出す */
body > .myapp-health-note {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(92px + var(--myapp-safe-bottom, 0px)); /* 下のボタンの帯（保存など）に重ならない高さ */
  z-index: 2147483000;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(30, 30, 32, 0.92);
  color: #FFFFFF;
  font-size: 14px;
  line-height: 1.45;
  text-align: center;
  text-wrap: balance;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  transition: opacity 0.4s;
}
body > .myapp-health-note.myapp-hide { opacity: 0; }
:root.myapp-has-bar body { padding-bottom: calc(84px + var(--myapp-safe-bottom, 0px)) !important; }
.myapp-bottom-bar .tcc-btn-group,
.myapp-bottom-bar .tcc-btn {
  display: flex !important;
  align-items: center;
  justify-content: center;
  width: 100% !important;
  height: 100% !important;
  border-radius: 12px !important;
  font-size: 17px !important;
  font-weight: 600 !important;
}
.myapp-bottom-bar .myapp-bar-primary .tcc-btn { background-color: var(--myapp-accent) !important; color: #FFFFFF !important; }
.myapp-bottom-bar .myapp-bar-primary .tcc-btn i { background: transparent !important; color: #FFFFFF !important; }

/* EZCraft の年月・日付を選ぶ部品（#TccYmPicker・.tcc-component.datepicker）: パソコン向けの、入力欄の下に出る小さな四角い
   ポップアップをやめて、画面の下から出るシートにする（今月のプロジェクトのシートと同じ形）。
   後ろは暗くし（JS の calendarSheets が .myapp-cal-back を置く）、暗い所を押すと閉じる。
   今日（今月）は青い文字、選んでいる日（月）は青い丸。EZCraft の赤い四角・マウスを乗せたときの青は使わない */
.myapp-cal-back {
  position: fixed; inset: 0; z-index: 100000;
  background: rgba(0, 0, 0, 0.28);
  animation: myapp-cal-fade 0.18s ease-out;
}
#TccYmPicker,
.tcc-component.datepicker {
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  top: auto !important;
  bottom: 0 !important;
  width: auto !important;
  z-index: 100001 !important;
  box-sizing: border-box !important;
  padding: 8px 16px calc(16px + var(--myapp-safe-bottom, 0px)) !important;
  background: var(--myapp-surface) !important;
  color: var(--myapp-text) !important;
  border: none !important;
  border-radius: 30px 30px 0 0 !important;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.18) !important;
  font-size: 17px !important;
  outline: none !important;
  animation: myapp-cal-up 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
}
@keyframes myapp-cal-up { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes myapp-cal-fade { from { opacity: 0; } to { opacity: 1; } }
/* 上の段: ‹ 年月 › */
#TccYmPicker .tcc-ympkr-hdr,
.tcc-component.datepicker .tcc-dtpkr-hdr {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  height: 56px !important;
  background: transparent !important;
  color: var(--myapp-text) !important;
}
#TccYmPicker .tcc-ympkr-btn,
.tcc-component.datepicker .tcc-dtpkr-btn {
  position: static !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: none !important;
  width: 44px !important;
  height: 44px !important;
  line-height: 1 !important;
  border-radius: 50% !important;
  background: var(--myapp-inset) !important;
  color: var(--myapp-accent-text) !important;
  font-size: 16px !important;
}
#TccYmPicker .tcc-ympkr-btn i,
.tcc-component.datepicker .tcc-dtpkr-btn i { color: inherit !important; }
#TccYmPicker .tcc-ympkr-btn:active,
.tcc-component.datepicker .tcc-dtpkr-btn:active { background: var(--myapp-pressed-bg) !important; }
#TccYmPicker .tcc-prev-year,
.tcc-component.datepicker .tcc-prev-mon { order: 0; }
#TccYmPicker .tcc-ympkr-title,
.tcc-component.datepicker .tcc-dtpkr-title { order: 1; flex: 1 1 auto; text-align: center !important; font-size: 17px !important; font-weight: 700 !important; line-height: 44px !important; }
#TccYmPicker .tcc-next-year,
.tcc-component.datepicker .tcc-next-mon { order: 2; }
/* 表: 指で押しやすい大きさに。セルの間をあけて、角を丸める */
.tcc-component.datepicker .tcc-dtpkr-tbl { float: none !important; width: 100% !important; }
.tcc-component.datepicker .table-border-box { display: none !important; }
#TccYmPicker table,
.tcc-component.datepicker table {
  width: 100% !important;
  margin: 0 !important;
  table-layout: fixed;
  border-collapse: separate !important;
  border-spacing: 6px 4px !important;
}
.tcc-component.datepicker th { padding: 2px 0 6px !important; font-size: 13px !important; font-weight: 600 !important; color: var(--myapp-text2) !important; }
#TccYmPicker td,
#TccYmPicker td:hover,
.tcc-component.datepicker td,
.tcc-component.datepicker td:hover {
  width: auto !important;
  height: 44px !important;
  padding: 0 !important;
  border-radius: 22px !important;
  background: transparent !important;
  color: var(--myapp-text) !important;
  font-size: 17px !important;
  font-weight: 400 !important;
  text-align: center !important;
}
#TccYmPicker td,
#TccYmPicker td:hover { height: 52px !important; border-radius: 16px !important; }
#TccYmPicker td.notThisMon,
#TccYmPicker td.notThisMon:hover,
.tcc-component.datepicker td.notThisMon,
.tcc-component.datepicker td.notThisMon:hover { color: var(--myapp-text2) !important; opacity: 0.45; }
#TccYmPicker td.tomonth,
#TccYmPicker td.tomonth:hover,
.tcc-component.datepicker td.today,
.tcc-component.datepicker td.today:hover { color: var(--myapp-accent-text) !important; font-weight: 700 !important; }
/* 年月: 選んでいる月が今月のときは、EZCraft は「選んでいる」の印を付けないので、今月を青い面にする */
#TccYmPicker table:not(:has(td.selected)) td.tomonth,
#TccYmPicker td.selected,
#TccYmPicker td.selected:hover,
.tcc-component.datepicker td.selected,
.tcc-component.datepicker td.selected:hover { background: var(--myapp-accent) !important; color: #FFFFFF !important; font-weight: 700 !important; opacity: 1; }
#TccYmPicker td:active,
.tcc-component.datepicker td:active { background: var(--myapp-pressed-bg) !important; }

/* EZCraft のお知らせの帯（右上の、パソコン向けの幅 420px の色の帯）: 画面の下のほうに、画面の幅に収まる小さな知らせとして出す。
   上に出すと、ダイアログの題名や × を隠してしまうため。JS（notices）が、見出しの要らないもの・エラー・消す時刻にしるしを付ける */
#TccNotifyBoxes {
  left: 0 !important;
  right: 0 !important;
  top: auto !important;
  bottom: calc(96px + var(--myapp-safe-bottom, 0px)) !important;
  height: 0 !important;
  z-index: 200000 !important;
}
#TccNotifyBoxes .TccNotify {
  left: 12px !important;
  right: 12px !important;
  top: auto !important;
  bottom: 0 !important;
  width: auto !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  padding: 12px 16px 12px 48px !important;
  border: 1px solid var(--myapp-glass-border) !important;
  border-radius: 22px !important;
  background: var(--myapp-sheet) !important;
  background: color-mix(in srgb, var(--myapp-fill) 94%, transparent) !important;
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: var(--myapp-glass-shadow) !important;
  color: var(--myapp-text) !important;
  transition: opacity 0.25s ease-out;
}
#TccNotifyBoxes .TccNotify:not(:has(.notifyIcon i[class*="fa-"])) { padding-left: 16px !important; }
#TccNotifyBoxes .TccNotify[data-myapp-gone] { opacity: 0 !important; pointer-events: none !important; }
#TccNotifyBoxes .TccNotify .notifyIcon {
  left: 16px !important;
  top: 50% !important;
  transform: translateY(-50%);
  font-size: 20px !important;
  color: var(--myapp-accent) !important;
}
#TccNotifyBoxes .TccNotify[data-myapp-error] .notifyIcon { color: var(--myapp-danger) !important; }
#TccNotifyBoxes .TccNotify .msgAreaSm,
#TccNotifyBoxes .TccNotify .msgAreaLg { float: none !important; margin: 0 !important; }
#TccNotifyBoxes .TccNotify span {
  display: block !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  letter-spacing: 0 !important;
  margin: 0 0 2px !important;
  color: var(--myapp-text2) !important;
}
#TccNotifyBoxes .TccNotify[data-myapp-plain] span { display: none !important; }
#TccNotifyBoxes .TccNotify p {
  margin: 0 !important;
  font-size: 15px !important;
  line-height: 1.4 !important;
  overflow: visible !important;
  word-break: normal !important;
  color: var(--myapp-text) !important;
}
#TccNotifyBoxes .TccNotify .miniIcon { display: none !important; }

/* 読み込み中の表示: EZCraft の大きなアイコンと「Loading...」の代わりに、アプリと同じ小さなくるくるを真ん中に */
#loadingIcon.loading-bg { background: transparent !important; }
#loadingIcon .loading-icon {
  position: fixed !important;
  left: calc(50% - 14px) !important;
  top: calc(50% - 14px) !important;
  width: 28px !important;
  height: 28px !important;
  font-size: 0 !important;
  box-sizing: border-box !important;
  border: 3px solid var(--myapp-border) !important;
  border-top-color: var(--myapp-text2) !important;
  border-radius: 50% !important;
  animation: myapp-spin 0.8s linear infinite !important;
}
#loadingIcon .loading-icon::before { content: none !important; }
#loadingIcon .loading-msg { display: none !important; }
/* 保存のあいだは、アプリが「保存しています（n/m）」を出すので、くるくるは隠す（押せないようにする面は残す。bridge.ts の SAVE_WATCH_JS） */
html.myapp-saving #loadingIcon .loading-icon { opacity: 0 !important; }
/* 重ねた画面で登録・削除して戻ったときの、データだけの読み直しのあいだは出さない（bridge.ts の childClosedJs） */
html.myapp-quiet-refresh #loadingIcon { display: none !important; }
@keyframes myapp-spin { to { transform: rotate(360deg); } }

/* 中身のない一覧に出す文 */
[data-myapp-empty-msg].myapp-empty::after {
  content: attr(data-myapp-empty-msg);
  position: absolute;
  z-index: 20;
  pointer-events: none;
  left: 16px;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  text-wrap: balance; /* 2行になるときは、行の長さをそろえる（2行目が1語だけにならない） */
  color: var(--myapp-text2);
}
/* 一覧が見えてすぐのあいだと、データを読んでいるあいだは、文を出さない（emptyGrids） */
[data-myapp-empty-msg].myapp-empty.myapp-empty-wait::after { visibility: hidden; }
[data-myapp-empty-msg].myapp-empty .TccGridHeadScroll,
[data-myapp-empty-msg].myapp-empty .TccGridHeadFixed { visibility: hidden !important; }

/* 一覧のページ送り（« < 1 / 15p > »）: 真ん中にそろえ、« < > » は指で押しやすい丸いボタン（44pt）に。ページの欄は小さな札に */
.tcc-pager-navi .pager-navi-main {
  position: static !important; /* EZCraft は left を数字で決めて、右に寄せている */
  left: auto !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px;
  float: none !important;
  width: auto !important;
  margin: 0 auto !important;
}
.tcc-pager-navi .pager-navi-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: none !important;
  width: 44px !important;
  min-width: 44px !important;
  height: 44px !important;
  line-height: 1 !important;
  padding: 0 !important;
  border-radius: 50% !important;
  background-color: var(--myapp-inset) !important; /* fill だと、ダークでは一覧の地と同じ色になって丸が消える */
  color: var(--myapp-accent-text) !important;
  font-size: 20px !important;
  font-weight: 600 !important;
}
.tcc-pager-navi .pager-navi-btn:active { background-color: var(--myapp-pressed-bg) !important; }
.tcc-pager-navi .pager-navi-page { margin: 0 2px 0 6px !important; }
.tcc-pager-navi .pager-navi-page .tcc-component.number { width: 44px !important; height: 36px !important; }
.tcc-pager-navi .pager-navi-page input { width: 44px !important; height: 36px !important; text-align: center !important; border-radius: 10px !important; padding: 0 !important; }
.tcc-pager-navi .pager-navi-slash,
.tcc-pager-navi .pager-navi-total { color: var(--myapp-text2) !important; font-size: 15px !important; }
.tcc-pager-navi .pager-navi-total { margin-right: 6px !important; }
:root {
  /* 灰色の地に、白いカード（iOS 26 の設定アプリと同じ）。アプリの側（src/theme.ts）と同じ色 */
  --myapp-bg: #F2F2F7;
  --myapp-surface: #FFFFFF;
  --myapp-fill: #FFFFFF;
  --myapp-inset: #F2F2F7; /* カードの中に置く面（時刻の札など） */
  --myapp-field: #FFFFFF;
  --myapp-field-border: rgba(60, 60, 67, 0.14);
  --myapp-accent-text: #0062D6; /* 薄い青の地に置く、差し色の文字 */
  --myapp-tab-on: rgba(0, 122, 255, 0.13);
  /* アイコンの薄い青の地（マイアプリのアイコンと同じ。src/theme.ts の iconTile） */
  --myapp-icon-tile: rgba(0, 122, 255, 0.12);
  /* Liquid Glass（浮かせる操作の部品だけに使う。下の GLASS_CSS） */
  --myapp-glass: linear-gradient(180deg, rgba(255, 255, 255, 0.80), rgba(255, 255, 255, 0.58));
  --myapp-glass-border: rgba(255, 255, 255, 0.92);
  --myapp-glass-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 1), inset 0 -1px 0 rgba(0, 0, 0, 0.05);
  --myapp-glass-blur: blur(20px) saturate(180%);
  --myapp-tint: linear-gradient(180deg, rgba(10, 122, 255, 0.94), rgba(0, 98, 220, 0.96));
  --myapp-tint-shadow: 0 10px 24px rgba(0, 98, 220, 0.30), inset 0 1px 0 rgba(255, 255, 255, 0.45), inset 0 -1px 0 rgba(0, 0, 0, 0.10);
  --myapp-sheet: rgba(247, 247, 250, 0.90);
  --myapp-segment: rgba(118, 118, 128, 0.12);
  --myapp-segment-on: #FFFFFF;
  --myapp-segment-on-shadow: 0 2px 6px rgba(0, 0, 0, 0.10), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
  --myapp-edge: rgba(242, 242, 247, 0.88);
  --myapp-edge-0: rgba(242, 242, 247, 0);
  --myapp-card-muted: rgba(118, 118, 128, 0.08); /* 控えめなカード（休日の行など）。地より少しだけ濃い灰色 */
  --myapp-pressed-bg: #E5E5EA; /* 押しているあいだのカード */
  --myapp-text: #111114;
  --myapp-text2: #6E6E73;
  --myapp-border: #E3E3E8;
  --myapp-accent: #007AFF;
  --myapp-selected: rgba(0, 122, 255, 0.12);
  --myapp-warn: #C93400;
  --myapp-danger: #D92D20;
  --myapp-success: #1E7B34;
  --myapp-success-bg: rgba(52, 199, 89, 0.14);
}
:root[data-myapp-theme="dark"] {
  --myapp-bg: #000000;
  --myapp-surface: #1C1C1E;
  --myapp-fill: #1C1C1E;
  --myapp-inset: #2C2C2E;
  --myapp-field: #1C1C1E;
  --myapp-field-border: #3A3A3C;
  --myapp-accent-text: #6CB4FF;
  --myapp-tab-on: rgba(10, 132, 255, 0.28);
  --myapp-icon-tile: rgba(10, 132, 255, 0.18);
  --myapp-glass: linear-gradient(180deg, rgba(92, 92, 98, 0.55), rgba(50, 50, 54, 0.50));
  --myapp-glass-border: rgba(255, 255, 255, 0.16);
  --myapp-glass-shadow: 0 10px 30px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(255, 255, 255, 0.05);
  --myapp-tint: linear-gradient(180deg, rgba(36, 138, 255, 0.92), rgba(10, 104, 224, 0.95));
  --myapp-tint-shadow: 0 10px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.40), inset 0 -1px 0 rgba(0, 0, 0, 0.15);
  --myapp-sheet: rgba(32, 32, 35, 0.90);
  --myapp-segment: rgba(118, 118, 128, 0.24);
  --myapp-segment-on: #636366;
  --myapp-segment-on-shadow: none;
  --myapp-edge: rgba(0, 0, 0, 0.88);
  --myapp-edge-0: rgba(0, 0, 0, 0);
  --myapp-card-muted: #111113;
  --myapp-pressed-bg: #2C2C2E;
  --myapp-text: #F5F5F7;
  --myapp-text2: #98989F;
  --myapp-border: #2C2C2E;
  --myapp-accent: #0A84FF;
  --myapp-selected: rgba(10, 132, 255, 0.28);
  --myapp-warn: #FF9F0A;
  --myapp-danger: #FF6B5E;
  --myapp-success: #7EE2A0;
  --myapp-success-bg: rgba(48, 209, 88, 0.18);
  color-scheme: dark;
}

/* ---- 画面の外へはスクロールしない ----
   EZCraft は、隠している部品（パソコン向けの幅の表など）も、見えないまま場所を取っている。
   そのぶん横にスクロールできて、何もないところが出ていた。画面の幅で切る（端で引っぱって戻る動きも止める） */
html, body {
  overflow-x: clip !important;
  overscroll-behavior: none;
}

/* ---- 地: どのアプリも同じ色。フォームやパネルの白い地・枠はなくす ---- */
html, body {
  background-color: var(--myapp-bg) !important;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
.tcc-form.form-content,
.tcc-form.form-content .tcc-tile,
.tcc-form.form-content .tcc-panel,
.tcc-form.form-content .tcc-panel-body,
.tcc-form.form-content .tcc-tab-content,
.tcc-form.form-content .tcc-tab-pane {
  background-color: transparent !important;
  background-image: none !important;
}

/* いちばん外のフォームのタイトル帯（アプリ名と ×）は、上のヘッダーと重なるので出さない */
.tcc-form.form-content:not(.tcc-modal) > .tcc-form-title { display: none !important; }
/* 見えているタブが1つしかないときは、切り替えるものがないのでタブの見出しを出さない（数えるのは JS） */
div.tcc-tab > ul.tcc-tab-head.myapp-single-tab { display: none !important; }

/* ---- 見出し（ダイアログやパネルのタイトル） ---- */
div.tcc-form .tcc-form-title,
.tcc-modal-header, .tcc-msg-box-header, .tcc-popover-header {
  background-color: var(--myapp-surface) !important;
  background-image: none !important;
  color: var(--myapp-text) !important;
  border-bottom: 1px solid var(--myapp-border) !important;
}
div.tcc-form .tcc-form-title > .tcc-form-title-text { font-weight: 600; }
div.tcc-panel .tcc-panel-title {
  background-color: transparent !important;
  color: var(--myapp-text2) !important;
  font-weight: 600;
}

/* ---- 文字（ラベル）: 色の帯や枠はやめ、文字はテーマの色に ---- */
.tcc-component.lbl .tcc-label {
  background-color: transparent !important;
  background-image: none !important;
  border-color: transparent !important;
}
.tcc-component.lbl .tcc-label.show-border { border-color: var(--myapp-border) !important; }
.tcc-component.lbl .tcc-label,
.tcc-component.lbl .tcc-label-text,
.tcc-component.lbl i { color: var(--myapp-text) !important; }

/* ---- 入力欄: 角を丸く、細い線で ---- */
.tcc-component .text-box,
.tcc-component .num-box,
.tcc-component textarea,
.tcc-component select,
.tcc-component input[type="text"],
.tcc-component input[type="number"],
.tcc-component input[type="password"],
.tcc-component input[type="tel"],
.tcc-component input[type="email"] {
  border: 1px solid var(--myapp-border) !important;
  border-radius: 10px !important;
  background-color: var(--myapp-field) !important;
  color: var(--myapp-text) !important;
  box-shadow: none !important;
  -webkit-appearance: none;
}
:root[data-myapp-theme="dark"] .tcc-component .text-box,
:root[data-myapp-theme="dark"] .tcc-component input[type="text"] { border-color: #3A3A3C !important; }
.tcc-component input:focus,
.tcc-component textarea:focus,
.tcc-component select:focus {
  border-color: var(--myapp-accent) !important;
  outline: none !important;
}
.tcc-component input[readonly],
.tcc-component input[disabled],
.tcc-component textarea[readonly] { background-color: var(--myapp-fill) !important; }

/* ---- ボタン: 2種類だけ。ふつうは灰色の面に青い文字（主な操作だけ青く塗る: appStyles の primary） ---- */
.tcc-btn,
.tcc-btn-group > .tcc-btn {
  background-color: var(--myapp-segment) !important;
  background-image: none !important;
  border: none !important;
  border-radius: 12px !important;
  box-shadow: none !important;
  color: var(--myapp-accent) !important;
  font-weight: 600 !important;
  text-shadow: none !important;
  transition: opacity 0.15s;
}
.tcc-btn i { color: inherit !important; }
.tcc-btn:active { opacity: 0.6; }

/* ---- タブ: 角丸の切り替えスイッチ（セグメント）風に ---- */
div.tcc-tab > ul.tcc-tab-head { border: none !important; gap: 4px; }
div.tcc-tab > ul.tcc-tab-head > li > a {
  border: none !important;
  border-radius: 8px !important;
  background-color: var(--myapp-fill) !important;
  color: var(--myapp-text2) !important;
}
div.tcc-tab > ul.tcc-tab-head > li.active > a {
  background-color: var(--myapp-accent) !important;
  color: #FFFFFF !important;
  font-weight: 600;
}

/* ---- 表: どのアプリも同じ。灰色の見出し、横線だけ、選んだ行は薄い青 ---- */
.tcc-component.grid {
  border: 1px solid var(--myapp-border) !important;
  border-radius: 12px;
  overflow: hidden;
  background-color: var(--myapp-surface) !important;
}
/* 検索のあと、EZCraft が表に入力の向き（フォーカス）を移すと、白い輪郭が出る。出さない */
.tcc-component.grid,
.tcc-component.grid:focus,
.tcc-component.grid *:focus { outline: none !important; }
table.TccGrid { background: transparent !important; }
table.TccGrid tr,
table.TccGrid.zebra tr.odd,
table.TccGrid.zebra tr.even { background: transparent !important; }
table.TccGrid th {
  background-image: none !important;
  background-color: var(--myapp-fill) !important;
  color: var(--myapp-text2) !important;
  font-weight: 600 !important;
  border: none !important;
  border-bottom: 1px solid var(--myapp-border) !important;
}
table.TccGrid th * { color: var(--myapp-text2) !important; }
table.TccGrid td {
  background-color: transparent !important;
  color: var(--myapp-text) !important;
  border: none !important;
  border-bottom: 1px solid var(--myapp-border) !important;
}
table.TccGrid td * { color: var(--myapp-text) !important; }
/* 選んだ行（EZCraft は行に色を直接書く）→ テーマの薄い青 */
table.TccGrid tr[style*="background"] > td,
table.TccGrid td[style*="background"] { background-color: var(--myapp-selected) !important; }
/* EZCraft 独自のスクロールバーはやめ、指でのスクロールにする */
.tcc-component.grid .vScroll,
.tcc-component.grid .hScroll,
.tcc-component.grid .boxCorner { display: none !important; }
.tcc-component.grid .TccGridBodyScroll { overflow-y: auto !important; -webkit-overflow-scrolling: touch; }
table.TccGrid td.selected > div { background-image: none !important; }
.tcc-component.grid .TccCellBox { display: none !important; } /* 選んだセルの枠 */

/* ---- 選択欄を押したときに出る一覧: 画面の内側に収め、角丸と影 ---- */
body > .tcc-component.cmblist {
  left: 16px !important;
  width: calc(100vw - 32px) !important;
  max-width: calc(100vw - 32px) !important;
  box-sizing: border-box !important;
  border: none !important;
  border-radius: 12px !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
  background-color: var(--myapp-surface) !important;
  overflow-y: auto !important;
  padding: 6px 0 !important;
}
body > .tcc-component.cmblist > .cmblist-item {
  padding: 10px 16px !important;
  font-size: 15px !important;
  color: var(--myapp-text) !important;
  background-color: transparent !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
body > .tcc-component.cmblist > .cmblist-item.selected,
body > .tcc-component.cmblist > .cmblist-item:hover {
  background-color: var(--myapp-selected) !important;
  color: var(--myapp-text) !important;
}

/* ---- ダイアログ: 角丸と影 ---- */
.tcc-modal, .tcc-msg-box, .tcc-popover {
  border-radius: 14px !important;
  overflow: hidden;
  border: none !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25) !important;
  background-color: var(--myapp-surface) !important;
}
`;

// ---------------------------------------------------------------------------
// Liquid Glass（iOS 26）に合わせた見た目。上の BASE_CSS より後に置き、同じ強さの指定はこちらを勝たせる。
//   - 地は灰色、中身は白いカード（ダークは黒と濃い灰色）。文字はアプリと同じ端末の文字（SF・ヒラギノ）
//   - ボタンは角の丸いカプセル。大きなカード型のボタン（JS が myapp-tall-btn を付ける）は角を大きく丸めるだけ
//   - 浮かせる操作の部品（下のボタンの帯・下のタブ・ダイアログ）だけをガラスに（すりガラス＋縁の光）。
//     一覧や入力欄はガラスにしない（読みにくくなる。Apple の決まりも同じ）
//   本物の Liquid Glass（ゆがみ・揺れ）は Web では作れないので、これは「風」。アプリ側の部品は本物（GlassButton）
// ---------------------------------------------------------------------------
const GLASS_CSS = `
/* 一覧のカードの中のリンク（申請 No. など）: 下線は出さない（行を押せば開くので、文字は地の色のまま） */
.TccGridBodyScroll td a { text-decoration: none !important; color: inherit !important; }
/* ---- 文字: アプリ（ネイティブ）の画面と同じ端末の文字にそろえる。アイコンの文字（Font Awesome）は変えない ---- */
html, body { font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif !important; }
body *:not(i):not(.fa):not(.fas):not(.far):not(.fab):not([class*="fa-"]):not([class*="glyphicon"]) { font-family: inherit !important; }

/* ---- ボタン: カプセル。カード型の大きなボタンは、角を大きく丸めるだけ ---- */
.tcc-btn,
.tcc-btn-group > .tcc-btn { border-radius: 999px !important; }
.tcc-btn.myapp-tall-btn { border-radius: 22px !important; }

/* ---- 入力欄: 角を少し大きく、線は薄く ---- */
.tcc-component .text-box,
.tcc-component .num-box,
.tcc-component textarea,
.tcc-component select,
.tcc-component input[type="text"],
.tcc-component input[type="number"],
.tcc-component input[type="password"],
.tcc-component input[type="tel"],
.tcc-component input[type="email"] {
  border-radius: 12px !important;
  border-color: var(--myapp-field-border) !important;
}
:root[data-myapp-theme="dark"] .tcc-component .text-box,
:root[data-myapp-theme="dark"] .tcc-component input[type="text"] { border-color: var(--myapp-field-border) !important; }
.tcc-component input:focus,
.tcc-component textarea:focus,
.tcc-component select:focus { border-color: var(--myapp-accent) !important; box-shadow: 0 0 0 3px var(--myapp-tab-on) !important; }
/* カードの中の入力欄・ボタンは、カードと見分けがつく面に */
.myapp-card :is(.text-box, .num-box, textarea, select, input[type="text"], input[type="number"], input[type="tel"]) {
  background-color: var(--myapp-inset) !important;
  border-color: transparent !important;
}
.myapp-card .tcc-btn { background-color: var(--myapp-segment) !important; }

/* ---- タブ（どの画面でも）: iOS の切り替えスイッチ。選んでいるものは白い面（青く塗らない） ---- */
div.tcc-tab > ul.tcc-tab-head { background-color: var(--myapp-segment) !important; border-radius: 12px !important; }
div.tcc-tab > ul.tcc-tab-head > li > a {
  background-color: transparent !important;
  color: var(--myapp-text) !important;
  border-radius: 10px !important;
  font-weight: 500;
}
div.tcc-tab > ul.tcc-tab-head > li.active > a {
  background-color: var(--myapp-segment-on) !important;
  color: var(--myapp-text) !important;
  box-shadow: var(--myapp-segment-on-shadow) !important;
  font-weight: 600;
}

/* ---- スイッチ（EZCraft の ON・OFF の部品）: iOS のスイッチの形に（押したときの動きは EZCraft のまま） ---- */
.tcc-component.switch { width: 51px !important; height: 31px !important; overflow: visible !important; }
.tcc-component.switch > label { position: relative !important; display: block !important; width: 51px !important; height: 31px !important; margin: 0 !important; }
.tcc-component.switch > label > input { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; margin: 0 !important; opacity: 0 !important; z-index: 2 !important; }
.tcc-component.switch > label > i {
  position: absolute !important;
  inset: 0 !important;
  width: 51px !important;
  height: 31px !important;
  box-sizing: border-box !important;
  border: none !important;
  border-radius: 16px !important;
  background: rgba(120, 120, 128, 0.20) !important;
  box-shadow: none !important;
  font-size: 0 !important;
  transition: background-color 0.2s;
}
/* ダークでは、切ったときの溝が地に溶けて見えないので、iOS と同じ明るさに */
:root[data-myapp-theme="dark"] .tcc-component.switch > label > i { background: rgba(120, 120, 128, 0.36) !important; }
.tcc-component.switch > label > i::before {
  content: '' !important;
  position: absolute !important;
  left: 2px !important;
  top: 2px !important;
  width: 27px !important;
  height: 27px !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 50% !important;
  background: #FFFFFF !important;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.06) !important;
  transform: none;
  transition: transform 0.2s;
}
.tcc-component.switch > label > i::after { content: none !important; display: none !important; }
.tcc-component.switch > label > input:checked + i { background: #34C759 !important; }
.tcc-component.switch > label > input:checked + i::before { transform: translateX(20px) !important; }

/* ---- 表 ---- */
.tcc-component.grid { border-radius: 18px; border-color: transparent !important; }

/* ---- 下に固定するボタンの帯: 帯は消し、ボタンをガラスのカプセルにして浮かせる。主なボタンは青いガラス ---- */
.myapp-bottom-bar { background: transparent !important; border-top: none !important; }
body > .myapp-bottom-bar {
  padding: 16px 16px calc(10px + max(env(safe-area-inset-bottom), var(--myapp-safe-bottom, 0px)));
  /* 下の端は、スクロールした中身が少し薄れて見えるように（iOS 26 の画面の端と同じ） */
  background: linear-gradient(to top, var(--myapp-edge) 0%, var(--myapp-edge) 35%, var(--myapp-edge-0) 100%) !important;
}
.myapp-bottom-bar .tcc-btn-group { border-radius: 999px !important; background: transparent !important; }
.myapp-bottom-bar .tcc-btn {
  border-radius: 999px !important;
  background: var(--myapp-glass) !important;
  border: 1px solid var(--myapp-glass-border) !important;
  box-shadow: var(--myapp-glass-shadow) !important;
  -webkit-backdrop-filter: var(--myapp-glass-blur);
  backdrop-filter: var(--myapp-glass-blur);
}
.myapp-bottom-bar .myapp-bar-primary .tcc-btn {
  background: var(--myapp-tint) !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
  box-shadow: var(--myapp-tint-shadow) !important;
}
.myapp-bottom-bar .tcc-btn:active { opacity: 1; transform: scale(0.97); }
.myapp-bottom-bar .tcc-btn { transition: transform 0.15s; }

/* ---- 下のタブ（tabBars。JS が .myapp-tabbar を作る）: ガラスのカプセルに、アイコンと名前 ---- */
.myapp-tabbar {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(10px + max(env(safe-area-inset-bottom), var(--myapp-safe-bottom, 0px)));
  z-index: 950;
  height: 62px;
  box-sizing: border-box;
  padding: 4px;
  display: flex;
  border-radius: 31px;
  background: var(--myapp-glass);
  border: 1px solid var(--myapp-glass-border);
  box-shadow: var(--myapp-glass-shadow);
  -webkit-backdrop-filter: var(--myapp-glass-blur);
  backdrop-filter: var(--myapp-glass-blur);
}
.myapp-tabbar button {
  -webkit-appearance: none;
  appearance: none;
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 27px;
  background: transparent;
  color: var(--myapp-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  transition: background-color 0.2s, transform 0.15s;
}
.myapp-tabbar button svg { width: 24px; height: 24px; flex: none; }
.myapp-tabbar button.active { background-color: var(--myapp-tab-on); color: var(--myapp-accent-text); font-weight: 700; }
.myapp-tabbar button:active { transform: scale(0.94); }
[data-myapp-tabbar] > ul.tcc-tab-head { display: none !important; }
:root.myapp-has-tabbar body { padding-bottom: calc(96px + var(--myapp-safe-bottom, 0px)) !important; }
/* 下のタブがある画面で、下に別のボタンの帯も出るときは、帯をタブの上に */
:root.myapp-has-tabbar body > .myapp-bottom-bar { bottom: calc(72px + var(--myapp-safe-bottom, 0px)); padding-bottom: 10px; }

/* ---- ダイアログ・お知らせ: ガラスのシート（すりガラス・大きな角・縁の光） ---- */
.tcc-modal, .tcc-msg-box, .tcc-popover {
  border-radius: 28px !important;
  background: var(--myapp-sheet) !important;
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  backdrop-filter: blur(30px) saturate(180%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28), inset 0 1px 0 var(--myapp-glass-border) !important;
}
.tcc-modal > .tcc-modal-content,
.tcc-msg-box .tcc-msg-box-content,
.tcc-modal .tcc-modal-body,
.tcc-msg-box .tcc-msg-box-body,
.tcc-msg-box .tcc-msg-box-footer { background: transparent !important; }
.tcc-modal-header, .tcc-msg-box-header, .tcc-popover-header {
  background: transparent !important;
  border-bottom: none !important;
}
.tcc-modal .tcc-modal-title, .tcc-msg-box .tcc-msg-box-title { font-weight: 600 !important; }
/* ダイアログの後ろの暗さは、アプリのシート（今月のプロジェクトなど）と同じ 28% に。
   アプリは、ダイアログが開いているあいだ、上のヘッダーも同じだけ暗くする（src/components/EzcraftWebView.tsx の DIM） */
.tcc-modal-back, .tcc-msg-box-back, .tcc-popover-back { background: rgba(0, 0, 0, 0.28) !important; }
/* 閉じる（×）は、丸いボタンに。ダイアログの中の部品（z-index の付いた見出しなど）が上に重なって押せなくならないよう、いちばん上に */
.tcc-modal .tcc-modal-quit { z-index: 20 !important; }
.tcc-modal .tcc-modal-quit {
  width: 36px !important;
  height: 36px !important;
  margin: 4px 8px 0 0 !important;
  border-radius: 18px !important;
  background: var(--myapp-segment) !important;
  color: var(--myapp-text) !important;
  font-size: 18px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.tcc-msg-box .tcc-msg-box-btn { border-radius: 999px !important; }
/* 確認のメッセージ（スマホでは EZCraft が「メッセージバー」で出す。勤怠の「削除確認」など）: 画面の幅いっぱいの灰色の帯ではなく、
   iOS の確認と同じ形にする: 幅の狭いガラスのカードを画面の真ん中に置き、題と文を真ん中に寄せ、印（？）は出さない。
   ボタンは横に2つ並べる（左がキャンセル、右が決める方）。削除の確認なら、決める方を赤に（JS の msgBars が data-myapp-danger を付ける） */
.tcc-msg-bar-back {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 16px var(--myapp-safe-bottom, 0px) !important;
  box-sizing: border-box !important;
  background: rgba(0, 0, 0, 0.28) !important;
}
.tcc-msg-bar {
  top: auto !important; left: auto !important; right: auto !important; bottom: auto !important;
  width: 100% !important;
  max-width: 300px !important;
  padding: 22px 18px 18px !important;
  box-sizing: border-box !important;
  border-radius: 32px !important;
  text-align: center !important;
  background: var(--myapp-sheet) !important;
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  backdrop-filter: blur(30px) saturate(180%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28), inset 0 1px 0 var(--myapp-glass-border) !important;
  color: var(--myapp-text) !important;
}
.tcc-msg-bar-text { left: auto !important; width: auto !important; text-align: center !important; }
.tcc-msg-bar-text > span {
  display: block !important;
  padding: 0 !important;
  font-size: 17px !important;
  font-weight: 600 !important;
  line-height: 1.35 !important;
  color: var(--myapp-text) !important;
}
.tcc-msg-bar-text > span > i { display: none !important; }
.tcc-msg-bar-text p {
  margin: 6px 0 18px !important;
  font-size: 15px !important;
  line-height: 1.5 !important;
  color: var(--myapp-text) !important;
  white-space: normal !important;
  word-break: normal !important;
  overflow-wrap: anywhere;
}
/* EZCraft は文の終わりに改行を付けるので、最後の改行は出さない（下に空いた行ができないように） */
.tcc-msg-bar-text p > br:last-child { display: none; }
.tcc-msg-bar-btns { display: flex !important; gap: 10px; }
.tcc-msg-bar .tcc-msg-bar-btn {
  float: none !important;
  flex: 1 1 0;
  min-width: 0;
  margin: 0 !important;
  height: 48px !important;
  padding: 0 8px !important;
  border: none !important;
  border-radius: 999px !important;
  font-size: 17px !important;
  font-weight: 600 !important;
  background: var(--myapp-segment) !important;
  color: var(--myapp-text) !important;
}
.tcc-msg-bar .tcc-msg-bar-btn[data-myapp-primary] { background: var(--myapp-accent) !important; color: #FFFFFF !important; }
.tcc-msg-bar[data-myapp-danger] .tcc-msg-bar-btn[data-myapp-primary] { background: var(--myapp-danger) !important; }
/* 検索して選ぶダイアログ: ほかのシートと同じ、下から出るシート（上につまみ。下は画面の端まで） */
.tcc-modal[id$="_mdl"] {
  left: 0 !important;
  top: 12px !important;
  width: 100% !important;
  height: calc(100% - 12px) !important;
  border-radius: 30px 30px 0 0 !important;
}
.tcc-modal[id$="_mdl"] > .tcc-modal-content { border-radius: 30px 30px 0 0 !important; }
.tcc-modal[id$="_mdl"] > .tcc-modal-content::before { content: ''; flex: none; display: block; width: 36px; height: 5px; margin: 6px auto 0; border-radius: 3px; background: var(--myapp-border); }
.tcc-modal[id$="_mdl"] .tcc-modal-header { height: 48px !important; padding: 0 8px 0 20px; }
.tcc-modal[id$="_mdl"] [id$="_mdl_grd"] .TccGridBodyScroll tr { border-bottom-color: var(--myapp-field-border) !important; }

/* ---- 選択欄の一覧: ガラスの小さなシート ---- */
body > .tcc-component.cmblist {
  border-radius: 18px !important;
  background: var(--myapp-sheet) !important;
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  backdrop-filter: blur(30px) saturate(180%);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22), inset 0 1px 0 var(--myapp-glass-border) !important;
}
body > .tcc-component.cmblist > .cmblist-item { border-radius: 10px; margin: 0 6px; }
/* 名前のない選択肢（空の行）は「なし」と書く（JS の emptyChoices） */
body > .tcc-component.cmblist > .cmblist-item[data-myapp-none]::before { content: 'なし'; color: var(--myapp-text2); }

/* 文字のあるボタンには、EZCraft のアイコンを出さない（JS の textButtons）。文字だけのボタンにそろえる */
.tcc-btn.myapp-text-btn > i.fa { display: none !important; }

/* Web の青い縁取り（押したあとのフォーカスの印）は出さない。ただし、キーボード（外付けのキーボードや、
   iOS の「フルキーボードアクセス」）で動かしているときの印（:focus-visible）は残す。入力欄は、ふちの色で選んでいるのが分かる */
*:focus:not(:focus-visible) { outline: none !important; }
input:focus, textarea:focus, select:focus { outline: none !important; }
* { -webkit-tap-highlight-color: transparent; }

/* ダイアログの中身の枠線・影（EZCraft のもの。茶色がかった線に見える）は出さない */
.tcc-modal > .tcc-modal-content { border: none !important; box-shadow: none !important; }

/* 検索欄は、どこでも同じ形: 灰色の面、左に虫めがね、枠なし（プロジェクトのシートの検索欄と同じ） */
.tcc-modal[id$="_mdl"] .tcc-modal-body > #txtSearch::before {
  content: ''; position: absolute; left: 12px; top: 50%; z-index: 2; width: 17px; height: 17px; margin-top: -8.5px; pointer-events: none;
  background: var(--myapp-text2);
  -webkit-mask: ${SEARCH_ICON} center / contain no-repeat;
  mask: ${SEARCH_ICON} center / contain no-repeat;
}
.tcc-modal[id$="_mdl"] .tcc-modal-body > #txtSearch input {
  padding-left: 38px !important; padding-right: 12px !important;
  border: none !important; border-radius: 12px !important; background: var(--myapp-segment) !important;
}
.tcc-modal[id$="_mdl"] .tcc-modal-body > #txtSearch div.icon-rt { display: none !important; }

/* 月・日付を選ぶシートの上の段: つまみ・題名・✕（JS の calendarHead） */
#TccYmPicker::before,
.tcc-component.datepicker::before { content: ''; display: block; width: 36px; height: 5px; margin: 0 auto 2px; border-radius: 3px; background: var(--myapp-border); }
.myapp-cal-head { display: flex; align-items: center; min-height: 44px; padding: 0 0 0 4px; font-size: 17px; font-weight: 600; color: var(--myapp-text); }
.myapp-cal-head .myapp-cal-close {
  flex: none; width: 36px; height: 36px; margin-left: auto; padding: 0; border: 0;
  border-radius: 18px; background: var(--myapp-segment); color: var(--myapp-text);
  font: inherit; font-size: 16px; font-weight: 600; line-height: 36px; text-align: center;
  position: relative;
}
/* 見た目は 36px のまま、押せる範囲は 44px に */
.myapp-cal-head .myapp-cal-close::after { content: ''; position: absolute; inset: -4px; }
`;
