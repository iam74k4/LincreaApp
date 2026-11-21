// EZCraft のお知らせ・エラーのダイアログ（.tcc-msg-box。Tcc.TccMsgBox.showMsgBox / showError）と、エラーのある入力欄を、スマホ向けにする。
// ページに入れるスクリプト（文字列）。ezcraftSkin.ts の buildSkinScript が入れ、applyConfig から msgBoxes() を呼ぶ。
//
// EZCraft の作り（/js/cmn/module/tcc/component/tccMsgBox.js。2026-11-22 に読んだ）:
//   .tcc-msg-box-back > .tcc-msg-box > .tcc-msg-box-content >
//     .tcc-msg-box-header（印 i・題 .tcc-msg-box-title・× .tcc-msg-box-quit）
//     .tcc-msg-box-body（印 .tcc-msg-box-icon・文 .tcc-msg-box-txt。改行のある文は <p> と <br>）
//     .tcc-msg-box-footer（ボタン .tcc-msg-box-btn。EZCraft は押されたボタンを文字で見分ける）
//   showError は、題を開いている画面の ID（「frmAttendanceDtl」など）にする。ダイアログは毎回作り直す。
// 勤怠実績登録の入力のエラー（2026-11-22 に、実際の画面で控えた）:
//   文は「入力項目にエラーがあります（マウスオーバーでエラーの詳細が表示されます）」。
//   エラーの欄（input）には、地の色 rgb(255, 240, 240) を直接書き、data-tooltip にエラーの中身を入れる。
//   中身は、マウスを重ねたときだけ出る（Tcc.TccToolTip。スマホでは見られない）。
//   data-tooltip は、エラーでない部品（ラベルの説明など）にも付くので、エラーかどうかは地の色で見分ける。
//
// ここでは:
//   - 吹き出し（#tccToolTip）は、ほかを触ったら消す（スマホにはマウスが離れることがない）
//   - 題が ID なら、文の1行目を題にする（ID は使う人には意味がない）
//   - 「マウスオーバーで…」は出さず、エラーの欄の中身をダイアログに並べる。エラーの欄には赤い枠（CSS の [data-myapp-error]）
//   - 色は CSS で決める（ダーク用の書き換え DARK_JS が、文やボタンに色を直接書かないように）。決めるボタンを目立たせる
export const MSG_BOX_JS = `
  /** EZCraft の画面が、エラーの欄に直接書く地の色 */
  var ERROR_BG = 'rgb(255, 240, 240)';
  /** 部品・画面の ID の形（showError の「 - Error at …」が付くこともある） */
  var ID_TITLE = /^[A-Za-z][A-Za-z0-9_]*(\\s*-\\s*Error at .*)?$/;
  /** パソコンのマウス向けの案内（スマホではできない） */
  var HOVER_HINT = /[（(]\\s*マウスオーバーで[^）)]*[）)]/;
  var BOX_CANCEL = /^(キャンセル|いいえ|閉じる|戻る)$/;

  // エラーのある入力欄にしるしを付け（赤い枠。CSS）、エラーの中身を重ならないように並べて返す
  function errorFields() {
    var list = [];
    document.querySelectorAll('[data-tooltip]').forEach(function (el) {
      var tip = (el.getAttribute('data-tooltip') || '').trim();
      var bad = !!tip && el.style.backgroundColor === ERROR_BG;
      if (el.hasAttribute('data-myapp-error') !== bad) el.toggleAttribute('data-myapp-error', bad);
      if (bad && list.indexOf(tip) < 0) list.push(tip);
    });
    return list;
  }

  // 文を行に分ける（<br> と <p> で改行。innerText は使わない: 隠れている間は改行が取れないことがある）
  function boxLines(el) {
    var out = [''];
    (function walk(node) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) out[out.length - 1] += c.nodeValue;
        else if (c.nodeName === 'BR') out.push('');
        else {
          if (c.nodeName === 'P' && out[out.length - 1].trim()) out.push('');
          walk(c);
          if (c.nodeName === 'P') out.push('');
        }
      }
    })(el);
    return out.map(function (s) { return s.replace(/[\\s\\u3000]+/g, ' ').trim(); }).filter(Boolean);
  }

  // EZCraft の説明の吹き出し（#tccToolTip。Tcc.TccToolTip。エラーの欄の中身など）は、マウスが部品から離れたときに消える作り。
  // スマホには「離れる」がないので、欄を押して出た吹き出しが、ほかを触っても・スクロールしても出たまま残る（2026-11-22）。
  // 吹き出しの外を触ったときに、EZCraft の消し方（Tcc.TccToolTip.hide）で消す
  // EZCraft は消すとき z-index を -100 にし、出すとき 10000 にする（jQuery の animate で opacity を変えるので、opacity は途中の値のことがある）
  function tooltipShown(tip) {
    return tip.style.zIndex !== '-100' && tip.style.opacity !== '0';
  }
  function hideTooltip(e) {
    var tip = document.getElementById('tccToolTip');
    if (!tip || !tooltipShown(tip)) return;
    if (e && e.target && e.target.closest && e.target.closest('#tccToolTip')) return;
    if (window.Tcc && window.Tcc.TccToolTip && window.Tcc.TccToolTip.hide) window.Tcc.TccToolTip.hide();
    else { tip.style.opacity = '0'; tip.style.zIndex = '-100'; }
  }
  // ほかを触ったとき。scroll では消さない（欄を押したときに iOS がその欄まで動かすスクロールで、いま押した欄の吹き出しまで消してしまう）
  // （吹き出しは指を離したあとのマウスの出来事で出るので、指を動かしているあいだに出ることはない。touchstart だけでよい）
  document.addEventListener('touchstart', hideTooltip, { capture: true, passive: true });
  // 知らせのボタン（OK・×など）を押した時刻。EZCraft は閉じたあと、前に入っていた欄へ戻す（timsSkin.ts の時刻の欄が使う）
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.tcc-msg-box-btn, .tcc-msg-box-quit')) window.__myappMsgBoxClosedAt = Date.now();
  }, true);

  function msgBoxes() {
    var errors = errorFields();
    document.querySelectorAll('.tcc-msg-box-back').forEach(function (back) {
      var box = back.querySelector('.tcc-msg-box');
      // EZCraft はダイアログを毎回作り直す。1つにつき、出たときに1回だけ題と文を読み、整え終わったら（'done'）もう触らない
      if (!box || box.__myappMsgBox === 'done') return;
      var st = box.__myappMsgBox;
      if (!st) {
        back.setAttribute('data-myapp-nodark', '');
        // ダーク用の書き換え（DARK_JS）が先に書いた色は外す（色は CSS で決める）
        back.querySelectorAll('[style]').forEach(function (el) {
          if (el === box) return;
          ['background-color', 'border-color', 'border-top-color', 'color'].forEach(function (prop) { el.style.removeProperty(prop); });
        });
        var title = box.querySelector('.tcc-msg-box-title');
        var txt0 = box.querySelector('.tcc-msg-box-txt');
        var lines = txt0 ? boxLines(txt0) : [];
        var hover = lines.some(function (l) { return HOVER_HINT.test(l); });
        lines = lines.map(function (l) { return l.replace(HOVER_HINT, '').trim(); }).filter(Boolean);
        var titleText = title ? (title.textContent || '').trim() : '';
        if (title && (!titleText || ID_TITLE.test(titleText))) {
          // 題が ID（または空）: 文の1行目を題にする。文が1行もなければ、題の段を出さない
          titleText = lines.length ? lines.shift() : '';
          title.textContent = titleText;
        }
        box.toggleAttribute('data-myapp-notitle', !titleText);
        // 決めるボタン（キャンセル・いいえでないもの）を目立たせる
        var buttons = Array.prototype.slice.call(box.querySelectorAll('.tcc-msg-box-btn'));
        var primary = buttons.filter(function (b) { return !BOX_CANCEL.test((b.textContent || '').trim()); }).pop();
        buttons.forEach(function (b) { b.toggleAttribute('data-myapp-primary', b === primary); });
        st = box.__myappMsgBox = { lines: lines, hover: hover, at: Date.now(), shown: -1 };
      }
      var txt = box.querySelector('.tcc-msg-box-txt');
      if (txt && st.shown !== errors.length) {
        st.shown = errors.length;
        txt.textContent = '';
        st.lines.forEach(function (l) {
          var p = document.createElement('p');
          p.textContent = l;
          txt.appendChild(p);
        });
        if (st.hover) {
          var lead = document.createElement('p');
          // アプリが足した案内（ページを見ていないときの保存の失敗の知らせには使わない。bridgeJs.ts の errorText）
          lead.className = 'myapp-msg-lead';
          lead.textContent = errors.length ? '赤い枠の欄を直してください。' : '入力した内容を確かめてください。';
          txt.appendChild(lead);
          if (errors.length) {
            var ul = document.createElement('ul');
            ul.className = 'myapp-msg-errors';
            errors.forEach(function (e) {
              var li = document.createElement('li');
              li.textContent = e;
              ul.appendChild(li);
            });
            txt.appendChild(ul);
          }
        }
        box.toggleAttribute('data-myapp-notext', !txt.firstChild);
      }
      // エラーの欄の印（赤い地）は、EZCraft がダイアログより少しあとに付けることがある。マウスで見る案内のダイアログは、
      // エラーの欄が見つかるか、3 秒たつまで、整え直すたびに一覧を出し直す
      if (!st.hover || errors.length || Date.now() - st.at > 3000) box.__myappMsgBox = 'done';
      // 待っているあいだは、自分で 0.3 秒ごとに見直す（EZCraft が欄に印を付けるのは style だけの変化で、整え直しが起きない）
      else if (!st.timer) st.timer = setTimeout(function () { st.timer = null; msgBoxes(); }, 300);
    });
  }
`;

/** エラーのダイアログとエラーの欄の見た目。確認のメッセージ（.tcc-msg-bar。ezcraftSkin.ts の GLASS_CSS）と同じ、真ん中の狭いガラスのカード */
export const MSG_BOX_CSS = `
.tcc-msg-box-back {
  position: fixed !important;
  inset: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 16px 16px calc(16px + var(--myapp-safe-bottom, 0px)) !important;
  box-sizing: border-box !important;
  background: rgba(0, 0, 0, 0.28) !important;
}
/* EZCraft はカードの位置（top・left）を、整える前の大きさで真ん中に決めて書き込むので、使わない（真ん中は上の flex で） */
.tcc-msg-box {
  position: relative !important;
  top: auto !important; left: auto !important; right: auto !important; bottom: auto !important;
  width: 100% !important;
  max-width: 300px !important;
  max-height: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  border-radius: 32px !important;
  text-align: center !important;
  color: var(--myapp-text) !important;
}
.tcc-msg-box .tcc-msg-box-content {
  display: flex !important;
  flex-direction: column !important;
  max-height: calc(100vh - 32px - var(--myapp-safe-bottom, 0px)) !important;
  padding: 22px 18px 18px !important;
  box-sizing: border-box !important;
}
.tcc-msg-box .tcc-msg-box-header {
  display: block !important;
  height: auto !important;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  white-space: normal !important;
  overflow: visible !important;
  font-size: 0 !important; /* 題の前の印のあとの空白（&nbsp;）を出さない */
}
.tcc-msg-box .tcc-msg-box-header > i,
.tcc-msg-box .tcc-msg-box-quit,
.tcc-msg-box .tcc-msg-box-icon { display: none !important; }
.tcc-msg-box .tcc-msg-box-title {
  display: block !important;
  font-size: 17px !important;
  font-weight: 600 !important;
  line-height: 1.35 !important;
  color: var(--myapp-text) !important;
  white-space: normal !important;
  overflow-wrap: anywhere;
}
.tcc-msg-box[data-myapp-notitle] .tcc-msg-box-header { display: none !important; }
.tcc-msg-box .tcc-msg-box-body {
  display: block !important;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto !important;
  padding: 0 !important;
  background: transparent !important;
}
.tcc-msg-box[data-myapp-notext] .tcc-msg-box-body { display: none !important; }
.tcc-msg-box .tcc-msg-box-txt {
  width: auto !important;
  max-width: 100% !important;
  margin: 6px 0 0 !important;
  padding: 0 !important;
  font-size: 15px !important;
  line-height: 1.5 !important;
  color: var(--myapp-text) !important;
  white-space: normal !important;
  overflow-wrap: anywhere;
}
.tcc-msg-box .tcc-msg-box-txt p { margin: 0 !important; color: var(--myapp-text) !important; }
.tcc-msg-box .tcc-msg-box-txt .myapp-msg-errors {
  margin: 10px 0 0 !important;
  padding: 10px 12px !important;
  list-style: none !important;
  text-align: left !important;
  border-radius: 14px;
  background: var(--myapp-segment) !important;
}
.tcc-msg-box .tcc-msg-box-txt .myapp-msg-errors li {
  position: relative;
  padding-left: 14px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--myapp-text) !important;
}
.tcc-msg-box .tcc-msg-box-txt .myapp-msg-errors li + li { margin-top: 4px; }
.tcc-msg-box .tcc-msg-box-txt .myapp-msg-errors li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.6em;
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: var(--myapp-danger);
}
.tcc-msg-box .tcc-msg-box-footer {
  display: flex !important;
  gap: 10px;
  margin-top: 18px !important;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
}
.tcc-msg-box .tcc-msg-box-btn {
  flex: 1 1 0;
  min-width: 0 !important;
  height: 48px !important;
  margin: 0 !important;
  padding: 0 8px !important;
  border: none !important;
  border-radius: 999px !important;
  font-size: 17px !important;
  font-weight: 600 !important;
  background: var(--myapp-segment) !important;
  color: var(--myapp-text) !important;
}
.tcc-msg-box .tcc-msg-box-btn[data-myapp-primary] { background: var(--myapp-accent) !important; color: #FFFFFF !important; }

/* EZCraft の説明の吹き出し（#tccToolTip）: 明るい灰色のふちと、斜めの細い線の矢印をやめ、アプリの暗い吹き出しに。
   字は単語の途中で切らない（EZCraft は break-all で「LINGAGE」を「LI / NGAGE」と折っていた。2026-11-22）。
   矢印の位置（幅の 28%）は、EZCraft が吹き出しを置く位置に合わせてあるので変えない */
#tccToolTip {
  background-color: #2C2C2E !important;
  border: none !important;
  border-radius: 12px !important;
  padding: 8px 12px !important;
  font-size: 13px !important;
  line-height: 1.45 !important;
  color: #FFFFFF !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
  word-break: normal !important;
  overflow-wrap: anywhere;
}
#tccToolTip.upper::before, #tccToolTip.lower::before, #tccToolTip.to-left::before, #tccToolTip.to-right::before { display: none !important; }
#tccToolTip.upper::after { border: 7px solid transparent !important; border-top: 8px solid #2C2C2E !important; border-bottom: none !important; bottom: -8px !important; left: calc(28% - 7px) !important; }
#tccToolTip.lower::after { border: 7px solid transparent !important; border-bottom: 8px solid #2C2C2E !important; border-top: none !important; top: -8px !important; left: calc(28% - 7px) !important; }
#tccToolTip.to-left::after { border: 7px solid transparent !important; border-right: 8px solid #2C2C2E !important; border-left: none !important; left: -8px !important; top: 8px !important; }
#tccToolTip.to-right::after { border: 7px solid transparent !important; border-left: 8px solid #2C2C2E !important; border-right: none !important; right: -8px !important; top: 8px !important; }

/* エラーのある入力欄（JS の errorFields がしるしを付ける）: 赤い枠。EZCraft が書く薄い赤の地は、アプリの欄の色に負けて見えないため */
.tcc-component input[data-myapp-error],
.tcc-component textarea[data-myapp-error] {
  box-shadow: inset 0 0 0 2px var(--myapp-danger) !important;
  border-color: var(--myapp-danger) !important;
}
`;
