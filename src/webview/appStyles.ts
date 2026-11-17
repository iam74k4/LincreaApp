// アプリごとの見た目の調整。キーはアプリケーション ID（L_Payslip など）。
//
// どのアプリも同じ見た目になるように、部品ごとに「役割」を決めるだけにしてある。
// 役割ごとの見た目は1か所（下の roleCss）で決まるので、アプリによって色や形がばらばらにならない。
//
//   primary  … その画面の主な操作（青く塗ったボタン）。それ以外のボタンは、灰色の面に青い文字
//   cards    … メニューのような大きなボタン（灰色の面に、見出し・説明・右の矢印）
//   sections … 小見出し（「お知らせ」など。色の帯はやめて、灰色の小さな太字）
//   notes    … 注意書き（灰色の小さな文字で、折り返す）
//   chips    … 区分などの小さな札
//   panels   … 数字などをまとめて見せる面（ラベルを、角の丸い灰色の面にする）
//   hidden   … 出さないもの（上のヘッダーと重複する見出しや「閉じる」、飾りの画像）
//
// 位置と大きさは layout に書く。EZCraft の画面は決まった幅（600px など）に部品を座標で置いて
// 作ってあるので、部品の ID ごとに、スマホの幅（402px）での位置を決め直す。
// 作り直したフォームの ID を mobileForms に書くと、その画面は縮めずにそのままの大きさで出す。
// 作り直していない画面（詳細のダイアログなど）は、共通のスタイルのうえで画面の幅に縮めて出す。
//
// データの項目は消さない。

import { cardGrid, fillButton, fillInput, fillLabel, fullWidth, mobileDialog, place, row, searchField, sheetDialog, text } from './layout';
import { TIMS_SKIN } from './timsSkin';

export type AppSkin = {
  mobileForms: string[];
  /** 条件付きのスマホ向けフォーム（フォーム ID → このセレクターに当てはまる部品があるときだけ、縮めずに出す） */
  mobileWhen?: Record<string, string>;
  /** 画面（フォーム ID）ごとに、上のヘッダーに出す名前。ないときはページの名前 */
  titles?: Record<string, string>;
  /** ページの中で動かす JavaScript。window.__myappAppUpdate を決めておくと、画面が変わるたびに呼ばれる */
  script?: string;
  /**
   * 画面の下に固定するボタン（フォーム ID → ボタンの部品 ID。左から順に）。見えているうちの最後が主なボタン（青）。
   * ダイアログのフォームなら、ダイアログの下に固定する
   */
  bottomBars?: Record<string, string[]>;
  /** 消す・取り消すボタン（文字を赤く） */
  danger?: string[];
  /** 時刻など、数字だけを入れる入力欄（部品 ID）。数字のキーボードを出す */
  numeric?: string[];
  /** 行を押したら決まるダイアログ（ダイアログのフォーム ID と、押す OK ボタンの部品 ID）。OK・Cancel は隠す */
  pickers?: { dialog: string; ok: string }[];
  /** 打つたびに検索する欄（入力欄の部品 ID と、押す検索ボタンの部品 ID）。検索ボタンは隠す */
  liveSearch?: { input: string; button: string }[];
  /** 行を押したら開く一覧（表の部品 ID と、押すボタンの部品 ID）。ボタンは隠す */
  rowOpens?: { grid: string; button: string }[];
  /** 中身がないときに、一覧の真ん中に出す文 */
  emptyGrids?: Record<string, string>;
  /**
   * 下のタブ（タブの部品 ID → タブごとの短い名前とアイコン）。横に並んだ文字のタブの代わりに、画面の下にガラスのタブを出す。
   * match は元のタブの文字（同じものを先に、なければ含むもの）。icon は 24×24 の線の SVG の path
   */
  tabBars?: Record<string, { match: string; label: string; icon: string }[]>;
  /** 部品の文字の置き換え（部品 ID → 新しい文字）。データではない、見出しやボタンの文字だけに使う */
  relabel?: Record<string, string>;
  /** 入力欄が空のときに薄く出す文字（部品 ID → 文字） */
  placeholders?: Record<string, string>;
  layout: string;
  primary?: string[];
  cards?: { button: string; subtitle?: string }[];
  sections?: string[];
  notes?: string[];
  chips?: string[];
  panels?: string[];
  hidden?: string[];
};

/** 役割ごとの見た目（どのアプリでも同じ） */
export function roleCss(skin: AppSkin): string {
  const primary = (skin.primary ?? [])
    .map(
      (id) => `
#${id} .tcc-btn {
  background: var(--myapp-tint) !important;
  color: #FFFFFF !important;
  border: 1px solid rgba(255, 255, 255, 0.35) !important;
  box-shadow: var(--myapp-tint-shadow) !important;
}
#${id} .tcc-btn i { color: #FFFFFF !important; }`,
    )
    .join('');

  const cards = (skin.cards ?? [])
    .map(
      ({ button, subtitle }) => `
#${button} .tcc-btn {
  position: relative;
  justify-content: flex-start !important;
  align-items: flex-start !important;
  text-align: left !important;
  box-sizing: border-box !important;
  padding: ${subtitle ? '14px' : '0'} 40px 0 16px !important;
  ${subtitle ? '' : 'align-items: center !important;'}
  font-size: 17px !important;
  color: var(--myapp-text) !important;
  background-color: var(--myapp-fill) !important;
  border-radius: 22px !important;
}
/* 印と見出しの行の高さをそろえる（印だけ低い行の高さだと、見出しより上にずれる）。印の幅もそろえて、見出しの始まりを同じ位置に */
#${button} .tcc-btn { line-height: 24px !important; }
#${button} .tcc-btn i {
  color: var(--myapp-accent) !important;
  flex: none;
  width: 20px;
  margin-right: 8px;
  font-size: 17px !important;
  line-height: 24px !important;
  text-align: center;
}
#${button} .tcc-btn::after {
  content: '›';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 26px;
  font-weight: 400;
  color: var(--myapp-text2);
}
/* 押したら、次の画面（ダイアログ）が出るまで、カードを沈め、右の › を読み込み中の印にする（JS が myapp-opening を付ける） */
#${button}.myapp-opening .tcc-btn { background-color: var(--myapp-pressed-bg) !important; }
#${button}.myapp-opening .tcc-btn::after {
  content: '';
  right: 18px;
  width: 16px;
  height: 16px;
  margin-top: -10px;
  transform: none;
  border-radius: 50%;
  border: 2px solid var(--myapp-border);
  border-top-color: var(--myapp-text2);
  animation: myapp-spin 0.8s linear infinite;
}
${
  subtitle
    ? `#${subtitle} { pointer-events: none; }
#${subtitle} .tcc-label { padding: 0 !important; width: 100% !important; }
#${subtitle} .tcc-label-text {
  color: var(--myapp-text2) !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  text-align: left !important;
}`
    : ''
}`,
    )
    .join('');

  const sections = (skin.sections ?? [])
    .map(
      (id) => `
#${id} .tcc-label { justify-content: flex-start; padding: 0 !important; border-left-width: 0 !important; }
/* 小見出しの字は、画面の左から 20pt（置き場所 16px + 4px）。マイアプリ・勤務表の小見出しと同じ位置 */
#${id} .tcc-label-text { padding-left: 4px !important; }
#${id} .tcc-label-text,
#${id} i {
  color: var(--myapp-text2) !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  text-align: left !important;
}`,
    )
    .join('');

  const notes = (skin.notes ?? [])
    .map(
      (id) => `
#${id} .tcc-label { width: 100% !important; }
#${id} * {
  white-space: normal !important;
  word-break: break-all;
  text-align: left !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  color: var(--myapp-text2) !important;
}
/* 文の箱は、EZCraft が1行ぶんの高さに決めている。2行目が切れないように、文の長さに合わせる */
#${id} .tcc-label-text { height: auto !important; max-height: none !important; overflow: visible !important; text-overflow: clip !important; }`,
    )
    .join('');

  const chips = (skin.chips ?? [])
    .map(
      (selector) => `
${selector} { overflow: hidden !important; border-radius: 999px; }
${selector} .tcc-label,
${selector} .tcc-label-text { width: 100% !important; max-width: 100% !important; }
${selector} .tcc-label {
  background-color: var(--myapp-inset) !important;
  border-radius: 999px;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  padding: 0 !important;
}
${selector} .tcc-label-text {
  color: var(--myapp-text2) !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  text-align: center !important;
}`,
    )
    .join('');

  const panels = (skin.panels ?? [])
    .map(
      (id) => `
#${id} { display: block !important; box-sizing: border-box !important; min-width: 0 !important; }
#${id} .tcc-label {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  background-color: var(--myapp-fill) !important;
  border: none !important;
  border-radius: 22px;
}`,
    )
    .join('');

  const hidden = (skin.hidden ?? []).map((id) => `#${id}`).join(',\n');

  // 下に固定するボタン（.myapp-bottom-bar に移したもの。EZCraft の座標の指定より強く書く）
  const bar = Object.values(skin.bottomBars ?? {})
    .flat()
    .map(
      (id) => `
.myapp-bottom-bar > #${id} {
  position: relative !important;
  left: auto !important;
  right: auto !important; /* 右から置いていたボタン（right: 20px など）が、帯の中でずれないように */
  top: auto !important;
  width: auto !important;
  height: 50px !important;
  flex: 1 1 0 !important;
  min-width: 0 !important;
}
.myapp-bottom-bar > #${id}[style*="visibility: hidden"] { display: none !important; }`,
    )
    .join('');
  const danger = (skin.danger ?? []).map((id) => `#${id} .tcc-btn, #${id} .tcc-btn i { color: var(--myapp-danger) !important; }`).join('\n');
  // 行を押したら決まるダイアログの OK・Cancel、打つたびに検索する欄の検索ボタン、行を押したら開く一覧のボタンは出さない
  const autoHidden = [
    ...(skin.pickers ?? []).flatMap(({ dialog, ok }) => [`#${ok}`, `#${dialog}_btnCancel`]),
    ...(skin.liveSearch ?? []).map(({ button }) => `#${button}`),
    ...(skin.rowOpens ?? []).map(({ button }) => `#${button}`),
  ];

  return [
    skin.layout,
    primary,
    cards,
    sections,
    notes,
    chips,
    panels,
    hidden ? `${hidden} { display: none !important; }` : '',
    bar,
    danger,
    autoHidden.length ? `${autoHidden.join(',\n')} { display: none !important; }` : '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 健診の予約（MC_reserv_Input）: 「予約登録」で出るダイアログ。画面いっぱいにして、見出しを左・入力欄を右に縦に並べる。
// 上のボタン: 新しい予約では「予約登録」を幅いっぱいに。予約があるときは「予約取消」「予約更新」を左右に
// （EZCraft が場面に合わせて出し分ける。「閉じる」は上の × と同じなので出さない）
// ---------------------------------------------------------------------------
const R = (id: string) => `MC_reserv_Input_${id}`;
/** 健診の2つのダイアログの欄: ほかの画面の入力欄と同じ高さ（40px）と、見出しの文字（15px）にそろえる。1行は 48px おき */
const HEALTH_FIELD = 40;
const HEALTH_PITCH = 48;
/** 左に見出し（88px）、右に入力欄 */
function reserveRow(label: string, field: string, top: number, width = 'calc(100% - 120px)'): string {
  return `${place(R(label), '16px', top, '88px', HEALTH_FIELD)}
${text(R(label), 15, { muted: true })}
${place(R(field), '104px', top, width, HEALTH_FIELD)}
${fillInput(R(field))}`;
}
/** 上から n 行目（0 から）の欄の位置 */
const reserveTop = (n: number) => 52 + n * HEALTH_PITCH;
const HEALTH_RESERVE_CSS = `
${sheetDialog('MC_reserv_Input', [{ id: 'R1', height: 612 }], { scroll: true })}
${place(R('lbltytle1'), '16px', 12, 'calc(100% - 32px)', 28)}
${text(R('lbltytle1'), 17, { bold: true })}
#${R('btnClose')} { display: none !important; }
${reserveRow('lbl_reserv_input_datetime', 'reserv_input_date', reserveTop(0), '150px')}
${reserveRow('lbl17', 'checkup_emp_nm_reserv', reserveTop(1))}
${reserveRow('lbl15', 'cmbHonbu', reserveTop(2))}
${place(R('cmbTeam'), '104px', reserveTop(3), 'calc(100% - 120px)', HEALTH_FIELD)}
${fillInput(R('cmbTeam'))}
${reserveRow('lbl16', 'cmbMember', reserveTop(4))}
${reserveRow('checkup_course_label', 'checkup_course_reserv', reserveTop(5))}
${reserveRow('checkup_due_date_label', 'checkup_due_date', reserveTop(6), '150px')}
${place(R('agency_type_reserv_label'), '16px', 388, 'calc(100% - 32px)', 24)}
${text(R('agency_type_reserv_label'), 15, { muted: true })}
${place(R('rdo1'), '16px', 414, 'calc(100% - 32px)', 108)}
${[1, 2, 3].map((n) => `#${R(`rdo1_${n}`)} { left: 8px !important; top: ${4 + (n - 1) * 34}px !important; width: calc(100% - 16px) !important; }`).join('\n')}
${place(R('agency_name_reserv_label'), '16px', 532, 'calc(100% - 32px)', 24)}
${text(R('agency_name_reserv_label'), 15, { muted: true })}
${place(R('agency_name_reserv'), '16px', 558, 'calc(100% - 32px)', HEALTH_FIELD)}
${fillInput(R('agency_name_reserv'))}
`;

// ---------------------------------------------------------------------------
// 健診の受診登録（MC_result_Input_1。本人）: 「受診登録」で出るダイアログ。予約の情報（読むだけ）→ 受診の情報（入力）
// ---------------------------------------------------------------------------
const H = (id: string) => `MC_result_Input_1_${id}`;
function resultRow(label: string, field: string, top: number, width = 'calc(100% - 120px)'): string {
  return `${place(H(label), '16px', top, '88px', HEALTH_FIELD)}
${text(H(label), 15, { muted: true })}
${place(H(field), '104px', top, width, HEALTH_FIELD)}
${fillInput(H(field))}`;
}
/** 見出しを上に、その下に幅いっぱいの部品 */
function resultBelow(label: string, field: string, top: number, height = HEALTH_FIELD): string {
  return `${place(H(label), '16px', top, 'calc(100% - 32px)', 22)}
${text(H(label), 15, { muted: true })}
${place(H(field), '16px', top + 24, 'calc(100% - 32px)', height)}
${fillInput(H(field))}`;
}
const resultTop = (n: number) => 76 + n * HEALTH_PITCH;
const HEALTH_RESULT_CSS = `
${sheetDialog('MC_result_Input_1', [{ id: 'R1', height: 1012 }], { scroll: true })}
${place(H('lbltytle1'), '16px', 12, 'calc(100% - 32px)', 28)}
${text(H('lbltytle1'), 17, { bold: true })}
/* 閉じるは上の × と同じ。後ろの飾りの枠と、2回目の同じ注意書き（lbl22）は出さない */
#${H('btnClose')}, #${H('lbl23')}, #${H('lbl26')}, #${H('lbl22')} { display: none !important; }

/* 予約の情報（読むだけ） */
${place(H('lbl27'), '16px', 48, 'calc(100% - 32px)', 24)}
${resultRow('lbl_reserv_input_datetime', 'result_input_date', resultTop(0), '150px')}
${resultRow('lbl17', 'checkup_emp_nm', resultTop(1))}
${resultRow('lbl15', 'cmbHonbu', resultTop(2))}
${place(H('cmbTeam'), '104px', resultTop(3), 'calc(100% - 120px)', HEALTH_FIELD)}
${fillInput(H('cmbTeam'))}
${resultRow('lbl16', 'cmbMember', resultTop(4))}
${resultRow('checkup_course_label', 'checkup_course_reserv', resultTop(5))}
${resultRow('lbl18', 'checkup_due_date', resultTop(6), '150px')}
${resultBelow('lbl21', 'agency_name_reserv', 412)}
${row(H('lbl25'), 488, 36)}
${row(H('lbl28'), 524, 60)}

/* 受診の情報（入力） */
${place(H('lbl36'), '16px', 592, 'calc(100% - 32px)', 24)}
${resultRow('checkup_date_label', 'checkup_date', 620, '150px')}
${place(H('agency_type_reserv_label'), '16px', 672, 'calc(100% - 32px)', 22)}
${text(H('agency_type_reserv_label'), 15, { muted: true })}
${place(H('rdo11'), '16px', 696, 'calc(100% - 32px)', 108)}
${[1, 2, 3].map((n) => `#${H(`rdo11_${n}`)} { left: 8px !important; top: ${4 + (n - 1) * 34}px !important; width: calc(100% - 16px) !important; }`).join('\n')}
${resultBelow('agency_name_reserv_label', 'agency_name', 816)}
/* ふだんは出ない部品（場面によって EZCraft が出す）。出たときに重ならないよう、いちばん下に並べる */
${row(H('lbl24'), 888, 40)}
${place(H('lbl14'), '16px', 932, '88px', HEALTH_FIELD)}
${place(H('rdo13'), '104px', 932, 'calc(100% - 120px)', HEALTH_FIELD)}
${place(H('lbl13'), '16px', 972, '88px', HEALTH_FIELD)}
${place(H('rdo12'), '104px', 972, 'calc(100% - 120px)', HEALTH_FIELD)}
`;

// ---------------------------------------------------------------------------
// アプリごとの設定
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Walk the Talk の「歩数入力」（週ごとのダイアログ。weeklyStepCount_id_2026Walk）に、iPhone のヘルスケアの歩数を入れる。
//   - 開発ビルドで、ヘルスケアが使えるときだけ（アプリが、ページが動き出す前に window.__myappHealth を決める。src/webview/bridge.ts）
//   - ダイアログが開いて、登録してある歩数を読み終わってから、今日までの日について、アプリにその日の歩数を聞く（bridge の steps）
//   - ヘルスケアの歩数が、欄の数より多い日だけ入れる（手で多めに入れた日や、まだ歩数のない日はそのまま）
//   - 入れるのは人が打ったのと同じやり方で（EZCraft が「入力が変わった」印を付け、合計も出し直す）。「保存」は、人が押す
const WEEKLY = 'weeklyStepCount_id_2026Walk';
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const HEALTH_STEPS_JS = `
  var healthAsks = {};
  var healthTimer = null;
  // アプリからの返事（stepsReplyJs）
  window.__myappStepsReply = function (id, steps) {
    var done = healthAsks[id];
    delete healthAsks[id];
    if (done) done(steps);
  };
  function askSteps(day, done) {
    var id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    healthAsks[id] = done;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'steps', id: id, day: day })); }
    catch (e) { delete healthAsks[id]; done(null); }
  }
  function healthText(id) {
    var el = document.querySelector('#' + id + ' .tcc-label-text');
    return el ? (el.textContent || '').trim() : '';
  }
  // 「11/17」→ その日（年は、今日にいちばん近い年。年をまたぐ週のため）
  function healthDate(label) {
    var m = /(\\d{1,2})\\/(\\d{1,2})/.exec(label);
    if (!m) return null;
    var now = new Date();
    var best = null;
    [-1, 0, 1].forEach(function (k) {
      var d = new Date(now.getFullYear() + k, +m[1] - 1, +m[2]);
      if (!best || Math.abs(d - now) < Math.abs(best - now)) best = d;
    });
    return best;
  }
  function isoDay(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  // EZCraft の入力欄に、人が打ったのと同じように値を入れる（入れて、欄を離れたことにする）
  function healthType(input, value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
  }
  function healthNote(text) {
    var old = document.querySelector('body > .myapp-health-note');
    if (old) old.remove();
    var note = document.createElement('div');
    note.className = 'myapp-health-note';
    note.setAttribute('role', 'status');
    note.setAttribute('data-myapp-nodark', '');
    note.textContent = text;
    document.body.appendChild(note);
    setTimeout(function () { note.classList.add('myapp-hide'); }, 4500);
    setTimeout(function () { note.remove(); }, 5000);
  }
  function healthSteps() {
    if (!window.__myappHealth) return;
    var form = document.getElementById('${WEEKLY}');
    if (!form) return;
    var week = healthText('${WEEKLY}_lbl_date_monday');
    if (!week || form.__myappHealthWeek === week) return;
    // 開いたばかりのあいだと、登録してある歩数を読んでいるあいだは待つ（読み終わる前に入れると、上書きされる）
    if (form.__myappHealthSeen !== week) { form.__myappHealthSeen = week; form.__myappHealthAt = Date.now(); }
    var busy = window.__myappXhr && (window.__myappXhr() > 0 || Date.now() - (window.__myappXhrAt || 0) < 300);
    if (busy || Date.now() - form.__myappHealthAt < 700) {
      clearTimeout(healthTimer);
      healthTimer = setTimeout(healthSteps, 300);
      return;
    }
    form.__myappHealthWeek = week;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var waiting = 0;
    var filled = [];
    var found = false;
    ${JSON.stringify(WEEK_DAYS)}.forEach(function (day) {
      var label = healthText('${WEEKLY}_lbl_date_' + day);
      var date = healthDate(label);
      var input = document.querySelector('#${WEEKLY}_num_steps_' + day + ' input');
      if (!date || !input || date > today) return;
      waiting++;
      askSteps(isoDay(date), function (steps) {
        waiting--;
        if (steps > 0) found = true;
        var current = parseInt((input.value || '').replace(/[^0-9]/g, ''), 10) || 0;
        if (steps > current && document.activeElement !== input && input.isConnected) {
          healthType(input, String(steps));
          filled.push(label);
        }
        if (waiting > 0) return;
        if (filled.length) healthNote('ヘルスケアの歩数を入れました（' + filled.join('・') + '）。「保存」で登録します');
        else if (!found) healthNote('ヘルスケアに、この週の歩数がありませんでした');
      });
    });
  }
`;

/** EZCraft の進み具合の棒（ProgressBar）を、細い角丸の棒にする（% の字は出さない） */
function progressBar(id: string): string {
  return `
#${id} .progress {
  height: 8px !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 4px !important;
  background: var(--myapp-inset) !important;
  box-shadow: none !important;
  overflow: hidden !important;
}
#${id} .progress-bar { height: 100% !important; background-color: var(--myapp-accent) !important; border-radius: 4px !important; box-shadow: none !important; }
#${id} :is(.progressbar-back-text, .progressbar-front-text) { display: none !important; }`;
}

// Walk the Talk の「歩数入力」（週ごとのダイアログ。weeklyStepCount_id_2026Walk）を、ほかと同じ下から出るシートに:
//   上 … 今週の合計（大きな数字）と今週の目標、進み具合の棒
//   中 … 月〜日の7行（曜日・日付・入力欄・歩）。今日の行は差し色
//   下 … 「閉じる」と「保存」（保存は青）を、シートの下の帯に（bottomBars）
const WK = (id: string) => `${WEEKLY}_${id}`;
const WEEK_ROW = 52;
/** 曜日ごとの「歩」のラベル（EZCraft の部品の名前は、曜日の順になっていない） */
const WEEK_UNITS: Record<string, string> = {
  monday: 'lbl8',
  tuesday: 'lbl9',
  wednesday: 'lbl14',
  thursday: 'lbl13',
  friday: 'lbl12',
  saturday: 'lbl11',
  sunday: 'lbl10',
};
const WEEKLY_CSS = `
${sheetDialog(WEEKLY, [{ id: 'R1', height: 104 }, { id: 'R2', height: 16 + 7 * WEEK_ROW }, { id: 'R3', height: 0 }], { scroll: true })}
#${WK('R3')} { display: none !important; }
#${WEEKLY} :is(.tcc-tile, .tcc-panel, .tcc-panel-body) { background: transparent !important; }
#${WEEKLY} .tcc-component.lbl .tcc-label { padding-left: 0 !important; padding-right: 0 !important; border-left-width: 0 !important; background: transparent !important; }
#${WEEKLY} .tcc-component.lbl .tcc-label-text { padding-left: 0 !important; padding-right: 0 !important; }
/* 上: 今週の合計（左）と今週の目標（右）。右の列は左の列に重ねて置く */
#${WK('R1')} { position: relative !important; }
#${WK('R1')} .tcc-tile.col { float: none !important; }
#${WK('R1_C1')} { width: 100% !important; }
#${WK('R1_C2')} { position: absolute !important; top: 0 !important; right: 0 !important; left: auto !important; width: 50% !important; height: 100% !important; }
#${WK('R1_C2')} :is(.tcc-panel, .tcc-panel-body) { width: 100% !important; height: 100% !important; }
${place(WK('lbl22'), '20px', 6, 'calc(100% - 40px)', 20)}
${text(WK('lbl22'), 13, { muted: true })}
${place(WK('lbl_sum_steps'), '20px', 28, 'calc(100% - 80px)', 36)}
#${WK('lbl_sum_steps')} { right: auto !important; }
${text(WK('lbl_sum_steps'), 26, { bold: true })}
#${WK('lbl_sum_steps')} .tcc-label-text { font-variant-numeric: tabular-nums; }
${place(WK('lbl24'), '90px', 38, '20px', 20)}
${text(WK('lbl24'), 13, { muted: true })}
#${WK('lbl25')} { left: auto !important; right: 20px !important; top: 6px !important; width: calc(100% - 20px) !important; height: 20px !important; }
${text(WK('lbl25'), 13, { muted: true, align: 'right' })}
#${WK('lbl_step_goal')} { left: auto !important; right: 38px !important; top: 32px !important; width: calc(100% - 58px) !important; height: 28px !important; }
${text(WK('lbl_step_goal'), 17, { bold: true, align: 'right' })}
#${WK('lbl27')} { left: auto !important; right: 20px !important; top: 36px !important; width: 16px !important; height: 20px !important; }
${text(WK('lbl27'), 13, { muted: true, align: 'right' })}
${place(WK('pbr_steps'), '20px', 78, 'calc(100% - 40px)', 8)}
${progressBar(WK('pbr_steps'))}
/* 中: 月〜日（上に区切りの線） */
#${WK('R2')} { position: relative !important; }
#${WK('R2')}::before { content: ''; position: absolute; left: 20px; right: 20px; top: 0; height: 1px; background: var(--myapp-border); z-index: 1; }
${WEEK_DAYS.map((day, i) => {
  const top = 8 + i * WEEK_ROW;
  const unit = WEEK_UNITS[day];
  return `${place(WK(`lbl_${day}`), '20px', top, '28px', 40)}
${text(WK(`lbl_${day}`), 17, { bold: true })}
${place(WK(`lbl_date_${day}`), '50px', top, '80px', 40)}
${text(WK(`lbl_date_${day}`), 15, { muted: true })}
#${WK(`num_steps_${day}`)} { left: auto !important; right: 44px !important; top: ${top}px !important; width: 150px !important; height: 40px !important; }
${fillInput(WK(`num_steps_${day}`))}
#${WK(unit)} { left: auto !important; right: 20px !important; top: ${top}px !important; width: 16px !important; height: 40px !important; }
${text(WK(unit), 15, { muted: true, align: 'right' })}`;
}).join('\n')}
/* 入力欄は、シートの地と見分けがつく面。ライトは白、ダークは少し明るい灰色（シートの地は半透明の灰色） */
#${WEEKLY} [id^="${WK('num_steps_')}"] input {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  background-color: var(--myapp-field) !important;
  border-color: transparent !important;
  border-radius: 12px !important;
}
[data-myapp-theme="dark"] #${WEEKLY} [id^="${WK('num_steps_')}"] input { background-color: var(--myapp-inset) !important; }
/* 今日の行は、曜日と日付を差し色に */
#${WEEKLY} [data-myapp-today] .tcc-label-text { color: var(--myapp-accent) !important; font-weight: 700 !important; }
`;

// 歩数入力: 開いたときに EZCraft が月曜の欄を選んでしまう（つまみが出て、ヘルスケアの歩数も入らない）ので外す。今日の行に印
const WEEKLY_JS = `
  function weeklySheet() {
    var form = document.getElementById('${WEEKLY}');
    if (!form) return;
    if (!form.__myappUnfocused) {
      form.__myappUnfocused = true;
      var unfocus = function () {
        var a = document.activeElement;
        if (a && a !== document.body && form.contains(a) && a.blur) a.blur();
      };
      setTimeout(unfocus, 0);
      setTimeout(unfocus, 400);
    }
    var now = new Date();
    var key = (now.getMonth() + 1) + '/' + now.getDate();
    ${JSON.stringify(WEEK_DAYS)}.forEach(function (day) {
      var date = document.getElementById('${WEEKLY}_lbl_date_' + day);
      var name = document.getElementById('${WEEKLY}_lbl_' + day);
      if (!date) return;
      var m = /(\\d{1,2})\\/(\\d{1,2})/.exec(date.textContent || '');
      var on = !!m && (+m[1]) + '/' + (+m[2]) === key;
      [date, name].forEach(function (el) { if (el && el.hasAttribute('data-myapp-today') !== on) el.toggleAttribute('data-myapp-today', on); });
    });
  }
`;

// Walk the Talk の「歩数の記録」（今日の歩数を登録する で開く。stepCount_id_2026Walk）。パソコン向けのページを、2枚のカードと1つのボタンに:
//   1枚目 … 今週の合計（大きな数字）と目標・進み具合の棒、その下に「1日の平均」「これまでの合計」の2つ並び
//   2枚目 … 4週ぶんのカレンダー（曜日・日付・その日の歩数）。日付を押すと、その週の歩数入力（weeklyStepCount）が開く
//   いちばん下 … 「目標を設定する」（灰色のカプセル）
// 大きな題名・閉じる（左上の ‹ で戻る）・飾りの印と線・ロゴは出さない（hidden）。
// 日付のボタンは、部品の名前が日付で変わる（btn_date1117 など）ので、元の並び（行・列）をスクリプトが印にして、それで置く（STEP_CAL_JS）
const SC = (id: string) => `stepCount_id_2026Walk_${id}`;
const CAL_TOP = 44; // 曜日の下から、日付のマス
const CAL_CELL = 60; // マスの高さ
const CAL_PITCH = 68; // 1週の段の間隔
const CAL_HEIGHT = CAL_TOP + 3 * CAL_PITCH + CAL_CELL + 52; // 4週 + 下の説明
/** カレンダーの列（0〜6）の左の位置と幅（左右 16px の余白、列のあいだ 6px） */
const calLeft = (col: number) => `calc(16px + ${col} * ((100% - 68px) / 7 + 6px))`;
const CAL_WIDTH = 'calc((100% - 68px) / 7)';
const STEP_CAL_CSS = `
${fullWidth('stepCount_id_2026Walk')}
#stepCount_id_2026Walk { height: auto !important; display: flex !important; flex-direction: column !important; padding-bottom: 24px !important; }
#stepCount_id_2026Walk .tcc-tile.col { float: none !important; }
#stepCount_id_2026Walk :is(.tcc-tile, .tcc-panel, .tcc-panel-body) { background: transparent !important; }
/* カードの中の字は、カードの端から 16px。EZCraft の字の左右の余白と縁の線はなくす */
#stepCount_id_2026Walk .tcc-component.lbl .tcc-label { padding-left: 0 !important; padding-right: 0 !important; border-left-width: 0 !important; background: transparent !important; }
#stepCount_id_2026Walk .tcc-component.lbl .tcc-label-text { padding-left: 0 !important; padding-right: 0 !important; }

/* 2枚のカード */
#stepCount_id_2026Walk > :is(#${SC('R3')}, #${SC('R4')}) {
  width: calc(100% - 32px) !important;
  max-width: calc(100% - 32px) !important;
  margin: 12px 16px 0 !important;
  border-radius: 22px !important;
  background-color: var(--myapp-fill) !important;
  overflow: hidden !important;
}

/* 1枚目: 今週の合計 */
#${SC('R3')} { height: 188px !important; display: block !important; }
:is(#${SC('R3_C1')}, #${SC('blank5')}, #${SC('blank5_body')}) { width: 100% !important; height: 112px !important; }
${place(SC('lbl26'), '16px', 16, 'calc(100% - 160px)', 20)}
${text(SC('lbl26'), 13, { muted: true })}
/* 目標 10,000 歩（右上） */
#${SC('lbl28')} { left: auto !important; right: 16px !important; top: 16px !important; width: 14px !important; height: 20px !important; }
${text(SC('lbl28'), 13, { muted: true, align: 'right' })}
#${SC('lbl_step_goal')} { left: auto !important; right: 33px !important; top: 16px !important; width: 64px !important; height: 20px !important; }
${text(SC('lbl_step_goal'), 13, { muted: true, align: 'right' })}
#${SC('lbl27')} { left: auto !important; right: 100px !important; top: 16px !important; width: 30px !important; height: 20px !important; }
${text(SC('lbl27'), 13, { muted: true, align: 'right' })}
/* 合計の数字と「歩」（「歩」は、数字のすぐ後ろにスクリプトが置く） */
${place(SC('lbl_sum_week_steps'), '16px', 40, 'calc(100% - 80px)', 40)}
#${SC('lbl_sum_week_steps')} { right: auto !important; }
${text(SC('lbl_sum_week_steps'), 30, { bold: true })}
#${SC('lbl_sum_week_steps')} .tcc-label-text { font-variant-numeric: tabular-nums; }
${place(SC('lbl18'), '96px', 52, '20px', 24)}
${text(SC('lbl18'), 15, { muted: true })}
/* 進み具合の棒（数字の % は出さない） */
${place(SC('pbr_steps'), '16px', 90, 'calc(100% - 32px)', 8)}
${progressBar(SC('pbr_steps'))}
/* 1日の平均・これまでの合計（2つ並び。上に区切りの線） */
#${SC('R3_C2')} { position: relative !important; width: 100% !important; height: 76px !important; display: flex !important; flex-direction: row !important; }
#${SC('R3_C2')}::before { content: ''; position: absolute; left: 16px; right: 16px; top: 0; height: 1px; background: var(--myapp-border); }
:is(#${SC('R3_C2_R1')}, #${SC('R3_C2_R2')}) { width: 50% !important; height: 76px !important; }
:is(#${SC('R3_C2_R1')}, #${SC('R3_C2_R2')}) :is(.tcc-tile, .tcc-panel, .tcc-panel-body) { width: 100% !important; height: 76px !important; }
${[
  ['lbl21', 'lbl_ave_all_steps', 'lbl24'],
  ['lbl17', 'lbl_sum_all_steps', 'lbl20'],
]
  .map(
    ([title, num, unit]) => `${place(SC(title), '16px', 14, 'calc(100% - 24px)', 18)}
${text(SC(title), 13, { muted: true })}
${place(SC(num), '16px', 34, 'calc(100% - 52px)', 28)}
#${SC(num)} { right: auto !important; }
${text(SC(num), 20, { bold: true })}
#${SC(num)} .tcc-label-text { font-variant-numeric: tabular-nums; }
${place(SC(unit), '80px', 40, '20px', 20)}
${text(SC(unit), 13, { muted: true })}`,
  )
  .join('\n')}

/* 2枚目: カレンダー */
#${SC('R4')}, #${SC('R4')} :is(.tcc-tile, .tcc-panel, .tcc-panel-body) { height: ${CAL_HEIGHT}px !important; }
${['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  .map((day, col) => `${place(SC(`lbl_${day}`), calLeft(col), 14, CAL_WIDTH, 20)}
${text(SC(`lbl_${day}`), 12, { muted: true, align: 'center' })}
#${SC(`lbl_${day}`)}, #${SC(`lbl_${day}`)} * { border: none !important; background: transparent !important; }`)
  .join('\n')}
/* 日付のマス（押すと、その週の歩数入力が開く）。日付は上、歩数は下（歩数のラベルは押せない飾り） */
#${SC('blank3_body')} > .tcc-component.btn[data-myapp-row] { height: ${CAL_CELL}px !important; }
${[0, 1, 2, 3].map((r) => `#${SC('blank3_body')} > .tcc-component.btn[data-myapp-row="${r}"] { top: ${CAL_TOP + r * CAL_PITCH}px !important; }`).join('\n')}
${[0, 1, 2, 3, 4, 5, 6].map((c) => `#${SC('blank3_body')} > .tcc-component.btn[data-myapp-col="${c}"] { left: ${calLeft(c)} !important; right: auto !important; width: ${CAL_WIDTH} !important; }`).join('\n')}
#${SC('blank3_body')} > .tcc-component.btn[data-myapp-row] :is(.tcc-btn-group, .tcc-btn) {
  width: 100% !important;
  height: 100% !important;
}
#${SC('blank3_body')} > .tcc-component.btn[data-myapp-row] .tcc-btn {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: center !important;
  padding: 10px 0 0 !important;
  border: none !important;
  border-radius: 14px !important;
  background: var(--myapp-inset) !important;
  box-shadow: none !important;
  color: var(--myapp-text) !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.2px;
  white-space: nowrap !important;
}
/* 月の初めと、いちばん初めのマスは「12/1」のように月も出すので、字を小さく */
#${SC('blank3_body')} > .tcc-component.btn[data-myapp-md] .tcc-btn { font-size: 13px !important; padding-top: 12px !important; }
/* 今日は差し色の輪、これからの日は薄く */
#${SC('blank3_body')} > .tcc-component.btn[data-myapp-today] .tcc-btn { box-shadow: inset 0 0 0 2px var(--myapp-accent) !important; color: var(--myapp-accent) !important; }
#${SC('blank3_body')} > .tcc-component.btn[data-myapp-future] .tcc-btn { color: var(--myapp-text2) !important; font-weight: 400 !important; }
${Array.from({ length: 28 }, (_, i) => `${place(SC(`lbl_daily_steps_${i}`), calLeft(i % 7), CAL_TOP + Math.floor(i / 7) * CAL_PITCH + 34, CAL_WIDTH, 18)}`).join('\n')}
/* 日付のボタンより上に出す（ボタンの上に重ねる。押したときはボタンに届く） */
#${SC('blank3_body')} > [id^="${SC('lbl_daily_steps_')}"] { pointer-events: none !important; z-index: 60 !important; }
#${SC('blank3_body')} > [id^="${SC('lbl_daily_steps_')}"] :is(.tcc-label, .tcc-label-text) {
  width: 100% !important;
  height: 100% !important;
  font-size: 11px !important;
  line-height: 18px !important;
  text-align: center !important;
  color: var(--myapp-text2) !important;
  font-variant-numeric: tabular-nums;
  overflow: visible !important;
}
#${SC('blank3_body')} > [id^="${SC('lbl_daily_steps_')}"] i { display: none !important; }
#${SC('blank3_body')} > [id^="${SC('lbl_daily_steps_')}"][data-myapp-future] { visibility: hidden !important; }
/* 歩数のある日は、字を濃く */
#${SC('blank3_body')} > [id^="${SC('lbl_daily_steps_')}"][data-myapp-has] .tcc-label-text { color: var(--myapp-text) !important; font-weight: 600 !important; }
/* カレンダーの下の説明 */
#${SC('blank3_body')}::after {
  content: '日付を押すと、その週の歩数を入れられます';
  position: absolute;
  left: 16px;
  right: 16px;
  top: ${CAL_TOP + 3 * CAL_PITCH + CAL_CELL + 16}px;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
  color: var(--myapp-text2);
}

/* 目標を設定する: カードの下の、灰色のカプセル（閉じるは左上の ‹） */
#${SC('R2')} { order: 9; height: 72px !important; }
#${SC('R2')} :is(.tcc-tile, .tcc-panel, .tcc-panel-body) { height: 72px !important; }
#${SC('targetStep_btn')} { left: 16px !important; right: auto !important; top: 16px !important; width: calc(100% - 32px) !important; height: 48px !important; }
${fillButton(SC('targetStep_btn'))}
`;

// 歩数の記録: 日付のマスに、元の並び（行・列）と、今日・これからの日の印を付ける。歩数のある日にも印。数字の後ろの「歩」を置く
const STEP_CAL_JS = `
  function stepCalendar() {
    var body = document.getElementById('${SC('blank3_body')}');
    if (!body) return;
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var mark = function (el, name, on) { if (el.hasAttribute(name) !== on) el.toggleAttribute(name, on); };
    var future = {}; // 「行,列」→ これからの日か（その日の歩数のラベルにも印を付けるため）
    body.querySelectorAll(':scope > [id^="${SC('btn_date')}"]').forEach(function (b) {
      if (!b.hasAttribute('data-myapp-row')) {
        var top = parseInt(b.style.top, 10);
        var left = parseInt(b.style.left, 10);
        if (isNaN(top) || isNaN(left)) return;
        b.setAttribute('data-myapp-row', String(Math.max(0, Math.min(3, Math.round((top - 45) / 90)))));
        b.setAttribute('data-myapp-col', String(Math.max(0, Math.min(6, Math.round((left - 15) / 55)))));
      }
      // 日付は「日」だけを出す（月の初めと、いちばん初めのマスは「12/1」）。元の「11/17」は印に取っておく
      var a = b.querySelector('.tcc-btn');
      if (!a) return;
      var shown = (a.textContent || '').trim();
      if (/^\\d{1,2}\\/\\d{1,2}$/.test(shown) && b.getAttribute('data-myapp-date') !== shown) b.setAttribute('data-myapp-date', shown);
      var m = /^(\\d{1,2})\\/(\\d{1,2})$/.exec(b.getAttribute('data-myapp-date') || '');
      if (!m) return;
      var md = +m[2] === 1 || (b.getAttribute('data-myapp-row') === '0' && b.getAttribute('data-myapp-col') === '0');
      var label = md ? (+m[1]) + '/' + (+m[2]) : String(+m[2]);
      if (shown !== label) a.textContent = label;
      mark(b, 'data-myapp-md', md);
      b.setAttribute('aria-label', (+m[1]) + '月' + (+m[2]) + '日');
      var d = new Date(today.getFullYear(), +m[1] - 1, +m[2]);
      if (d - today > 180 * 864e5) d.setFullYear(d.getFullYear() - 1);
      if (today - d > 180 * 864e5) d.setFullYear(d.getFullYear() + 1);
      mark(b, 'data-myapp-today', d.getTime() === today.getTime());
      mark(b, 'data-myapp-future', d > today);
      future[b.getAttribute('data-myapp-row') + ',' + b.getAttribute('data-myapp-col')] = d > today;
    });
    // その日の歩数（lbl_daily_steps_0〜27 は、左上から右へ、週ごとの順）。これからの日は出さない
    body.querySelectorAll(':scope > [id^="${SC('lbl_daily_steps_')}"]').forEach(function (l) {
      var i = parseInt(l.id.slice(l.id.lastIndexOf('_') + 1), 10);
      var n = parseInt(((l.textContent || '').replace(/[^0-9]/g, '')), 10) || 0;
      mark(l, 'data-myapp-has', n > 0);
      mark(l, 'data-myapp-future', future[Math.floor(i / 7) + ',' + (i % 7)] === true);
    });
    // 「目標 10,000 歩」: 「目標」を数字のすぐ左に（数字の長さは目標で変わるので、測って置く）
    var goal = document.querySelector('#${SC('lbl_step_goal')} .tcc-label-text');
    var goalLabel = document.getElementById('${SC('lbl27')}');
    if (goal && goalLabel) {
      var range = document.createRange();
      range.selectNodeContents(goal);
      var w = range.getBoundingClientRect().width;
      var right = Math.round(33 + w + 6) + 'px';
      if (w && goalLabel.style.getPropertyValue('right') !== right) goalLabel.style.setProperty('right', right, 'important');
    }
  }
`;

// Walk the Talk の「目標歩数を設定」（stepGoalSet_id_2026Walk）。パソコン向けのページを、2枚のカードに並べ直す:
//   1枚目 … 基準の目標歩数と、目標歩数ごとの係数（表の線はやめて、左に歩数・右に係数の行）
//   2枚目 … 週ごとの「あなたの1日の目標歩数」（週・入力欄・歩、その下に変更の期限）
// 大きな題名・閉じる・旗の絵・ロゴは出さない（hidden）。「保存」は画面の下の青いボタン（bottomBars）
// ---------------------------------------------------------------------------
const G = (id: string) => `stepGoalSet_id_2026Walk_${id}`;
/** トロフィーの形（ランキングが空のときの印。CSS の mask に使う） */
const TROPHY_ICON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 4h8v5a4 4 0 0 1-8 0z M8 6H5a2 2 0 0 0 2 4h1 M16 6h3a2 2 0 0 1-2 4h-1 M12 13v4 M8.5 20h7 M10 17h4v3h-4z'/%3E%3C/svg%3E")`;
const GOAL_TABLE = [
  ['lbl35', 'lbl36'],
  ['lbl21', 'lbl22'],
  ['lbl23', 'lbl24'],
  ['lbl25', 'lbl26'],
  ['lbl27', 'lbl28'],
  ['lbl29', 'lbl30'],
  ['lbl31', 'lbl32'],
  ['lbl33', 'lbl34'],
];
// 週ごと: 週の日付・入力欄・「歩」・変更の期限
const GOAL_WEEKS = [
  ['lbl45', 'numTargetSteps1', 'lbl16', 'lbl49'],
  ['lbl39', 'numTargetSteps2', 'lbl38', 'lbl50'],
  ['lbl42', 'numTargetSteps3', 'lbl41', 'lbl51'],
  ['lbl47', 'numTargetSteps4', 'lbl46', 'lbl52'],
];
const GOAL_ROW = 32; // 係数の表の1行
const GOAL_WEEK = 72; // 週の1段（入力欄 40 + 期限 20 + すきま）
function goalCard(row: string, height: number): string {
  return `
#stepGoalSet_id_2026Walk > #${G(row)} {
  width: calc(100% - 32px) !important;
  max-width: calc(100% - 32px) !important;
  margin: 12px 16px 0 !important;
  border-radius: 22px !important;
  background-color: var(--myapp-fill) !important;
  overflow: hidden !important;
}
#${G(row)}, #${G(row)} > *, #${G(row)} .tcc-panel, #${G(row)} .tcc-panel-body { height: ${height}px !important; }`;
}
const WTT_GOAL_CSS = `
${fullWidth('stepGoalSet_id_2026Walk')}
/* カードの中の字は、カードの端から 16px（ほかの画面のカードと同じ）。EZCraft の字の左右の余白と縁の線はなくす */
:is(#${G('R3')}, #${G('R4')}) .tcc-component.lbl .tcc-label { padding-left: 0 !important; padding-right: 0 !important; border-left-width: 0 !important; }
:is(#${G('R3')}, #${G('R4')}) .tcc-component.lbl .tcc-label-text { padding-left: 0 !important; padding-right: 0 !important; }
#stepGoalSet_id_2026Walk { height: auto !important; }
#stepGoalSet_id_2026Walk .tcc-tile.col { float: none !important; }
#${G('R2')} { display: none !important; }
/* 1枚目: 基準の目標歩数と、係数の表 */
${goalCard('R3', 112 + GOAL_TABLE.length * GOAL_ROW + 10)}
${place(G('lbl1'), '16px', 14, 'calc(100% - 32px)', 24)}
${text(G('lbl1'), 17, { bold: true })}
${place(G('lbl4'), '16px', 48, 'calc(100% - 140px)', 24)}
${text(G('lbl4'), 15, { muted: true })}
#${G('lbl8')} { left: auto !important; right: 16px !important; top: 48px !important; width: 110px !important; height: 24px !important; }
${text(G('lbl8'), 17, { bold: true, align: 'right' })}
${place(G('lbl19'), '16px', 88, 'calc(100% - 140px)', 20)}
${text(G('lbl19'), 13, { muted: true })}
#${G('lbl20')} { left: auto !important; right: 16px !important; top: 88px !important; width: 110px !important; height: 20px !important; }
${text(G('lbl20'), 13, { muted: true, align: 'right' })}
${GOAL_TABLE.map(
  ([steps, rate], i) => `${place(G(steps), '16px', 112 + i * GOAL_ROW, 'calc(100% - 140px)', GOAL_ROW)}
${text(G(steps), 15)}
#${G(rate)} { left: auto !important; right: 16px !important; top: ${112 + i * GOAL_ROW}px !important; width: 110px !important; height: ${GOAL_ROW}px !important; }
${text(G(rate), 15, { align: 'right' })}
#${G(steps)}, #${G(rate)} { border: none !important; background: transparent !important; }
#${G(steps)} *, #${G(rate)} * { border: none !important; background: transparent !important; font-weight: 400 !important; }`,
).join('\n')}
/* 2枚目: 週ごとの目標歩数 */
${goalCard('R4', 56 + GOAL_WEEKS.length * GOAL_WEEK)}
${place(G('lbl18'), '16px', 14, 'calc(100% - 32px)', 24)}
${text(G('lbl18'), 17, { bold: true })}
${GOAL_WEEKS.map(
  ([week, input, unit, until], i) => `${place(G(week), '16px', 52 + i * GOAL_WEEK, '130px', 40)}
${text(G(week), 15)}
#${G(week)}, #${G(week)} * { border: none !important; background: transparent !important; font-weight: 600 !important; }
#${G(input)} { left: auto !important; right: 40px !important; top: ${52 + i * GOAL_WEEK}px !important; width: 120px !important; height: 40px !important; }
${fillInput(G(input))}
/* カードの中の入力欄は、カードと見分けがつく灰色の面（ほかの画面のカードと同じ） */
#${G(input)} input { text-align: right !important; font-variant-numeric: tabular-nums; background-color: var(--myapp-inset) !important; border-color: transparent !important; }
#${G(unit)} { left: auto !important; right: 16px !important; top: ${52 + i * GOAL_WEEK}px !important; width: 16px !important; height: 40px !important; }
${text(G(unit), 15, { muted: true, align: 'right' })}
${place(G(until), '16px', 94 + i * GOAL_WEEK, 'calc(100% - 32px)', 20)}
${text(G(until), 13, { muted: true, align: 'right' })}`,
).join('\n')}
`;

export const APP_SKINS: Record<string, AppSkin> = {
  // ① 給与賞与明細: 年を選ぶ → 明細の一覧から選ぶ → 「明細を見る」
  L_Payslip: {
    mobileForms: ['LP_main', 'LP_password'],
    // 明細の PDF（パスワードを入れたあとに出る）のファイル名。明細を出す直前に、種類と支給日が App.data に入る
    // 例: 給与明細_2026-10-23.pdf・源泉徴収票_2025.pdf（アプリが受け取って、iPhone のプレビューで見せる。bridge.ts の 6）
    script: `
      window.__myappFileName = function () {
        var F = window.FALCON;
        var P = F && F.apps && F.apps.procedure;
        var data = (P && P.App && P.App.data) || {};
        var kinds = { '給与': '給与明細', '賞与': '賞与明細', 'SAP': '賞与明細', '源泉': '源泉徴収票' };
        var kind = kinds[data.pay_kind] || (data.pay_kind ? data.pay_kind + '明細' : '明細');
        var date = String(data.pay_date || '').trim().split(' ')[0].split('/').join('-');
        return kind + (date ? '_' + date : '');
      };
      // パスワードのダイアログ: スマホには「Enter キー」がないので、「開く」のボタンを置く（押すと、欄で Enter を押したのと同じ）。
      // キーボードの右下も「開く」にする。パスワードが空のあいだは押せない。パスワードはアプリでは覚えない（欄に入れるだけ）
      var pwWasOpen = false;
      window.__myappAppUpdate = function () {
        var body = document.getElementById('LP_password_blank1_body');
        var input = document.querySelector('#LP_password_txt_password input');
        // ダイアログを閉じたら、押した明細の行の色を戻す（選んだままに見えないように）
        var pwOpen = !!body && body.offsetParent !== null;
        if (pwWasOpen && !pwOpen) {
          document.querySelectorAll('#LP_main_grd_details tr.myapp-tapped').forEach(function (tr) { tr.classList.remove('myapp-tapped'); });
        }
        pwWasOpen = pwOpen;
        if (!body || !input) return;
        if (input.getAttribute('enterkeyhint') !== 'go') input.setAttribute('enterkeyhint', 'go');
        if (input.getAttribute('autocomplete') !== 'current-password') input.setAttribute('autocomplete', 'current-password');
        var go = body.querySelector(':scope > .myapp-pw-go');
        if (!go) {
          go = document.createElement('button');
          go.type = 'button';
          go.className = 'myapp-pw-go';
          go.setAttribute('data-myapp-nodark', '');
          go.textContent = '開く';
          go.addEventListener('click', function (e) {
            e.preventDefault();
            if (!input.value) return;
            ['keydown', 'keyup'].forEach(function (type) {
              jQuery(input).trigger(jQuery.Event(type, { keyCode: 13, which: 13, key: 'Enter' }));
            });
          });
          input.addEventListener('input', function () { go.disabled = !input.value; });
          body.appendChild(go);
        }
        go.disabled = !input.value;
      };
    `,
    // パスワードのダイアログの説明（スマホには Enter キーがないので、「開く」を押すように）
    relabel: { LP_password_lbl1: 'イントラと同じパスワードを入れて、「開く」を押してください。' },
    rowOpens: [{ grid: 'LP_main_grd_details', button: 'LP_main_btn_view_detail' }],
    hidden: ['LP_main_lbl_title', 'LP_main_btn_close'],
    layout: `
${fullWidth('LP_main')}
/* 明細の一覧が画面の下まで届くように、画面の高さに合わせる（一覧の中でスクロール） */
#LP_main { height: calc(100vh - 8px) !important; min-height: 520px; }
${place('LP_main_cmb_year', '16px', 16, '112px', 40)}
${fillInput('LP_main_cmb_year')}
${fillLabel('LP_main_lbl18')}
/* 「年」は欄の外に離して置かず、欄の中の数字のすぐ右に（「2026年 ▾」と1つの選ぶ欄に見えるように）。押すのは下の欄 */
${place('LP_main_lbl18', '61px', 16, '20px', 40)}
#LP_main_lbl18 { z-index: 5 !important; pointer-events: none !important; }
#LP_main_lbl18 .tcc-label { padding: 0 !important; justify-content: flex-start !important; }
#LP_main_lbl18 .tcc-label-text { padding: 0 !important; font-size: 16px !important; color: var(--myapp-text) !important; text-align: left !important; }
${place('LP_main_lbl_name', '16px', 72, 'calc(100% - 32px)', 24)}
${place('LP_main_lbl_yaku', '16px', 98, 'calc(100% - 32px)', 18)}
/* 等級の記号（AW3 など）は、見ても意味が分からないので出さない */
#LP_main_lbl_rank { display: none !important; }
/* 明細の一覧: 1件1枚のカード（明細の名前が上、支給日と種別が下）。押すと明細が開く（「明細を見る」のボタンはなくした） */
${place('LP_main_grd_details', '16px', 124, 'calc(100% - 32px)', 0)}
#LP_main_grd_details { height: calc(100vh - 140px) !important; min-height: 380px; }
#LP_main_grd_details .TccScrollOuter { height: 100% !important; }
#LP_main_grd_details .TccGridBodyScroll { height: 100% !important; overflow-y: auto !important; padding-bottom: calc(16px + var(--myapp-safe-bottom, 0px)) !important; box-sizing: border-box !important; }
/* 一覧の枠は出さず、1件ずつ白いカードに（勤怠の一覧と同じ） */
#LP_main_grd_details { border: none !important; border-radius: 0 !important; background: transparent !important; overflow: hidden; }
#LP_main_grd_details div, #LP_main_grd_details table { border: none !important; box-shadow: none !important; background: transparent !important; }
${cardGrid('LP_main_grd_details', [[2], [3, 1]], { 3: '支給日' })}
#LP_main_grd_details .TccGridBodyScroll tr {
  position: relative;
  margin: 0 0 8px !important;
  padding: 14px 40px 14px 16px !important;
  border: none !important;
  border-radius: 22px !important;
  background-color: var(--myapp-fill) !important;
}
#LP_main_grd_details .TccGridBodyScroll tr::after {
  content: '›' !important;
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  flex-basis: auto !important;
  height: auto !important;
  font-size: 22px;
  color: var(--myapp-text2);
}

/* 「明細を見る」で出るパスワードのダイアログ */
/* 「明細を見る」で出るパスワードのダイアログ: 題名と × の帯 → 説明 → 入力欄 → 「開く」。
   キーボードに隠れないよう、画面の上のほうに出す。題名の飾りの印と、下の空の帯は出さない。
   高さは、題名の帯（56）と中身（188）を足したもの（大きいと、下に色の違う細い帯がのぞく） */
${mobileDialog('LP_password', 244)}
#LP_password { top: 112px !important; }
#LP_password .tcc-modal-header {
  height: 56px !important;
  display: flex !important;
  align-items: center !important;
  padding: 0 56px 0 20px !important;
  box-sizing: border-box !important;
}
#LP_password .tcc-modal-title { font-size: 17px !important; font-weight: 600 !important; }
#LP_password .tcc-modal-header > i { display: none !important; }
#LP_password .tcc-modal-quit { position: absolute !important; top: 10px !important; right: 10px !important; margin: 0 !important; }
#LP_password .tcc-modal-footer { display: none !important; }
#LP_password_body, #LP_password_R1, #LP_password_R1 > *, #LP_password_blank1, #LP_password_blank1_body { height: 188px !important; }
${place('LP_password_lbl1', '20px', 0, 'calc(100% - 40px)', 40)}
#LP_password_lbl1 * { max-width: 100% !important; white-space: normal !important; word-break: break-all; text-align: left !important; }
#LP_password_lbl1 .tcc-label { width: 100% !important; padding: 0 !important; vertical-align: top !important; }
#LP_password_lbl1 .tcc-label-text { padding: 0 !important; font-size: 14px !important; line-height: 1.45 !important; color: var(--myapp-text2) !important; }
${place('LP_password_txt_password', '16px', 52, 'calc(100% - 32px)', 48)}
${fillInput('LP_password_txt_password')}
#LP_password_txt_password input { font-size: 17px !important; }
.myapp-pw-go {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 116px;
  height: 50px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: var(--myapp-tint);
  box-shadow: var(--myapp-tint-shadow);
  color: #FFFFFF;
  font: inherit;
  font-size: 17px;
  font-weight: 600;
}
.myapp-pw-go:active { transform: scale(0.97); }
/* 入れる前（押せないとき）: 青いカプセルを薄くするだけ（ダークで、灰色の面に暗い青の文字の、読みにくい見た目にしない） */
.myapp-pw-go:disabled { box-shadow: none; opacity: 0.4; background: var(--myapp-tint) !important; color: #FFFFFF !important; }
`,
  },

  // ② 情報処理試験資格取得者検索: 条件を入れて「検索」→ 結果の一覧
  L_ITEE: {
    mobileForms: ['LIT_main'],
    relabel: {
      LIT_main_lbl_year: '取得年度',
      LIT_main_lbl_exa_name: '資格名',
      LIT_main_lbl_last_name: '姓',
      LIT_main_lbl_first_name: '名',
      LIT_main_btn_search: '検索',
    },
    placeholders: { LIT_main_cmb_year: 'すべて', LIT_main_cmb_season: 'すべて', LIT_main_cmb_exa_name: 'すべて' },
    script: `
      // 「検索」を押したか（0 件のとき、EZCraft は件数を空にするので、検索の前と見分けがつかない）。「クリア」で戻す
      var searched = false;
      document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest && e.target.closest('#LIT_main_btn_search, #LIT_main_btn_clear_search');
        if (b) searched = b.id === 'LIT_main_btn_search';
      }, true);
      window.__myappAppUpdate = function () {
        // 検索の前は「件」だけが出るので隠す。一覧が空のときは、検索の前と、見つからなかったときで文を変える
        var count = document.querySelector('#LIT_main_lbl_cond_cnt .tcc-label-text');
        var n = count ? (count.textContent || '').trim() : '';
        var unit = document.getElementById('LIT_main_lbl_cont_nin');
        if (unit) unit.style.visibility = n ? '' : 'hidden';
        var grid = document.getElementById('LIT_main_grd_exa_list');
        if (!grid) return;
        var rows = grid.querySelectorAll('.TccGridBodyScroll tbody tr');
        var empty = !Array.prototype.some.call(rows, function (tr) {
          return Array.prototype.some.call(tr.children, function (td) {
            return !/rowHead|_tdCol0(?!\\d)/.test(td.className) && (td.textContent || '').trim() !== '';
          });
        });
        var msg = n === '' && !searched ? '条件を選んで「検索」を押してください' : '該当する人はいません。条件を変えて、もう一度検索してください';
        if (grid.getAttribute('data-myapp-empty-msg') !== msg) grid.setAttribute('data-myapp-empty-msg', msg);
        grid.classList.toggle('myapp-empty', empty);
      };
    `,
    primary: ['LIT_main_btn_search'],
    hidden: ['LIT_main_btn_close', 'LIT_main_lin2'],
    layout: `
${fullWidth('LIT_main')}
#LIT_main { height: 720px !important; }
${place('LIT_main_lbl_year', '16px', 16, '80px', 40)}
/* 取得年度（年・時期）: 2つを同じ幅で、下の欄と同じ右の端まで */
${place('LIT_main_cmb_year', '104px', 16, 'calc((100% - 128px) / 2)', 40)}
${place('LIT_main_cmb_season', 'calc(112px + (100% - 128px) / 2)', 16, 'calc((100% - 128px) / 2)', 40)}
${place('LIT_main_lbl_exa_name', '16px', 68, '80px', 40)}
${place('LIT_main_cmb_exa_name', '104px', 68, 'calc(100% - 120px)', 40)}
${place('LIT_main_lbl_last_name', '16px', 120, '80px', 40)}
${place('LIT_main_txt_last_name', '104px', 120, 'calc(50% - 86px)', 40)}
${place('LIT_main_lbl_first_name', 'calc(50% + 26px)', 120, '28px', 40)}
${place('LIT_main_txt_first_name', 'calc(50% + 58px)', 120, 'calc(50% - 74px)', 40)}
${['LIT_main_lbl_year', 'LIT_main_lbl_exa_name', 'LIT_main_lbl_last_name', 'LIT_main_lbl_first_name'].map(fillLabel).join('')}
${['LIT_main_cmb_year', 'LIT_main_cmb_season', 'LIT_main_cmb_exa_name', 'LIT_main_txt_last_name', 'LIT_main_txt_first_name'].map(fillInput).join('')}
#LIT_main_lbl_year .tcc-label-text,
#LIT_main_lbl_exa_name .tcc-label-text,
#LIT_main_lbl_last_name .tcc-label-text,
#LIT_main_lbl_first_name .tcc-label-text { text-align: left !important; letter-spacing: 0 !important; color: var(--myapp-text2) !important; font-size: 15px !important; }
/* クリアは左、検索（主な操作）は右に（勤怠の検索と同じ並び） */
${place('LIT_main_btn_clear_search', '16px', 176, 'calc(50% - 22px)', 48)}
${place('LIT_main_btn_search', 'calc(50% + 6px)', 176, 'calc(50% - 22px)', 48)}
${fillButton('LIT_main_btn_search')}
${fillButton('LIT_main_btn_clear_search')}
/* 「656件」: 数と「件」のあいだをあけない */
/* 「件」の右の端を、カードの右の端（画面の端から 16px）にそろえる */
#LIT_main_lbl_cond_cnt { left: auto !important; right: 30px !important; top: 240px !important; width: 96px !important; height: 24px !important; }
#LIT_main_lbl_cont_nin { left: auto !important; right: 16px !important; top: 240px !important; width: 14px !important; height: 24px !important; }
#LIT_main_lbl_cond_cnt .tcc-label-text { text-align: right !important; padding-right: 1px !important; }
#LIT_main_lbl_cont_nin .tcc-label, #LIT_main_lbl_cont_nin .tcc-label-text { padding: 0 !important; text-align: right !important; }
#LIT_main_lbl_cond_cnt .tcc-label, #LIT_main_lbl_cond_cnt .tcc-label-text,
#LIT_main_lbl_cont_nin .tcc-label, #LIT_main_lbl_cont_nin .tcc-label-text { color: var(--myapp-text2) !important; font-size: 13px !important; }
${fillLabel('LIT_main_lbl_cond_cnt')}
${fillLabel('LIT_main_lbl_cont_nin')}
${row('LIT_main_grd_exa_list', 272, 380)}
/* 結果: 1件1枚のカード（名前が上、資格名と取得年度が下）。表の見出しと枠は出さない */
#LIT_main_grd_exa_list { border: none !important; border-radius: 0 !important; background: transparent !important; }
#LIT_main_grd_exa_list div, #LIT_main_grd_exa_list table { border: none !important; box-shadow: none !important; }
${cardGrid('LIT_main_grd_exa_list', [[1], [3], [2]], { 2: '取得年度' })}
#LIT_main_grd_exa_list .TccGridBodyScroll tr {
  margin: 0 0 8px !important;
  padding: 12px 16px !important;
  border: none !important;
  border-radius: 22px !important;
  background-color: var(--myapp-fill) !important;
}
${row('LIT_main_btn_Execel', 664, 44)}
${fillButton('LIT_main_btn_Execel')}
/* Excel 出力のボタンが出ていない（ふつうの人）ときは、一覧を画面の下の端まで伸ばす（下に空いた場所を残さない）。
   最後のカードは、ホームに戻るバーの上まで上がる */
#LIT_main:not(:has(#LIT_main_btn_Execel:not([style*="visibility: hidden"]))) :is(#LIT_main_lit_tab, #LIT_main_lit_tab > .tcc-tab-content, #LIT_main_lit_tab_tabs_0) { overflow: visible !important; }
/* 一覧は、画面の下の端まで（下に灰色の帯を残さない）。最後のカードの下は、ホームに戻るバーのぶん空ける */
#LIT_main:not(:has(#LIT_main_btn_Execel:not([style*="visibility: hidden"]))) #LIT_main_grd_exa_list { height: max(380px, calc(100vh - 272px)) !important; }
#LIT_main_grd_exa_list .TccGridBodyScroll { padding-bottom: calc(16px + var(--myapp-safe-bottom, 0px)) !important; box-sizing: border-box !important; }
/* 一覧が空のときの文は、ボタンのすぐ下に（一覧の面は画面の下まであるので、真ん中だと画面のなかほどに離れて出る。承認待ちと同じくらいの位置） */
#LIT_main_grd_exa_list.myapp-empty::after { top: 24px; transform: none; }
`,
  },

  // ③ £-TiMS 勤怠管理（メニュー・勤務表・勤怠実績登録）。長いので timsSkin.ts に分けてある
  L_Tims: TIMS_SKIN,

  // 住民税通知取得: 年度を確かめて「取得」
  L_Payslip_Juminzei: {
    mobileForms: ['LPJZ_Main'],
    relabel: { LPJZ_Main_btnDownLoad: '通知書を取得する' },
    script: `
      window.__myappAppUpdate = function () {
        // 取得する前は「files : 0, total size : 0.00MB」と出るだけなので隠す（取得したら出す）
        var att = document.getElementById('LPJZ_Main_att_file');
        if (!att) return;
        var none = /files\\s*[:：]\\s*0(?![\\d.])/.test(att.textContent || '');
        if (att.style.visibility !== (none ? 'hidden' : '')) att.style.visibility = none ? 'hidden' : '';
      };
    `,
    // 「通知書を取得する」は、画面の下に浮かせたガラスのボタンに
    bottomBars: { LPJZ_Main: ['LPJZ_Main_btnDownLoad'] },
    notes: ['LPJZ_Main_lbl_kome'],
    hidden: ['LPJZ_Main_btnClose'],
    layout: `
${fullWidth('LPJZ_Main')}
#LPJZ_Main { height: 220px !important; overflow: visible !important; }
#LPJZ_Main > * { overflow: visible !important; }
#LPJZ_Main_R1, #LPJZ_Main_R1_C1, #LPJZ_Main_blank1 { height: 140px !important; }
#LPJZ_Main_tab_LPJZ { top: 0 !important; height: 140px !important; }
/* 名前・年度・注意書きを、1枚の白いカードに（画面の端から 16px あける） */
#LPJZ_Main > #LPJZ_Main_R1 {
  width: calc(100% - 32px) !important;
  max-width: calc(100% - 32px) !important;
  margin: 8px 16px 0 !important;
  border-radius: 22px !important;
  background-color: var(--myapp-fill) !important;
  overflow: hidden !important;
}
${row('LPJZ_Main_lbl_name', 16, 24)}
/* 「2026年度分」: 年と「年度分」は別の部品。すきまをあけずに続けて、太字の1つの見出しに見せる */
${place('LPJZ_Main_lbl_main_year', '16px', 52, '42px', 36)}
${place('LPJZ_Main_lbl_nend_main', '58px', 52, '80px', 36)}
${fillLabel('LPJZ_Main_lbl_main_year')}
${fillLabel('LPJZ_Main_lbl_nend_main')}
#LPJZ_Main_lbl_main_year .tcc-label,
#LPJZ_Main_lbl_nend_main .tcc-label,
#LPJZ_Main_lbl_main_year .tcc-label-text,
#LPJZ_Main_lbl_nend_main .tcc-label-text { padding: 0 !important; }
#LPJZ_Main_lbl_main_year .tcc-label-text,
#LPJZ_Main_lbl_nend_main .tcc-label-text { text-align: left !important; font-size: 17px !important; font-weight: 700 !important; }
#LPJZ_Main_lbl_main_year .tcc-label-text { text-align: right !important; }
${fillButton('LPJZ_Main_btnDownLoad')}
${row('LPJZ_Main_lbl_kome', 90, 32)}
#LPJZ_Main_lbl_kome .tcc-label, #LPJZ_Main_lbl_kome .tcc-label-text, #LPJZ_Main_lbl_name .tcc-label, #LPJZ_Main_lbl_name .tcc-label-text { padding-left: 0 !important; }
/* 添付ファイルの欄（上の枠のすぐ下に置かれる） */
#LPJZ_Main_att_file { left: 16px !important; top: 8px !important; width: calc(100% - 32px) !important; }
#LPJZ_Main_att_file,
#LPJZ_Main_att_file * {
  background-color: transparent !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
  color: var(--myapp-text2) !important;
}
#LPJZ_Main_att_file {
  background-color: var(--myapp-fill) !important;
  border-radius: 20px !important;
  overflow: hidden !important;
  height: 40px !important;
}
#LPJZ_Main_att_file #att-header { width: 100% !important; height: 40px !important; box-sizing: border-box; }
#LPJZ_Main_att_file #att-clip { top: 6px !important; left: 8px !important; width: 28px !important; }
#LPJZ_Main_att_file #att-info { top: 8px !important; left: 40px !important; width: calc(100% - 48px) !important; }
#LPJZ_Main_att_file .tcc-label-text { font-size: 13px !important; }
/* カードの下に、何ができる画面かの説明（年度は、会社のシステムがその年のものを出す。ほかの年度は選べない） */
#LPJZ_Main::after {
  content: '「通知書を取得する」を押すと、この年度の特別徴収税額の通知書（PDF）を開きます。保存や印刷は、開いた画面の共有ボタンから。';
  display: block;
  margin: 16px 20px 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--myapp-text2);
}
/* 取得する前（添付ファイルの欄が空で隠れている）は、その欄のぶん上に詰めて、カードのすぐ下に */
#LPJZ_Main:has(#LPJZ_Main_att_file[style*="visibility: hidden"])::after { margin-top: -10px; }
`,
  },

  // 健診管理システム: 受診年度 → メニューのカード3つ → 注意書き → お知らせ。ロゴは出さない
  L_HealthCare: {
    mobileForms: ['L_HealthCare_Main', 'MC_reserv_Input', 'MC_result_Input_1'],
    // お知らせ: 1年より前のもの（「健診予約登録ができるようになりました。」2022 年など）は出さない。
    // 残った数を data-myapp-notices に書き、カードの高さをそれに合わせる（下の layout。空の白い面を残さない）
    script: `
      window.__myappAppUpdate = function () {
        var form = document.getElementById('L_HealthCare_Main');
        var rpt = document.getElementById('L_HealthCare_Main_rpt_notice');
        if (!form || !rpt) return;
        var limit = Date.now() - 365 * 864e5;
        var shown = 0;
        rpt.querySelectorAll('.tcc-rpt-row').forEach(function (r) {
          var date = r.querySelector('[id^="L_HealthCare_Main_notice_date-"]');
          if (!date) return;
          var m = /(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})/.exec(date.textContent || '');
          var old = !!m && new Date(+m[1], +m[2] - 1, +m[3]).getTime() < limit;
          if (old !== r.hasAttribute('data-myapp-old')) r.toggleAttribute('data-myapp-old', old);
          if (!old && getComputedStyle(r).display !== 'none') shown++;
        });
        var n = String(Math.min(shown, 3));
        if (form.getAttribute('data-myapp-notices') !== n) form.setAttribute('data-myapp-notices', n);
        // 注意書きの1つの文が、2つの部品（lbl8 と lbl16）に分けてある。lbl8 に続けて1つの段落にし、lbl16 は隠す（CSS）
        var a = document.querySelector('#L_HealthCare_Main_lbl8 .tcc-label-text');
        var b = document.querySelector('#L_HealthCare_Main_lbl16 .tcc-label-text');
        if (a && b) {
          var rest = (b.textContent || '').trim();
          if (rest && (a.textContent || '').indexOf(rest) < 0) a.textContent = (a.textContent || '').trim() + rest;
        }
        // 受診登録のダイアログの題名は「受診登録_本人」と出るので、「受診登録」に
        document.querySelectorAll('#MC_result_Input_1 .tcc-modal-title, .tcc-modal:has(#MC_result_Input_1) .tcc-modal-title').forEach(function (t) {
          var w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
          var node;
          while ((node = w.nextNode())) {
            var v = node.nodeValue.replace(/_本人\\s*$/, '');
            if (v !== node.nodeValue) node.nodeValue = v;
          }
        });
      };
    `,
    cards: [
      { button: 'L_HealthCare_Main_btnReserv', subtitle: 'L_HealthCare_Main_lbl13' },
      { button: 'L_HealthCare_Main_btnResult', subtitle: 'L_HealthCare_Main_lbl15' },
      { button: 'L_HealthCare_Main_btnResult_spouse', subtitle: 'L_HealthCare_Main_lbl17' },
    ],
    notes: [
      'L_HealthCare_Main_lbl6',
      'L_HealthCare_Main_lbl8',
      'L_HealthCare_Main_lbl16',
      'MC_result_Input_1_lbl25',
      'MC_result_Input_1_lbl28',
      'MC_result_Input_1_lbl24',
    ],
    sections: ['MC_result_Input_1_lbl27', 'MC_result_Input_1_lbl36'],
    bottomBars: {
      MC_reserv_Input: ['MC_reserv_Input_btnCancel', 'MC_reserv_Input_btnUpdate', 'MC_reserv_Input_btnSave'],
      MC_result_Input_1: ['MC_result_Input_1_btnCancel', 'MC_result_Input_1_btnSave'],
    },
    danger: ['MC_reserv_Input_btnCancel', 'MC_result_Input_1_btnCancel'],
    chips: ['#L_HealthCare_Main_rpt_notice [id^="L_HealthCare_Main_notice_class-"]'],
    hidden: [
      'L_HealthCare_Main_img3',
      'L_HealthCare_Main_btnClose',
      'L_HealthCare_Main_lbl11',
      'L_HealthCare_Main_lbl14',
      'L_HealthCare_Main_lbl19',
    ],
    layout: `
${fullWidth('L_HealthCare_Main')}
#L_HealthCare_Main,
#L_HealthCare_Main_R1,
#L_HealthCare_Main_R1_C1,
#L_HealthCare_Main_blank1 { height: 660px !important; }
#L_HealthCare_Main_tabCheckup { top: 0 !important; height: 316px !important; }

/* 受診年度 */
${place('L_HealthCare_Main_lbl7', '16px', 16, '92px', 36)}
${place('L_HealthCare_Main_curr_nend', '112px', 16, '72px', 36)}
${place('L_HealthCare_Main_rdoNend', '192px', 16, 'calc(100% - 208px)', 36)}
${fillLabel('L_HealthCare_Main_lbl7')}
${fillInput('L_HealthCare_Main_curr_nend')}
#L_HealthCare_Main_lbl7 .tcc-label-text { text-align: left !important; color: var(--myapp-text2) !important; }

/* メニュー */
${row('L_HealthCare_Main_btnReserv', 64, 76)}
${place('L_HealthCare_Main_lbl13', '27px', 106, 'calc(100% - 88px)', 22)}
${row('L_HealthCare_Main_btnResult', 152, 76)}
${place('L_HealthCare_Main_lbl15', '27px', 194, 'calc(100% - 88px)', 22)}
${row('L_HealthCare_Main_btnResult_spouse', 240, 76)}
${place('L_HealthCare_Main_lbl17', '27px', 282, 'calc(100% - 88px)', 22)}
${fillButton('L_HealthCare_Main_btnReserv')}
${fillButton('L_HealthCare_Main_btnResult')}
${fillButton('L_HealthCare_Main_btnResult_spouse')}

/* 注意書き */
${row('L_HealthCare_Main_lbl6', 332, 40)}
/* lbl16 は lbl8 の続き（1つの文を2つの部品に分けてある）。JS が lbl8 に続けて1つの段落にするので、lbl16 は出さない */
${row('L_HealthCare_Main_lbl8', 380, 80)}
#L_HealthCare_Main_lbl16 { display: none !important; }
#L_HealthCare_Main_lbl6 .tcc-label, #L_HealthCare_Main_lbl8 .tcc-label { vertical-align: top !important; }

/* お知らせ（1件を2行に: 区分と日付 / 本文） */
${row('L_HealthCare_Main_rpt_notice', 472, 176)}
/* お知らせは、1枚の白いカードの中に、線で区切って並べる */
#L_HealthCare_Main_rpt_notice {
  border: none !important;
  border-radius: 22px !important;
  background-color: var(--myapp-fill) !important;
  padding: 2px 16px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}
#L_HealthCare_Main_rpt_notice * { border: none !important; background-color: transparent !important; }
#L_HealthCare_Main_rpt_notice .tcc-rpt-row {
  height: 58px !important;
  width: 100% !important;
  border-bottom: 1px solid var(--myapp-border) !important;
}
#L_HealthCare_Main_rpt_notice .tcc-rpt-row:last-child { border-bottom: none !important; }
#L_HealthCare_Main_rpt_notice [id^="L_HealthCare_Main_notice_class-"] { display: block !important; left: 0 !important; top: 8px !important; width: 64px !important; height: 20px !important; }
#L_HealthCare_Main_rpt_notice [id^="L_HealthCare_Main_notice_class-"] .tcc-label { height: 20px !important; }
#L_HealthCare_Main_rpt_notice [id^="L_HealthCare_Main_notice_date-"] { left: 76px !important; top: 6px !important; width: 120px !important; }
#L_HealthCare_Main_rpt_notice [id^="L_HealthCare_Main_noticedtl-"] { left: 0 !important; top: 32px !important; width: 100% !important; }
/* お知らせの行の入れ物は、パソコン向けの幅のまま広い。カードの幅に合わせる（長い文も、カードの中で「…」で終わる） */
#L_HealthCare_Main_rpt_notice .tcc-rpt-body,
#L_HealthCare_Main_rpt_notice .tcc-rpt-row { width: 100% !important; min-width: 0 !important; }
#L_HealthCare_Main_rpt_notice .tcc-rpt-row .tcc-label { width: 100% !important; }
#L_HealthCare_Main_rpt_notice [id^="L_HealthCare_Main_notice_date-"] .tcc-label-text { color: var(--myapp-text2) !important; font-size: 13px !important; }
/* 古いお知らせは出さない。カードは、残ったお知らせの数の高さに（1件 58px）。なければカードごと出さない */
#L_HealthCare_Main_rpt_notice .tcc-rpt-row[data-myapp-old] { display: none !important; }
#L_HealthCare_Main[data-myapp-notices="0"] #L_HealthCare_Main_rpt_notice { display: none !important; }
#L_HealthCare_Main[data-myapp-notices="1"] #L_HealthCare_Main_rpt_notice { height: 62px !important; }
#L_HealthCare_Main[data-myapp-notices="2"] #L_HealthCare_Main_rpt_notice { height: 120px !important; }
${[
  ['0', 460],
  ['1', 546],
  ['2', 604],
]
  .map(
    ([n, h]) => `#L_HealthCare_Main[data-myapp-notices="${n}"],
#L_HealthCare_Main[data-myapp-notices="${n}"] #L_HealthCare_Main_R1,
#L_HealthCare_Main[data-myapp-notices="${n}"] #L_HealthCare_Main_R1_C1,
#L_HealthCare_Main[data-myapp-notices="${n}"] #L_HealthCare_Main_blank1 { height: ${h}px !important; }`,
  )
  .join('\n')}
${HEALTH_RESERVE_CSS}
${HEALTH_RESULT_CSS}
`,
  },

  // Walk the Talk: ポイント → 次の目的地の写真 → 歩数の数字（灰色の面）→ 登録ボタン
  YIF_walk_the_talk: {
    mobileForms: ['mainMenu_id_2026Walk', 'ranking_id_2026Walk', 'stepGoalSet_id_2026Walk', 'stepCount_id_2026Walk'],
    titles: { ranking_id_2026Walk: 'ランキング', stepGoalSet_id_2026Walk: '目標歩数の設定', stepCount_id_2026Walk: '歩数の記録' },
    // 平均歩数の見出しの「１日」（全角の数字）を、ほかと同じ半角に。歩数の記録の曜日は、歩数入力と同じ日本語に
    relabel: {
      mainMenu_id_2026Walk_lbl_word_average: 'リンクレア社員の1日の平均歩数',
      [SC('lbl21')]: '1日の平均',
      ...Object.fromEntries(
        (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day, i) => [SC(`lbl_${day}`), '月火水木金土日'.charAt(i)]),
      ),
    },
    primary: ['stepGoalSet_id_2026Walk_btn2'],
    // 週の歩数の入力（weeklyStepCount）: 数字のキーボードにする
    numeric: WEEK_DAYS.map((d) => `${WEEKLY}_num_steps_${d}`),
    emptyGrids: {
      ranking_id_2026Walk_ranking_grd_kojin: 'まだランキングはありません',
      ranking_id_2026Walk_ranking_grd_dantai: 'まだランキングはありません',
    },
    // ランキング: 更新日の曜日が合っていないことがある（2026/11/13(日) など）。日付から曜日を出し直し、「時点分」は「時点」に
    script: `
      ${HEALTH_STEPS_JS}
      ${STEP_CAL_JS}
      ${WEEKLY_JS}
      window.__myappAppUpdate = function () {
        weeklySheet();
        healthSteps();
        stepCalendar();
        // 歩数のカード: 単位の「歩」を、カードの右の端ではなく、数字のすぐ後ろに置く（数字の長さは毎日変わるので、測って置く）
        [
          ['mainMenu_id_2026Walk_lbl_varia_day_step_goal_number', 'mainMenu_id_2026Walk_lbl_word_walk_big_1'],
          ['mainMenu_id_2026Walk_lbl_variable_sum_step_number', 'mainMenu_id_2026Walk_lbl_word_walk_big_2'],
          ['${SC('lbl_sum_week_steps')}', '${SC('lbl18')}'],
          ['${SC('lbl_ave_all_steps')}', '${SC('lbl24')}'],
          ['${SC('lbl_sum_all_steps')}', '${SC('lbl20')}'],
          ['${WK('lbl_sum_steps')}', '${WK('lbl24')}'],
        ].forEach(function (pair) {
          var num = document.getElementById(pair[0]);
          var unit = document.getElementById(pair[1]);
          var text = num && num.querySelector('.tcc-label-text');
          if (!text || !unit) return;
          var range = document.createRange();
          range.selectNodeContents(text);
          var w = range.getBoundingClientRect().width;
          if (!w) return;
          var left = Math.round(num.offsetLeft + w + 6) + 'px';
          if (unit.style.getPropertyValue('left') !== left) unit.style.setProperty('left', left, 'important');
        });
        var el = document.querySelector('#ranking_id_2026Walk_lbl_upDate .tcc-label-text');
        if (!el) return;
        var m = /(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})/.exec(el.textContent || '');
        if (!m) return;
        var d = new Date(+m[1], +m[2] - 1, +m[3]);
        var text = m[1] + '/' + m[2] + '/' + m[3] + '（' + '日月火水木金土'.charAt(d.getDay()) + '）時点';
        if (el.textContent !== text) el.textContent = text;
        // いつの集計かは、一覧の上の1行（更新の決まりの注意書き）にまとめる（一覧の下に離れて浮かないように。下の行は隠す）
        var note = document.querySelector('#ranking_id_2026Walk_lbl4 .tcc-label-text');
        var line = text + '・毎週金曜日 9:00 に更新';
        if (note && note.textContent !== line) note.textContent = line;
      };
    `,
    // 主な操作（歩数の登録など）は、画面の下に浮かせたガラスのボタンに
    bottomBars: {
      mainMenu_id_2026Walk: ['mainMenu_id_2026Walk_btn_walk'],
      // 目標歩数の設定: 「保存」は、画面の下に浮かせた青いボタンに（閉じるのは、左上の ‹）
      stepGoalSet_id_2026Walk: ['stepGoalSet_id_2026Walk_btn2'],
      // 歩数入力: 「閉じる」と「保存」（保存は青）は、シートの下の帯に
      [WEEKLY]: [`${WEEKLY}_btn_close`, `${WEEKLY}_btn_register`],
    },
    panels: [
      'mainMenu_id_2026Walk_lbl_background_1',
      'mainMenu_id_2026Walk_lbl_background_2',
      'mainMenu_id_2026Walk_lbl_background_3',
    ],
    hidden: [
      'mainMenu_id_2026Walk_R1',
      'mainMenu_id_2026Walk_lin1',
      'mainMenu_id_2026Walk_lin2',
      'mainMenu_id_2026Walk_img_LINCREA',
      // ランキング: 大きな題名（上のヘッダーが「ランキング」）・「閉じる」（左上の ‹ で戻る）・飾りの線・ロゴは出さない
      'ranking_id_2026Walk_R1',
      'ranking_id_2026Walk_lbl1',
      'ranking_id_2026Walk_btnClose',
      'ranking_id_2026Walk_lin1',
      'ranking_id_2026Walk_img1',
      // 目標歩数の設定: 大きな題名（上のヘッダーと同じ）・閉じる・飾りの線・旗の絵・ロゴ・空の部品は出さない
      'stepGoalSet_id_2026Walk_R1',
      'stepGoalSet_id_2026Walk_btn_close',
      'stepGoalSet_id_2026Walk_lin1',
      'stepGoalSet_id_2026Walk_lin2',
      'stepGoalSet_id_2026Walk_img1',
      'stepGoalSet_id_2026Walk_img2',
      'stepGoalSet_id_2026Walk_img3',
      'stepGoalSet_id_2026Walk_img4',
      'stepGoalSet_id_2026Walk_img5',
      'stepGoalSet_id_2026Walk_lbl37',
      'stepGoalSet_id_2026Walk_lbl44',
      // 歩数の記録: 大きな題名（上のヘッダーと同じ）・閉じる（左上の ‹ で戻る）・飾りの印と線・ロゴは出さない
      SC('R1'),
      SC('btn_close'),
      SC('lbl22'),
      SC('lbl23'),
      SC('lin1'),
      SC('lin2'),
      SC('img1'),
      // 歩数入力: 旗と的の絵は出さない
      WK('lbl30'),
      WK('lbl31'),
    ],
    layout: `
${WTT_GOAL_CSS}
${STEP_CAL_CSS}
${WEEKLY_CSS}
${fullWidth('mainMenu_id_2026Walk')}
#mainMenu_id_2026Walk,
#mainMenu_id_2026Walk_R2,
#mainMenu_id_2026Walk_R3 { height: auto !important; }
#mainMenu_id_2026Walk_R2_C1, #mainMenu_id_2026Walk_blank4 { height: 452px !important; }
#mainMenu_id_2026Walk_R3_C1, #mainMenu_id_2026Walk_blank2 { height: 128px !important; }

/* ポイント */
/* 「現在のWTTポイント」「0」「Pt」の3つは、文字の下の線（ベースライン）をそろえる（数字の下の線は、上から 58px ほど） */
${place('mainMenu_id_2026Walk_lbl_word_now_wtt_point', '16px', 29, '200px', 36)}
${text('mainMenu_id_2026Walk_lbl_word_now_wtt_point', 15, { muted: true })}
/* 「現在のWTTポイント」と右の「Pt」は、どちらも画面の端から 20pt（ほかの画面の小見出しと同じ位置） */
#mainMenu_id_2026Walk_lbl_word_now_wtt_point .tcc-label { padding-left: 0 !important; border-left-width: 0 !important; }
#mainMenu_id_2026Walk_lbl_word_now_wtt_point .tcc-label-text { padding-left: 4px !important; }
/* 数字と単位のすきまは、歩数のカード（10,000 歩）と同じ 6pt ほどに。単位の箱は字の幅だけにして、右端を画面の端から 16px に */
#mainMenu_id_2026Walk_lbl_wtt_point { left: auto !important; right: 39px !important; top: 8px !important; width: 140px !important; height: 48px !important; }
#mainMenu_id_2026Walk_lbl_wtt_point,
#mainMenu_id_2026Walk_lbl_wtt_point * { overflow: visible !important; line-height: 48px !important; }
${text('mainMenu_id_2026Walk_lbl_wtt_point', 30, { bold: true, align: 'right' })}
#mainMenu_id_2026Walk_lbl_word_Pt { left: auto !important; right: 20px !important; top: 8px !important; width: 16px !important; height: 48px !important; }
#mainMenu_id_2026Walk_lbl_word_Pt,
#mainMenu_id_2026Walk_lbl_word_Pt * { line-height: 72px !important; overflow: visible !important; }
${text('mainMenu_id_2026Walk_lbl_word_Pt', 15, { muted: true, align: 'right' })}

/* 次の目的地 */
${row('mainMenu_id_2026Walk_img_next_point_image', 64, 182)}
#mainMenu_id_2026Walk_img_next_point_image,
#mainMenu_id_2026Walk_img_next_point_image * { border-radius: 22px; overflow: hidden; }
#mainMenu_id_2026Walk_img_next_point_image img { width: 100% !important; height: 100% !important; object-fit: cover; }
${row('mainMenu_id_2026Walk_lbl_variable_next_point', 254, 24)}
${text('mainMenu_id_2026Walk_lbl_variable_next_point', 15, { bold: true, align: 'center' })}

/* 歩数（2つ並び + 横長1つ） */
${place('mainMenu_id_2026Walk_lbl_background_1', '16px', 294, 'calc(50% - 22px)', 84)}
${place('mainMenu_id_2026Walk_lbl_background_2', 'calc(50% + 6px)', 294, 'calc(50% - 22px)', 84)}
${row('mainMenu_id_2026Walk_lbl_background_3', 390, 52)}

${place('mainMenu_id_2026Walk_lbl_word_day_step_goal', '28px', 304, 'calc(50% - 46px)', 20)}
${text('mainMenu_id_2026Walk_lbl_word_day_step_goal', 13, { muted: true })}
${place('mainMenu_id_2026Walk_lbl_varia_day_step_goal_number', '28px', 330, 'calc(50% - 76px)', 36)}
${text('mainMenu_id_2026Walk_lbl_varia_day_step_goal_number', 26, { bold: true })}
${place('mainMenu_id_2026Walk_lbl_word_walk_big_1', 'calc(50% - 46px)', 336, '24px', 28)}
${text('mainMenu_id_2026Walk_lbl_word_walk_big_1', 13, { muted: true })}

${place('mainMenu_id_2026Walk_lbl_word_sum_step', 'calc(50% + 18px)', 304, 'calc(50% - 46px)', 20)}
${text('mainMenu_id_2026Walk_lbl_word_sum_step', 13, { muted: true })}
${place('mainMenu_id_2026Walk_lbl_variable_sum_step_number', 'calc(50% + 18px)', 330, 'calc(50% - 76px)', 36)}
${text('mainMenu_id_2026Walk_lbl_variable_sum_step_number', 26, { bold: true })}
${place('mainMenu_id_2026Walk_lbl_word_walk_big_2', 'calc(100% - 52px)', 336, '24px', 28)}
${text('mainMenu_id_2026Walk_lbl_word_walk_big_2', 13, { muted: true })}

${place('mainMenu_id_2026Walk_lbl_word_average', '28px', 390, 'calc(100% - 180px)', 52)}
${text('mainMenu_id_2026Walk_lbl_word_average', 13, { muted: true })}
#mainMenu_id_2026Walk_lbl_variable_avg_all_step { left: auto !important; right: 48px !important; top: 390px !important; width: 110px !important; height: 52px !important; }
${text('mainMenu_id_2026Walk_lbl_variable_avg_all_step', 20, { bold: true, align: 'right' })}
#mainMenu_id_2026Walk_lbl_word_walk_small_2 { left: auto !important; right: 32px !important; top: 390px !important; width: 13px !important; height: 52px !important; }
${text('mainMenu_id_2026Walk_lbl_word_walk_small_2', 13, { muted: true, align: 'right' })}
/* 右寄せの数字と単位は、EZCraft の字の左右の余白（5px）をなくして、置いた位置どおりに並べる */
:is(#mainMenu_id_2026Walk_lbl_wtt_point, #mainMenu_id_2026Walk_lbl_word_Pt, #mainMenu_id_2026Walk_lbl_variable_avg_all_step, #mainMenu_id_2026Walk_lbl_word_walk_small_2) :is(.tcc-label, .tcc-label-text) { padding-left: 0 !important; padding-right: 0 !important; overflow: visible !important; }

/* 操作 */
${place('mainMenu_id_2026Walk_button_button_ranking_menu', '16px', 8, 'calc(50% - 22px)', 48)}
${place('mainMenu_id_2026Walk_button_set_step_goal', 'calc(50% + 6px)', 8, 'calc(50% - 22px)', 48)}
${row('mainMenu_id_2026Walk_btn_admin', 68, 44)}
${['mainMenu_id_2026Walk_btn_walk', 'mainMenu_id_2026Walk_button_button_ranking_menu', 'mainMenu_id_2026Walk_button_set_step_goal', 'mainMenu_id_2026Walk_btn_admin'].map(fillButton).join('')}

/* ---- ランキング: 題名・探す欄 / 個人・団体の切り替え / 1人（1チーム）1枚のカード / 更新日 ---- */
${fullWidth('ranking_id_2026Walk')}
#ranking_id_2026Walk,
#ranking_id_2026Walk_R2, #ranking_id_2026Walk_R3, #ranking_id_2026Walk_R4, #ranking_id_2026Walk_R5 { height: auto !important; }
#ranking_id_2026Walk .tcc-panel { border: none !important; background: transparent !important; box-shadow: none !important; }
#ranking_id_2026Walk_R2_C1, #ranking_id_2026Walk_blank4 { height: 28px !important; }
${place('ranking_id_2026Walk_lbl4', '16px', 4, 'calc(100% - 32px)', 22)}
${text('ranking_id_2026Walk_lbl4', 13, { muted: true })}
/* いつの集計か（小見出しと同じく、画面の左から 20pt） */
#ranking_id_2026Walk_lbl4 .tcc-label { padding-left: 0 !important; border-left-width: 0 !important; }
#ranking_id_2026Walk_lbl4 .tcc-label-text { padding-left: 4px !important; }
#ranking_id_2026Walk_R3_C1, #ranking_id_2026Walk_blank3 { height: 52px !important; }
${place('ranking_id_2026Walk_search_box_kojin', '16px', 4, 'calc(50% - 22px)', 40)}
${place('ranking_id_2026Walk_search_box_dantai', 'calc(50% + 6px)', 4, 'calc(50% - 22px)', 40)}
${fillInput('ranking_id_2026Walk_search_box_kojin')}
${fillInput('ranking_id_2026Walk_search_box_dantai')}
/* 一覧は、画面の下の端（ホームに戻るバーの上）まで。いつの集計かは、上の注意書きの行に出す（下の行 R5 は出さない） */
#ranking_id_2026Walk_R4_C1, #ranking_id_2026Walk_blank5 { height: calc(100vh - 96px - var(--myapp-safe-bottom, 0px)) !important; min-height: 420px; }
#ranking_id_2026Walk_R5 { display: none !important; }
#ranking_id_2026Walk_tab1 { left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; }
/* 個人・団体: 画面の幅に収まる切り替えスイッチ（2つを同じ幅で） */
#ranking_id_2026Walk_tab1 > ul.tcc-tab-head {
  display: flex !important; flex-wrap: nowrap !important; width: auto !important;
  margin: 0 16px !important; padding: 3px !important; box-sizing: border-box;
}
#ranking_id_2026Walk_tab1 > ul.tcc-tab-head > li { flex: 1 1 0 !important; min-width: 0 !important; }
#ranking_id_2026Walk_tab1 > ul.tcc-tab-head a { display: block !important; width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; text-align: center; padding-left: 0 !important; padding-right: 0 !important; }
#ranking_id_2026Walk_ranking_grd_kojin,
#ranking_id_2026Walk_ranking_grd_dantai { left: 16px !important; top: 8px !important; width: calc(100% - 32px) !important; height: calc(100% - 16px) !important; }
/* 氏名・団体名で探す欄も、ほかの検索欄と同じ形に */
${searchField('#ranking_id_2026Walk_search_box_kojin')}
${searchField('#ranking_id_2026Walk_search_box_dantai')}
/* ランキングがまだないとき: 大きな白いカードはやめて、トロフィーの印と文だけを真ん中に */
:is(#ranking_id_2026Walk_ranking_grd_kojin, #ranking_id_2026Walk_ranking_grd_dantai).myapp-empty,
:is(#ranking_id_2026Walk_ranking_grd_kojin, #ranking_id_2026Walk_ranking_grd_dantai).myapp-empty * { background: transparent !important; border: none !important; box-shadow: none !important; }
:is(#ranking_id_2026Walk_ranking_grd_kojin, #ranking_id_2026Walk_ranking_grd_dantai).myapp-empty::before {
  content: ''; position: absolute; z-index: 20; left: 50%; top: 50%; width: 48px; height: 48px; margin: -64px 0 0 -24px; pointer-events: none;
  background: var(--myapp-text2); opacity: 0.6;
  -webkit-mask: ${TROPHY_ICON} center / contain no-repeat;
  mask: ${TROPHY_ICON} center / contain no-repeat;
}
:is(#ranking_id_2026Walk_ranking_grd_kojin, #ranking_id_2026Walk_ranking_grd_dantai).myapp-empty::after { font-size: 15px !important; }
${cardGrid('ranking_id_2026Walk_ranking_grd_kojin', [[2], [1, 3, 8], [9, 10]], { 1: '順位', 3: 'ポイント', 8: '合計歩数', 9: '拠点', 10: 'チーム' }, { pager: true })}
${cardGrid('ranking_id_2026Walk_ranking_grd_dantai', [[2], [1, 3, 5]], { 1: '順位', 3: '平均ポイント', 5: '合計歩数' }, { pager: true })}
#ranking_id_2026Walk_R5_C1, #ranking_id_2026Walk_blank2 { height: 36px !important; }
${place('ranking_id_2026Walk_lbl_upDate', '16px', 4, 'calc(100% - 32px)', 24)}
${text('ranking_id_2026Walk_lbl_upDate', 13, { muted: true, align: 'right' })}
`,
  },
};
