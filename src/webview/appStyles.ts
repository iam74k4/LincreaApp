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

import { cardGrid, fillButton, fillInput, fillLabel, fullWidth, mobileDialog, place, row, sheetDialog, text } from './layout';
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
#${id} .tcc-label { justify-content: flex-start; padding: 0 !important; }
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
  border-radius: 20px;
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
/** 左に見出し（88px）、右に入力欄 */
function reserveRow(label: string, field: string, top: number, width = 'calc(100% - 120px)'): string {
  return `${place(R(label), '16px', top, '88px', 36)}
${text(R(label), 14, { muted: true })}
${place(R(field), '104px', top, width, 36)}
${fillInput(R(field))}`;
}
const HEALTH_RESERVE_CSS = `
${sheetDialog('MC_reserv_Input', [{ id: 'R1', height: 584 }], { scroll: true })}
${place(R('lbltytle1'), '16px', 12, 'calc(100% - 32px)', 28)}
${text(R('lbltytle1'), 17, { bold: true })}
#${R('btnClose')} { display: none !important; }
${reserveRow('lbl_reserv_input_datetime', 'reserv_input_date', 52, '150px')}
${reserveRow('lbl17', 'checkup_emp_nm_reserv', 96)}
${reserveRow('lbl15', 'cmbHonbu', 140)}
${place(R('cmbTeam'), '104px', 184, 'calc(100% - 120px)', 36)}
${fillInput(R('cmbTeam'))}
${reserveRow('lbl16', 'cmbMember', 228)}
${reserveRow('checkup_course_label', 'checkup_course_reserv', 272)}
${reserveRow('checkup_due_date_label', 'checkup_due_date', 316, '150px')}
${place(R('agency_type_reserv_label'), '16px', 360, 'calc(100% - 32px)', 24)}
${text(R('agency_type_reserv_label'), 14, { muted: true })}
${place(R('rdo1'), '16px', 386, 'calc(100% - 32px)', 108)}
${[1, 2, 3].map((n) => `#${R(`rdo1_${n}`)} { left: 8px !important; top: ${4 + (n - 1) * 34}px !important; width: calc(100% - 16px) !important; }`).join('\n')}
${place(R('agency_name_reserv_label'), '16px', 504, 'calc(100% - 32px)', 24)}
${text(R('agency_name_reserv_label'), 14, { muted: true })}
${place(R('agency_name_reserv'), '16px', 530, 'calc(100% - 32px)', 40)}
${fillInput(R('agency_name_reserv'))}
`;

// ---------------------------------------------------------------------------
// 健診の受診登録（MC_result_Input_1。本人）: 「受診登録」で出るダイアログ。予約の情報（読むだけ）→ 受診の情報（入力）
// ---------------------------------------------------------------------------
const H = (id: string) => `MC_result_Input_1_${id}`;
function resultRow(label: string, field: string, top: number, width = 'calc(100% - 120px)'): string {
  return `${place(H(label), '16px', top, '88px', 36)}
${text(H(label), 14, { muted: true })}
${place(H(field), '104px', top, width, 36)}
${fillInput(H(field))}`;
}
/** 見出しを上に、その下に幅いっぱいの部品 */
function resultBelow(label: string, field: string, top: number, height = 40): string {
  return `${place(H(label), '16px', top, 'calc(100% - 32px)', 22)}
${text(H(label), 14, { muted: true })}
${place(H(field), '16px', top + 24, 'calc(100% - 32px)', height)}
${fillInput(H(field))}`;
}
const HEALTH_RESULT_CSS = `
${sheetDialog('MC_result_Input_1', [{ id: 'R1', height: 976 }], { scroll: true })}
${place(H('lbltytle1'), '16px', 12, 'calc(100% - 32px)', 28)}
${text(H('lbltytle1'), 17, { bold: true })}
/* 閉じるは上の × と同じ。後ろの飾りの枠と、2回目の同じ注意書き（lbl22）は出さない */
#${H('btnClose')}, #${H('lbl23')}, #${H('lbl26')}, #${H('lbl22')} { display: none !important; }

/* 予約の情報（読むだけ） */
${place(H('lbl27'), '16px', 48, 'calc(100% - 32px)', 24)}
${resultRow('lbl_reserv_input_datetime', 'result_input_date', 76, '150px')}
${resultRow('lbl17', 'checkup_emp_nm', 120)}
${resultRow('lbl15', 'cmbHonbu', 164)}
${place(H('cmbTeam'), '104px', 208, 'calc(100% - 120px)', 36)}
${fillInput(H('cmbTeam'))}
${resultRow('lbl16', 'cmbMember', 252)}
${resultRow('checkup_course_label', 'checkup_course_reserv', 296)}
${resultRow('lbl18', 'checkup_due_date', 340, '150px')}
${resultBelow('lbl21', 'agency_name_reserv', 384)}
${row(H('lbl25'), 460, 36)}
${row(H('lbl28'), 496, 60)}

/* 受診の情報（入力） */
${place(H('lbl36'), '16px', 564, 'calc(100% - 32px)', 24)}
${resultRow('checkup_date_label', 'checkup_date', 592, '150px')}
${place(H('agency_type_reserv_label'), '16px', 640, 'calc(100% - 32px)', 22)}
${text(H('agency_type_reserv_label'), 14, { muted: true })}
${place(H('rdo11'), '16px', 664, 'calc(100% - 32px)', 108)}
${[1, 2, 3].map((n) => `#${H(`rdo11_${n}`)} { left: 8px !important; top: ${4 + (n - 1) * 34}px !important; width: calc(100% - 16px) !important; }`).join('\n')}
${resultBelow('agency_name_reserv_label', 'agency_name', 780)}
/* ふだんは出ない部品（場面によって EZCraft が出す）。出たときに重ならないよう、いちばん下に並べる */
${row(H('lbl24'), 852, 40)}
${place(H('lbl14'), '16px', 896, '88px', 36)}
${place(H('rdo13'), '104px', 896, 'calc(100% - 120px)', 36)}
${place(H('lbl13'), '16px', 936, '88px', 36)}
${place(H('rdo12'), '104px', 936, 'calc(100% - 120px)', 36)}
`;

// ---------------------------------------------------------------------------
// アプリごとの設定
// ---------------------------------------------------------------------------

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
    `,
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
  border-radius: 20px !important;
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
${mobileDialog('LP_password', 150)}
${place('LP_password_lbl1', '16px', 12, 'calc(100% - 32px)', 48)}
#LP_password_lbl1 * { max-width: 100% !important; white-space: normal !important; word-break: break-all; text-align: left !important; }
#LP_password_lbl1 .tcc-label { width: 100% !important; }
${place('LP_password_txt_password', '16px', 72, 'calc(100% - 32px)', 44)}
${fillInput('LP_password_txt_password')}
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
        var msg = n === '' ? '条件を選んで「検索」を押してください' : '見つかりませんでした';
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
#LIT_main_lbl_cond_cnt { left: auto !important; right: 34px !important; top: 240px !important; width: 96px !important; height: 24px !important; }
#LIT_main_lbl_cont_nin { left: auto !important; right: 16px !important; top: 240px !important; width: 18px !important; height: 24px !important; }
#LIT_main_lbl_cond_cnt .tcc-label-text { text-align: right !important; padding-right: 1px !important; }
#LIT_main_lbl_cont_nin .tcc-label, #LIT_main_lbl_cont_nin .tcc-label-text { padding: 0 !important; text-align: left !important; }
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
  border-radius: 20px !important;
  background-color: var(--myapp-fill) !important;
}
${row('LIT_main_btn_Execel', 664, 44)}
${fillButton('LIT_main_btn_Execel')}
/* Excel 出力のボタンが出ていない（ふつうの人）ときは、一覧を画面の下の端まで伸ばす（下に空いた場所を残さない）。
   最後のカードは、ホームに戻るバーの上まで上がる */
#LIT_main:not(:has(#LIT_main_btn_Execel:not([style*="visibility: hidden"]))) :is(#LIT_main_lit_tab, #LIT_main_lit_tab > .tcc-tab-content, #LIT_main_lit_tab_tabs_0) { overflow: visible !important; }
/* 一覧の上の端は、画面の上から 287px（ヘッダーの下から）。そこから画面の下の端まで */
#LIT_main:not(:has(#LIT_main_btn_Execel:not([style*="visibility: hidden"]))) #LIT_main_grd_exa_list { height: max(380px, calc(100vh - 290px)) !important; }
#LIT_main_grd_exa_list .TccGridBodyScroll { padding-bottom: calc(12px + var(--myapp-safe-bottom, 0px)) !important; box-sizing: border-box !important; }
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
  border-radius: 20px !important;
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
    mobileForms: ['mainMenu_id_2026Walk', 'ranking_id_2026Walk'],
    titles: { ranking_id_2026Walk: 'ランキング' },
    emptyGrids: {
      ranking_id_2026Walk_ranking_grd_kojin: 'まだランキングはありません',
      ranking_id_2026Walk_ranking_grd_dantai: 'まだランキングはありません',
    },
    // ランキング: 更新日の曜日が合っていないことがある（2026/11/13(日) など）。日付から曜日を出し直し、「時点分」は「時点」に
    script: `
      window.__myappAppUpdate = function () {
        // 歩数のカード: 単位の「歩」を、カードの右の端ではなく、数字のすぐ後ろに置く（数字の長さは毎日変わるので、測って置く）
        [['lbl_varia_day_step_goal_number', 'lbl_word_walk_big_1'], ['lbl_variable_sum_step_number', 'lbl_word_walk_big_2']].forEach(function (pair) {
          var num = document.getElementById('mainMenu_id_2026Walk_' + pair[0]);
          var unit = document.getElementById('mainMenu_id_2026Walk_' + pair[1]);
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
    bottomBars: { mainMenu_id_2026Walk: ['mainMenu_id_2026Walk_btn_walk'] },
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
    ],
    layout: `
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
#mainMenu_id_2026Walk_lbl_wtt_point { left: auto !important; right: 48px !important; top: 8px !important; width: 140px !important; height: 48px !important; }
#mainMenu_id_2026Walk_lbl_wtt_point,
#mainMenu_id_2026Walk_lbl_wtt_point * { overflow: visible !important; line-height: 48px !important; }
${text('mainMenu_id_2026Walk_lbl_wtt_point', 30, { bold: true, align: 'right' })}
#mainMenu_id_2026Walk_lbl_word_Pt { left: auto !important; right: 16px !important; top: 8px !important; width: 28px !important; height: 48px !important; }
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
#mainMenu_id_2026Walk_lbl_variable_avg_all_step { left: auto !important; right: 56px !important; top: 390px !important; width: 110px !important; height: 52px !important; }
${text('mainMenu_id_2026Walk_lbl_variable_avg_all_step', 20, { bold: true, align: 'right' })}
#mainMenu_id_2026Walk_lbl_word_walk_small_2 { left: auto !important; right: 28px !important; top: 390px !important; width: 24px !important; height: 52px !important; }
${text('mainMenu_id_2026Walk_lbl_word_walk_small_2', 13, { muted: true })}

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
${cardGrid('ranking_id_2026Walk_ranking_grd_kojin', [[2], [1, 3, 8], [9, 10]], { 1: '順位', 3: 'ポイント', 8: '合計歩数', 9: '拠点', 10: 'チーム' }, { pager: true })}
${cardGrid('ranking_id_2026Walk_ranking_grd_dantai', [[2], [1, 3, 5]], { 1: '順位', 3: '平均ポイント', 5: '合計歩数' }, { pager: true })}
#ranking_id_2026Walk_R5_C1, #ranking_id_2026Walk_blank2 { height: 36px !important; }
${place('ranking_id_2026Walk_lbl_upDate', '16px', 4, 'calc(100% - 32px)', 24)}
${text('ranking_id_2026Walk_lbl_upDate', 13, { muted: true, align: 'right' })}
`,
  },
};
