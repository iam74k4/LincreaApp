// £-TiMS 勤怠管理（アプリケーション ID: L_Tims）の見た目と動き。
//
// 画面は3つ:
//   frmLTiMSTop      … お知らせとメニュー（勤怠管理・勤怠申請・システム設定）
//   frmAttendance    … 勤務表。パソコン向けの月のカレンダーを、スマホでは縦の一覧にする
//                      （上に「今日」と「過ぎたのに未登録の日」を集め、その下にほかの日を日付の順に）
//   frmAttendanceDtl … 勤怠実績登録（1日分の入力）。入力欄をスマホの幅に並べ直す
//
// どれも見た目を変えるだけで、データの項目と EZCraft の動き（押したときの処理・登録）はそのまま。
import type { AppSkin } from './appStyles';
import { cardGrid, fillButton, fillInput, fillLabel, fullWidth, listToBottom, place, row, scoped, searchBox, searchField, sheetDialog, text } from './layout';

// ---------------------------------------------------------------------------
// メニュー（frmLTiMSTop）: 名前 → お知らせ → メニューのカード → 各種申請。タイトル・ロゴ・時計は出さない
//   EZCraft では、名前とカードが上の段（R1）、お知らせと各種申請が下の段（R2）にある。
//   お知らせをカードの上に出すため、上の段にお知らせの場所を空けて、お知らせ（R2 の中の部品）をそこへ上げる。
//   下の段の部品は、下の段の上の端（= 上の段の下の端）からの位置で置くので、上の段の高さのぶんだけ上にずらす。
// ---------------------------------------------------------------------------
/** 上の段（名前・お知らせの場所・カード）の高さ。お知らせの行の高さ（--myapp-ann）で変わる */
const TOP_R1 = (extra: number) => `calc(${extra}px + var(--myapp-ann, 150px))`;
const TOP_CSS = `
${fullWidth('frmLTiMSTop')}
#frmLTiMSTop,
#frmLTiMSTop_R1,
#frmLTiMSTop_R2 { height: auto !important; }
#frmLTiMSTop .tcc-tile.col { float: none !important; }

/* 上の段: 名前（12〜36）・お知らせの場所（48〜76＋お知らせ）・カード2枚 */
#frmLTiMSTop_R1_C2, #frmLTiMSTop_blank3 { height: ${TOP_R1(252)} !important; }
${place('frmLTiMSTop_lblUser', '16px', 12, 'calc(100% - 32px)', 24)}
#frmLTiMSTop_lblUser .tcc-label-text { text-align: left !important; }
#frmLTiMSTop_lblUser * { font-size: 15px !important; font-weight: 400 !important; color: var(--myapp-text2) !important; }
/* 人の印と名前のあいだを少し空ける（くっついて見えないように） */
#frmLTiMSTop_lblUser i { margin-right: 6px !important; }
/* 名前の行も、小見出し（お知らせ・各種申請）と同じく、画面の左から 20pt に */
#frmLTiMSTop_lblUser .tcc-label { padding-left: 0 !important; border-left-width: 0 !important; }
#frmLTiMSTop_lblUser .tcc-label-text { padding-left: 4px !important; }
/* カードは見出しだけ（説明の lbl1・lbl5 は出さない）。お知らせの下に並べる */
${row('frmLTiMSTop_btnAttendance', 96, 64)}
#frmLTiMSTop #frmLTiMSTop_btnAttendance { top: ${TOP_R1(96)} !important; }
${row('frmLTiMSTop_btnApply', 172, 64)}
#frmLTiMSTop #frmLTiMSTop_btnApply { top: ${TOP_R1(172)} !important; }
/* メニューのカード: マイアプリ・勤怠申請の一覧と同じく、左に色の付いた四角の印（白い線の絵）。EZCraft の小さな印は出さない */
#frmLTiMSTop_btnAttendance .tcc-btn > i, #frmLTiMSTop_btnApply .tcc-btn > i { display: none !important; }
/* fillButton（余白 0）より強く書く */
#frmLTiMSTop #frmLTiMSTop_btnAttendance .tcc-btn, #frmLTiMSTop #frmLTiMSTop_btnApply .tcc-btn {
  position: relative !important;
  justify-content: flex-start !important;
  align-items: center !important;
  padding: 0 16px 0 72px !important;
  font-size: 17px !important;
  line-height: 22px !important;
  color: var(--myapp-text) !important;
  text-align: left !important;
}
#frmLTiMSTop_btnAttendance .tcc-btn::before, #frmLTiMSTop_btnApply .tcc-btn::before {
  content: ''; position: absolute; left: 16px; top: 50%; width: 40px; height: 40px; margin-top: -20px; border-radius: 10px;
}
#frmLTiMSTop_btnAttendance .tcc-btn::before { background: #007AFF ${iconImage('M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M4 10h16 M8 3v4 M16 3v4')} center / 24px no-repeat; }
#frmLTiMSTop_btnApply .tcc-btn::before { background: #5856D6 ${iconImage('M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M14 3v5h5 M9 13h6 M9 17h6')} center / 24px no-repeat; }
/* お知らせの題名が2行になるときは、行の長さをそろえて折り返す（2行目が「す！」だけにならないように） */
#frmLTiMSTop_grdAnnouncement .TccGridBodyScroll td { text-wrap: balance; }
/* システム設定は、管理する人の仕事（パソコンで使う）。ふつうの人が押すと「権限がありません」になるので、スマホでは出さない */
#frmLTiMSTop_btnSettings { display: none !important; }
${fillButton('frmLTiMSTop_btnAttendance')}
${fillButton('frmLTiMSTop_btnApply')}

/* お知らせ。カードは、お知らせの行の高さに合わせる（JS の topAnnouncement が --myapp-ann に入れる。
   1件だけのときに、下に空の白い面が残らないように）。その下のメニューのカードも、それに合わせて上下する。
   お知らせは下の段（R2）の部品なので、上の段の高さ（TOP_R1(252)）のぶん上へ: 見出しは全体の 48、表は 76 から */
#frmLTiMSTop_R2, #frmLTiMSTop_R2_C1, #frmLTiMSTop_blank2, #frmLTiMSTop_blank2_body { overflow: visible !important; }
${place('frmLTiMSTop_lbl_announcement_title', '16px', 48 - 252, '160px', 24)}
#frmLTiMSTop #frmLTiMSTop_lbl_announcement_title { top: calc(-204px - var(--myapp-ann, 150px)) !important; }
/* 小見出し（お知らせ・各種申請）は、ほかの画面の小見出しと同じく文字だけに（ベル・紙の印は、文字にくっついて見える） */
#frmLTiMSTop_lbl_announcement_title i, #frmLTiMSTop_lbl12 i { display: none !important; }
${row('frmLTiMSTop_grdAnnouncement', 76 - 252, 150)}
#frmLTiMSTop #frmLTiMSTop_grdAnnouncement { top: calc(-176px - var(--myapp-ann, 150px)) !important; height: var(--myapp-ann, 150px) !important; }
${cardGrid('frmLTiMSTop_grdAnnouncement', [[3], [1, 2]])}
/* お知らせの、中身のない行（区切りの線だけが出る）は出さない。最後の行の下には線を引かない */
#frmLTiMSTop_grdAnnouncement .TccGridBodyScroll tr:not(:has(> td.frmLTiMSTop_grdAnnouncement_tdCol3:not([data-myapp-blank]))) { display: none !important; }
#frmLTiMSTop_grdAnnouncement .TccGridBodyScroll tr[data-myapp-last] { border-bottom: none !important; }
/* お知らせは読むだけ。押しても選んだ色を残さない（選ぶ意味のない表なので、青く光ったままにしない） */
#frmLTiMSTop_grdAnnouncement .TccGridBodyScroll tr.myapp-tapped,
#frmLTiMSTop_grdAnnouncement .TccGridBodyScroll tr.myapp-tapped > td { background-color: transparent !important; }
/* 各種申請: 下の段に残るのはこれだけ（下の段の上の端から） */
#frmLTiMSTop_R2_C1, #frmLTiMSTop_blank2 { height: 248px !important; }
${place('frmLTiMSTop_lbl12', '16px', 8, '160px', 24)}
${row('frmLTiMSTop_grdApply', 36, 196)}
${cardGrid('frmLTiMSTop_grdApply', [[3], [2, 1], [5, 6]])}
/* 申請中のものがないときは、「ありません」の一行ぶんの高さに */
#frmLTiMSTop_grdApply.myapp-empty { height: 72px !important; }
#frmLTiMSTop_R2:has(#frmLTiMSTop_grdApply.myapp-empty) #frmLTiMSTop_R2_C1,
#frmLTiMSTop_R2:has(#frmLTiMSTop_grdApply.myapp-empty) #frmLTiMSTop_blank2 { height: 124px !important; }
`;

// ---------------------------------------------------------------------------
// 勤務表（frmAttendance）: どのタブもスマホ向けにする。
//   - 枠（上の帯を隠す・健康管理時間・タブ）は、どのタブでも同じ（ATT_FRAME_CSS）
//   - 「勤務表」のタブ: 日の一覧（LIST_CSS）
//   - ほかのタブ（勤務集計表・勤務申請状況・勤務表出力・工数管理）: 検索の条件と、結果のカード（ATT_TABS_CSS）
// ---------------------------------------------------------------------------
const A = (id: string) => `frmAttendance_${id}`;
/** 一覧の1日分（.tcc-rpt-row）の中の部品 */
const DAY = {
  button: '[id^="frmAttendance_rptBtn"]',
  date: '[id^="frmAttendance_dispDt"]',
  icon: '[id^="frmAttendance_lblIcon"]',
  status: '[id^="frmAttendance_biko"]',
};

const ATT_FRAME_CSS = `
${fullWidth('frmAttendance')}
#frmAttendance { height: auto !important; }

/* いちばん上の帯（ロゴ・名前・閉じる）は出さない。名前は一覧の見出しにあり、閉じるはアプリの戻るで */
#${A('R1')} { display: none !important; }

/* 健康管理時間: 数字と目標を、棒で見せる（JS が .myapp-kenko を作る。元の文字は隠す） */
#${A('R2')}, #${A('R2_C1')}, #${A('blank3')}, #${A('blank3_body')} { height: 80px !important; }
/* 目標を超えたときだけ、注意の1行を出して高くする */
#${A('R2')}:has(.myapp-kenko:not([data-level="ok"])),
#${A('R2_C1')}:has(.myapp-kenko:not([data-level="ok"])),
#${A('blank3')}:has(.myapp-kenko:not([data-level="ok"])),
#${A('blank3_body')}:has(.myapp-kenko:not([data-level="ok"])) { height: 100px !important; }
${['lblTitle', 'lbl_kenko', 'lbl_kenko_hour', 'lbl56', 'lbl_sorodo', 'lbl_kenko_hour2', 'lbl_zerohe', 'lbl_kenko_hour1', 'lbl_genkin']
  .map((id) => `#${A(id)}`)
  .join(',\n')} { display: none !important; }
.myapp-kenko {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 8px;
  height: 64px;
  box-sizing: border-box;
  padding: 10px 16px;
  border-radius: 22px;
  background-color: var(--myapp-fill);
}
.myapp-kenko-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: var(--myapp-text2); }
.myapp-kenko-top b { font-size: 18px; font-weight: 700; color: var(--myapp-text); margin-right: 2px; }
.myapp-kenko[data-level="ok"] .myapp-kenko-note { display: none; }
.myapp-kenko:not([data-level="ok"]) { height: 84px; }
.myapp-kenko-bar { position: relative; height: 6px; margin: 8px 0 6px; border-radius: 3px; background-color: var(--myapp-border); }
.myapp-kenko-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background-color: var(--myapp-accent); }
.myapp-kenko[data-level="over"] .myapp-kenko-fill { background-color: var(--myapp-warn); }
.myapp-kenko[data-level="limit"] .myapp-kenko-fill { background-color: var(--myapp-danger); }
.myapp-kenko-mark { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background-color: var(--myapp-text2); }
.myapp-kenko-note { font-size: 11px; color: var(--myapp-text2); }
/* 組織（管理する人だけに出る）。出るときはカードの下に置く */
${place(A('lbl33'), '16px', 104, '72px', 40)}
${place(A('qbxDept1'), '88px', 104, 'calc(100% - 104px)', 40)}
${fillLabel(A('lbl33'))}
${fillInput(A('qbxDept1'))}
#${A('R2')}:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])),
#${A('R2')}:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) * { height: 152px !important; }

/* タブ。一覧の長さに合わせて伸びるように、タブとその中身を（座標で置かず）流して置く */
#${A('R3')}, #${A('R3_C1')}, #${A('blank2')}, #${A('blank2_body')} { height: auto !important; overflow: visible !important; }
#${A('tabAttd')} { position: relative !important; top: 0 !important; left: 0 !important; display: block !important; height: auto !important; }
#${A('tabAttd')} > .tcc-tab-content,
#${A('tabAttd_tabs_0')} {
  position: relative !important;
  top: 0 !important;
  left: 0 !important;
  height: auto !important;
  overflow: visible !important;
}
/* タブの見出し: ふだんは画面の下のガラスのタブ（tabBars）に出すので、ここには出さない。
   下のタブが作れなかったときだけ、横に並べる（はみ出したら横にスクロール） */
#${A('tabAttd')}[data-myapp-tabbar] > ul.tcc-tab-head { display: none !important; }
#${A('tabAttd')}:not([data-myapp-tabbar]) > ul.tcc-tab-head {
  display: flex !important;
  flex-wrap: nowrap !important;
  overflow-x: auto;
  padding: 0 16px !important;
  box-sizing: border-box;
}
#${A('tabAttd')} > ul.tcc-tab-head > li { flex: none !important; }
#${A('tabAttd')} > ul.tcc-tab-head a { font-size: 14px !important; white-space: nowrap; }
`;

// 「勤務表」のタブ: 日の一覧
const LIST_CSS = `
/* 上の 64px（管理する人は 112px）は、座標で置く部品（勤務年月・社員名）の場所。その下に、月の集計・勤務表申請・日の一覧を流す */
#${A('tabAttd_tabs_0')} {
  display: flex !important;
  flex-direction: column !important;
  padding: 64px 0 32px !important;
  box-sizing: border-box !important;
}
#frmAttendance:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) #${A('tabAttd_tabs_0')} { padding-top: 112px !important; }

/* 勤務年月: 「‹ 2026/11 ›」の1つのカプセル（JS が .myapp-month-nav を作り、‹ › で月を変えて読み込む）。
   真ん中の年月を押すと、カレンダーから選べる。社員名と検索は、管理する人だけ（管理する人は、これまでどおり欄を並べる） */
${place(A('lbl13'), '16px', 12, '72px', 40)}
${place(A('yrmWork'), '64px', 12, 'calc(100% - 128px)', 44)}
#${A('btnCalendarSearch')} { left: auto !important; right: 16px !important; top: 12px !important; width: 96px !important; height: 40px !important; }
${place(A('lbl14'), '16px', 60, '72px', 40)}
${place(A('qbxEmp1'), '88px', 60, 'calc(100% - 104px)', 40)}
${[A('lbl13'), A('lbl14')].map((id) => text(id, 13, { muted: true })).join('')}
${[A('yrmWork'), A('qbxEmp1')].map(fillInput).join('')}
${fillButton(A('btnCalendarSearch'))}
#${A('btnCalendarSearch')}, #${A('lbl13')}, #${A('lbl14')}, #${A('qbxEmp1')} { display: none !important; }
#frmAttendance #${A('yrmWork')} { z-index: 31 !important; }
/* カレンダーのアイコンの前の区切りの線は出さない */
#frmAttendance #${A('yrmWork')} div.icon-rt,
#frmAttendance #${A('yrmWork')} div.icon-rt * { border: none !important; box-shadow: none !important; color: var(--myapp-accent) !important; }
#frmAttendance #${A('yrmWork')} input {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  text-align: center !important;
  font-size: 17px !important;
  font-weight: 600 !important;
  padding: 0 28px !important;
  font-variant-numeric: tabular-nums;
}
.myapp-month-nav {
  position: absolute;
  top: 12px;
  left: 16px;
  right: 16px;
  height: 44px;
  z-index: 30;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 22px;
  background-color: var(--myapp-fill);
}
.myapp-month-nav button {
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 22px;
  background: transparent;
  color: var(--myapp-accent);
  font-size: 28px;
  line-height: 1;
  /* ‹ › の字は下寄りに描かれるので、少し上げて、真ん中の年月と高さをそろえる */
  padding-bottom: 4px;
}
.myapp-month-nav button:active { background-color: var(--myapp-tab-on); }
#frmAttendance:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) .myapp-month-nav { display: none; }
#frmAttendance:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) #${A('yrmWork')} { left: 88px !important; width: 136px !important; height: 40px !important; }
#frmAttendance:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) #${A('yrmWork')} input {
  background-color: var(--myapp-field) !important;
  border: 1px solid var(--myapp-field-border) !important;
  text-align: left !important;
  font-size: 16px !important;
  font-weight: 400 !important;
  padding: 0 28px 0 10px !important;
}
#frmAttendance:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) #${A('btnCalendarSearch')},
#frmAttendance:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) #${A('lbl13')},
#frmAttendance:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) #${A('lbl14')},
#frmAttendance:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) #${A('qbxEmp1')} { display: block !important; }
#${A('lblWkApply')}, #${A('lin1')}, #${A('lblBack')} { display: none !important; }

/* 月の集計: 表は隠して、0 でない項目だけを小さな札で見せる（JS が .myapp-att-summary を作る） */
#${A('grdWorkTotal')} {
  position: absolute !important;
  top: 0 !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
}
.myapp-att-summary {
  order: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
  gap: 10px 8px;
  margin: 0 16px 12px;
  padding: 12px 16px;
  border-radius: 22px;
  background-color: var(--myapp-fill);
}
/* 押せないので、ボタンや札の形にはしない（名前を小さく、数字を大きく） */
.myapp-att-chip { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--myapp-text2); white-space: nowrap; }
.myapp-att-chip b { font-size: 17px; font-weight: 600; color: var(--myapp-text); font-variant-numeric: tabular-nums; }
.myapp-att-chip[data-kind="status"] b { color: var(--myapp-accent-text); }

/* 日の一覧。ページといっしょにスクロールするように、ほかの部品の下に流して置く */
#${A('rptWork')} {
  order: 3;
  position: relative !important;
  top: auto !important;
  left: 16px !important;
  width: calc(100% - 32px) !important;
  height: auto !important;
  margin: 0 !important;
  border: none !important;
  background: var(--myapp-bg) !important;
}
/* 一覧の見出し（年月・社員）は勤務年月と重なるので、管理する人（ほかの人の表も見る）にだけ出す */
#${A('rptWork')} .tcc-rpt-header { display: none !important; }
#frmAttendance:has(#${A('qbxDept1')}:not([style*="visibility: hidden"])) #${A('rptWork')} .tcc-rpt-header { display: flex !important; }
#${A('rptWork')} .tcc-rpt-header {
  background: transparent !important;
  border: none !important;
  padding: 0 4px !important;
  height: 28px !important;
}
#${A('rptWork')} .tcc-rpt-header * {
  color: var(--myapp-text2) !important;
  font-size: 13px !important;
  font-weight: 600 !important;
}
#${A('rptWork')} .tcc-rpt-body {
  display: flex !important;
  flex-direction: column !important;
  flex-wrap: nowrap !important;
  gap: 6px;
  height: auto !important;
  overflow: visible !important;
  background: transparent !important;
}
.myapp-att-head {
  padding: 14px 4px 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--myapp-text2);
}
#${A('rptWork')} .tcc-rpt-row {
  flex: none !important;
  width: 100% !important;
  height: 52px !important;
  min-height: 52px !important;
  background: transparent !important;
  border: none !important;
}
#${A('rptWork')} .tcc-rpt-row[data-myapp-day="blank"] { display: none !important; }
/* 休日は、低く控えめな行に（働く日のほうを見つけやすく） */
#${A('rptWork')} .tcc-rpt-row[data-myapp-day="off"] { height: 44px !important; min-height: 44px !important; }
.tcc-rpt-row[data-myapp-day="off"] ${DAY.button} .tcc-btn { background-color: var(--myapp-card-muted) !important; }

/* 1日分: 地（ボタン）の上に、行いっぱいの日付（押すとその日の登録を開く）・アイコン・状態を重ねる */
${DAY.button} { left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; }
${DAY.button} .tcc-btn-group,
${DAY.button} .tcc-btn {
  width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
  border: none !important;
  border-radius: 18px !important;
  background-color: var(--myapp-fill) !important;
}
${DAY.button} .tcc-btn::after {
  content: '›';
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 24px;
  color: var(--myapp-text2);
}
${DAY.date} { left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; }
${DAY.date} .tcc-label {
  width: 100% !important;
  height: 100% !important;
  justify-content: flex-start !important;
  padding: 0 0 0 16px !important;
  box-sizing: border-box !important;
}
${DAY.date} .tcc-label-text {
  width: auto !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: var(--myapp-text) !important;
  text-align: left !important;
}
${DAY.icon} { left: 112px !important; top: 0 !important; width: 24px !important; height: 100% !important; }
${DAY.icon} .tcc-label { width: 100% !important; height: 100% !important; justify-content: center !important; padding: 0 !important; }
${DAY.icon} .tcc-label-text { font-size: 16px !important; }
/* アイコンは EZCraft が付けた色（出勤は緑・休暇はオレンジ・未登録は灰色）のまま。JS が行に --myapp-day-color を入れる */
${DAY.icon} i { color: var(--myapp-day-color, var(--myapp-text2)) !important; }
${DAY.status} { left: auto !important; right: 36px !important; top: 0 !important; width: 45% !important; height: 100% !important; }
${DAY.status} .tcc-label {
  width: 100% !important;
  height: 100% !important;
  justify-content: flex-end !important;
  padding: 0 !important;
  background: transparent !important;
}
${DAY.status} .tcc-label-text { width: auto !important; font-size: 15px !important; text-align: right !important; }
/* 申請の札（日付の左肩）・LSmart Holiday の札・テレワークのしるし */
#${A('rptWork')} .ribon span {
  left: 0 !important;
  top: 0 !important;
  width: auto !important;
  height: 16px !important;
  transform: none !important;
  padding: 0 8px !important;
  border-radius: 18px 0 10px 0 !important;
  font-size: 11px !important;
  line-height: 16px !important;
  text-align: left !important;
  /* 申請の札（有休など）は、エラーに見える赤をやめて、差し色の薄い地に */
  background: var(--myapp-tab-on) !important;
  color: var(--myapp-accent-text) !important;
}
#${A('rptWork')} .tcc-rpt-row[data-myapp-dupbadge] .ribon { display: none !important; }
/* L-SMART Holiday の札は、行の右上の肩に（左上の申請の札と同じ形）。
   行の真ん中に置くと、狭い画面（390pt 以下）で右の「残業 0:30」などとくっつくため */
#${A('rptWork')} .lsmartHl {
  left: auto !important;
  right: 0 !important;
  top: 0 !important;
  transform: none !important;
  width: auto !important;
  height: 16px !important;
  padding: 0 8px !important;
  border-radius: 0 18px 0 10px !important;
  font-size: 11px !important;
  line-height: 16px !important;
  background-color: var(--myapp-success-bg) !important;
  color: var(--myapp-success) !important;
}
#${A('rptWork')} .teleWk { left: auto !important; right: 36px !important; top: 2px !important; }
/* 札がある日は、テレワークのしるしを下の端に（右上の札と重ならないように） */
#${A('rptWork')} .tcc-rpt-row:has(.lsmartHl) .teleWk { top: auto !important; bottom: 2px !important; }

/* 押した日: 次の画面（勤怠実績登録）が開くまで、行を少し沈め、右の › を読み込み中の印にする（JS が myapp-opening を付ける） */
.tcc-rpt-row.myapp-opening ${DAY.button} .tcc-btn { background-color: var(--myapp-pressed-bg) !important; }
.tcc-rpt-row.myapp-opening ${DAY.button} .tcc-btn::after {
  content: '' !important;
  right: 14px;
  width: 16px;
  height: 16px;
  margin-top: -8px;
  transform: none;
  border-radius: 50%;
  border: 2px solid var(--myapp-border);
  border-top-color: var(--myapp-text2);
  animation: myapp-spin 0.8s linear infinite;
}

/* 今日（青い枠と日付）・過ぎたのに未登録の日（左の線と状態をオレンジに）・休日（日付を灰色に） */
.tcc-rpt-row[data-myapp-day="today"] ${DAY.button} .tcc-btn { box-shadow: inset 0 0 0 2px var(--myapp-accent) !important; }
.tcc-rpt-row[data-myapp-day="today"] ${DAY.date} .tcc-label-text { color: var(--myapp-accent) !important; }
.tcc-rpt-row[data-myapp-day="todo"] ${DAY.button} .tcc-btn { box-shadow: inset 4px 0 0 var(--myapp-warn) !important; }
.tcc-rpt-row[data-myapp-day="todo"] ${DAY.status} .tcc-label-text { color: var(--myapp-warn) !important; font-weight: 600 !important; }
.tcc-rpt-row[data-myapp-day="off"] ${DAY.date} .tcc-label-text { color: var(--myapp-text2) !important; font-weight: 400 !important; }
/* 休日のアイコンは赤（エラーに見える）をやめて灰色に。先の日（まだ来ていない未登録）は、日付も状態も控えめに */
.tcc-rpt-row[data-myapp-day="off"] ${DAY.icon} i { color: var(--myapp-text2) !important; }
.tcc-rpt-row[data-myapp-day="future"] ${DAY.date} .tcc-label-text { font-weight: 400 !important; }
.tcc-rpt-row[data-myapp-day="future"] ${DAY.status} .tcc-label-text { color: var(--myapp-text2) !important; }

/* 勤務表申請（と、承認する人の承認・取消）: ふだんは日の一覧の下に控えめに。月末（25日から）と過ぎた月は、月の集計のすぐ下に青く（JS が data-myapp-monthend を付ける）。
   隠れているものは場所もとらない */
#${A('btnApply')}, #${A('btnApprove')}, #${A('btnCancel')} {
  order: 5;
  position: relative !important;
  top: auto !important;
  left: 16px !important;
  width: calc(100% - 32px) !important;
  height: 44px !important;
  margin: 0 0 12px !important;
}
/* 日の一覧が出るまでは出さない（読み込みの途中に、同じ場所に別のボタンが出て押し間違えないように。JS が data-myapp-days を付ける） */
#frmAttendance:not([data-myapp-days]) #${A('btnApply')},
#frmAttendance:not([data-myapp-days]) #${A('btnApprove')},
#frmAttendance:not([data-myapp-days]) #${A('btnCancel')} { visibility: hidden !important; }
#${A('btnApply')}[style*="visibility: hidden"],
#${A('btnApprove')}[style*="visibility: hidden"],
#${A('btnCancel')}[style*="visibility: hidden"] { display: none !important; }
${[A('btnApply'), A('btnApprove'), A('btnCancel')].map(fillButton).join('')}
#${A('btnApply')}, #${A('btnApprove')}, #${A('btnCancel')} { margin-top: 12px !important; }
#frmAttendance[data-myapp-monthend] #${A('btnApply')},
#frmAttendance[data-myapp-monthend] #${A('btnApprove')},
#frmAttendance[data-myapp-monthend] #${A('btnCancel')} { order: 2 !important; margin-top: 0 !important; }
#frmAttendance[data-myapp-monthend] #${A('btnApply')} .tcc-btn,
#frmAttendance[data-myapp-monthend] #${A('btnApply')} .tcc-btn i {
  background: var(--myapp-tint) !important;
  color: #FFFFFF !important;
  box-shadow: var(--myapp-tint-shadow) !important;
}
`;


// ほかのタブ: 検索の条件（JS が .myapp-search に1行ずつ並べ直す）と、結果の一覧（1件1枚のカード）。
// 一覧はページといっしょにスクロールさせる（一覧の中だけのスクロールにしない）
// 検索の条件（JS が .myapp-search に1行ずつ並べ直す）の見た目。勤務表のほかのタブと、勤怠申請のほかのタブで同じ
const SEARCH_CSS = `
.myapp-search { display: flex; flex-direction: column; gap: 12px; padding: 0 16px; }
/* 見出しは1行（プロジェクト など6文字まで）。それより長い（給与データ処理状況 など）ときだけ2行に折り返す */
.myapp-search .myapp-row > .myapp-heading .tcc-label { display: flex !important; align-items: center !important; height: 100% !important; }
.myapp-search .myapp-row > .myapp-heading .tcc-label,
.myapp-search .myapp-row > .myapp-heading .tcc-label-text { white-space: nowrap !important; font-size: 13px !important; line-height: 1.3 !important; }
.myapp-search .myapp-row > .myapp-heading.myapp-long .tcc-label,
.myapp-search .myapp-row > .myapp-heading.myapp-long .tcc-label-text { white-space: normal !important; }
/* チェックボックス（テレワーク）は、見出しと同じ高さに */
.myapp-search .myapp-row:has(> .myapp-choice) { align-items: center !important; }
.myapp-search .myapp-row:has(> .myapp-choice) > .myapp-heading { height: 40px !important; }
.myapp-search .myapp-row > .myapp-choice { min-height: 40px; }
.myapp-search .myapp-row > .myapp-choice.chkbox,
.myapp-search .myapp-row > .myapp-choice .chkbox { position: relative !important; top: 0 !important; height: 40px !important; padding-top: 10px !important; box-sizing: border-box !important; }
/* 1つだけのチェックボックス（工数のテレワーク など）: 四角は label の ::before に描いてある。見えない入力欄が上にあると、
   label がその下に押し下げられて、四角が見出しより 20px ほど下に出る。入力欄を重ねて置き、label を行の真ん中に */
.myapp-search .myapp-row > .myapp-choice.chkbox { padding-top: 0 !important; align-items: center !important; }
.myapp-search .myapp-row > .myapp-choice.chkbox > input,
.myapp-search .myapp-choice-wrap > .myapp-choice > input { position: absolute !important; left: 0 !important; top: 12px !important; margin: 0 !important; }
/* 組の中のチェックボックスも、見えない入力欄に場所を取らせない（長い名前が、四角の下の行に落ちないように） */
.myapp-search .myapp-choice-wrap > .myapp-choice > label { white-space: nowrap !important; }
/* 検索の条件が多い画面（申請検索など）は、ふだんは閉じておき、結果を先に見せる（JS が .myapp-collapsible とボタンを付ける） */
.myapp-search-toggle {
  -webkit-appearance: none;
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 44px;
  padding: 0 16px;
  border: none;
  border-radius: 22px;
  background-color: var(--myapp-fill);
  color: var(--myapp-text);
  font-size: 15px;
  font-weight: 600;
}
.myapp-search-toggle-value { margin-left: auto; margin-right: 10px; font-weight: 400; color: var(--myapp-text2); font-variant-numeric: tabular-nums; }
/* › を回して ⌄ / ⌃ にする。字の箱は横に広く、字が片寄っているので、正方形の箱の真ん中に置いてから回す（開け閉めで横にずれない） */
.myapp-search-toggle::after {
  content: '›';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  margin-right: -4px;
  font-size: 22px;
  line-height: 1;
  color: var(--myapp-text2);
  transform: rotate(90deg);
  transition: transform 0.2s;
}
.myapp-search.myapp-open .myapp-search-toggle::after { transform: rotate(-90deg); }
.myapp-search.myapp-collapsible:not(.myapp-open) > .myapp-row,
.myapp-search.myapp-collapsible:not(.myapp-open) > .myapp-search-actions { display: none !important; }
/* CSV出力など（JS が .myapp-export に移す）: 条件を閉じていても見える、幅いっぱいのボタン。左に「書き出す」の印 */
.myapp-search > .myapp-export { display: flex; gap: 10px; }
.myapp-search > .myapp-export > .tcc-component {
  position: relative !important; left: auto !important; top: auto !important;
  flex: 1 1 0 !important; width: auto !important; height: 44px !important;
}
.myapp-search > .myapp-export .tcc-btn { color: var(--myapp-accent-text) !important; font-weight: 600 !important; }
.myapp-search > .myapp-export .tcc-btn i { display: none !important; }
.myapp-search > .myapp-export .tcc-btn::before {
  content: ''; display: inline-block; width: 18px; height: 18px; margin-right: 6px; vertical-align: -3px;
  background-color: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19h14'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19h14'/%3E%3C/svg%3E") center / contain no-repeat;
}
/* チェックボックスの組（表示対象・申請状況 など。JS が .myapp-choice-wrap にまとめる）: それぞれの幅のまま、横に並べて折り返す */
.myapp-search .myapp-choice-wrap { flex: 1 1 0; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; column-gap: 18px; row-gap: 0; }
.myapp-search .myapp-row:has(> .myapp-choice-wrap) { align-items: flex-start !important; }
.myapp-search .myapp-choice-wrap > .myapp-choice {
  position: relative !important; left: auto !important; top: auto !important;
  /* 2列にそろえる（文字の長さで左の位置がばらばらにならないように） */
  flex: 0 0 calc(50% - 9px) !important; width: auto !important; height: 40px !important; min-height: 0;
  padding: 10px 0 0 !important; box-sizing: border-box !important;
}
.myapp-search .myapp-choice-wrap > .myapp-choice > *,
.myapp-search .myapp-choice-wrap > .myapp-choice label,
.myapp-search .myapp-choice-wrap > .myapp-choice .tcc-label-text {
  position: relative !important; left: auto !important; top: auto !important;
  width: auto !important; white-space: nowrap !important; display: inline-flex !important; flex-direction: row !important;
}
/* 選択肢（申請ステータス など）は、短いので横に並べて折り返す */
.myapp-search .myapp-row > .myapp-choice,
.myapp-search .myapp-row > .myapp-choice .tcc-radio-group { display: flex !important; flex-direction: row !important; flex-wrap: wrap !important; align-items: center; column-gap: 14px; }
.myapp-search .myapp-row > .myapp-choice .tcc-component { width: auto !important; padding: 0 4px !important; }
.myapp-search .myapp-row.myapp-hidden { display: none !important; }
/* 注意書き（長い文）: 幅いっぱいに、小さな灰色の文字で */
.myapp-search .myapp-note-row > .myapp-note { position: relative !important; left: auto !important; top: auto !important; width: 100% !important; height: auto !important; }
.myapp-search .myapp-note-row > .myapp-note .tcc-label,
.myapp-search .myapp-note-row > .myapp-note .tcc-label-text { width: 100% !important; height: auto !important; white-space: normal !important; text-align: left !important; font-size: 13px !important; color: var(--myapp-text2) !important; }
/* スイッチの行（承認済も含める など）: 見出しを左に、スイッチを右に（iOS の設定の行と同じ） */
.myapp-search .myapp-switch-row { align-items: center !important; justify-content: space-between; min-height: 44px; padding: 0 12px 0 0; border-radius: 16px; background-color: var(--myapp-fill); }
.myapp-search .myapp-switch-row > .myapp-heading { flex: 1 1 auto !important; min-width: 0 !important; width: auto !important; max-width: none !important; height: 44px !important; }
.myapp-search .myapp-switch-row > .myapp-heading .tcc-label,
.myapp-search .myapp-switch-row > .myapp-heading .tcc-label-text { width: auto !important; max-width: none !important; display: flex !important; align-items: center !important; }
.myapp-search .myapp-switch-row > .myapp-heading .tcc-label,
.myapp-search .myapp-switch-row > .myapp-heading .tcc-label-text { white-space: nowrap !important; font-size: 15px !important; color: var(--myapp-text) !important; padding-left: 16px !important; }
/* 見出しの左の余白は、外の .tcc-label だけに付ける（中の文字にも付くと、二重になって 32px 右に寄る） */
.myapp-search .myapp-switch-row > .myapp-heading .tcc-label-text { padding-left: 0 !important; }
.myapp-search .myapp-switch-row > .myapp-switch-field { position: relative !important; left: auto !important; top: auto !important; flex: none !important; }
/* スイッチの部品は、箱（40px）の上に寄せて描かれるので、箱の中で上下の真ん中に置く（行の見出しと高さをそろえる） */
.myapp-search .myapp-switch-row > .myapp-switch-field { display: flex !important; align-items: center !important; }
/* 年月の欄の右に「前の月・次の月」（勤務表のタブと同じ見た目） */
.myapp-month-pill {
  flex: 1 1 0;
  min-width: 0;
  height: 44px;
  display: flex;
  align-items: center;
  border-radius: 22px;
  background-color: var(--myapp-fill);
}
.myapp-month-pill > button {
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 22px;
  background: transparent;
  color: var(--myapp-accent);
  font-size: 28px;
  line-height: 1;
}
.myapp-month-pill > button:active { background-color: var(--myapp-tab-on); }
.myapp-month-pill > .myapp-field {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  flex: 1 1 0 !important;
  min-width: 0 !important;
  width: auto !important;
  height: 44px !important;
}
.myapp-month-pill > .myapp-field input {
  box-sizing: border-box !important;
  width: 100% !important;
  height: 100% !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  text-align: center !important;
  font-size: 17px !important;
  font-weight: 600 !important;
  padding: 0 28px !important;
}
.myapp-month-pill > .myapp-field > div.icon-rt { left: auto !important; right: 0 !important; top: 0 !important; height: 100% !important; display: flex !important; align-items: center; }
.myapp-month-pill > .myapp-field div.icon-rt,
.myapp-month-pill > .myapp-field div.icon-rt * { border: none !important; color: var(--myapp-accent) !important; }
.myapp-month-nav { display: flex; gap: 8px; flex: none; }
.myapp-month-nav button {
  width: 44px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background-color: var(--myapp-fill);
  color: var(--myapp-accent);
  font-size: 26px;
  line-height: 1;
}
.myapp-month-nav button:active { opacity: 0.6; }
.myapp-search-actions { display: flex; gap: 10px; }
.myapp-search-actions > .tcc-component {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  flex: 1 1 0 !important;
  width: auto !important;
  height: 44px !important;
}
.myapp-search-actions > .myapp-search-go .tcc-btn {
  background: var(--myapp-tint) !important;
  color: #FFFFFF !important;
  border: 1px solid rgba(255, 255, 255, 0.35) !important;
  box-shadow: var(--myapp-tint-shadow) !important;
}
.myapp-search-actions > .myapp-search-go .tcc-btn i { color: #FFFFFF !important; }
/* 一括の操作（一括承認・一括却下）: 検索のボタンとは分けて、一覧の上に小さく。一覧が空なら出さない */
.myapp-bulk { display: flex; align-items: center; gap: 8px; }
.myapp-bulk > .tcc-component { position: relative !important; left: auto !important; top: auto !important; }
.myapp-bulk > .tcc-component.btn { flex: none !important; width: auto !important; height: 36px !important; }
.myapp-bulk > .tcc-component.btn .tcc-btn { padding: 0 14px !important; font-size: 14px !important; }
.myapp-bulk > .tcc-component.chkbox { flex: 1 1 auto !important; width: auto !important; height: 36px !important; display: flex !important; align-items: center !important; }
.tcc-tab-pane:has(.tcc-component.grid.myapp-empty) .myapp-bulk { display: none !important; }
`;

/** 一覧の表を、ページといっしょにスクロールする「1件1枚のカード」の並びにする（列の並べ方は cardGrid で） */
function flowGrid(gridId: string): string {
  return `
#${gridId} {
  position: relative !important;
  left: 0 !important;
  top: auto !important;
  width: 100% !important;
  height: auto !important;
  min-height: 96px;
  padding-bottom: 52px !important;
  box-sizing: border-box !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
}
/* 1件ずつ、角の丸い面にする（勤務表のタブの日の一覧と同じ） */
#${gridId} .TccGridBodyScroll tr {
  width: calc(100% - 32px) !important;
  margin: 0 16px 8px !important;
  padding: 12px 16px !important;
  border: none !important;
  border-radius: 20px !important;
  background-color: var(--myapp-fill) !important;
}
#${gridId} .TccGridBodyScroll td { text-align: left !important; }
/* 一覧の外枠・表の線は出さない（面と面のすきまで区切る） */
#${gridId} div,
#${gridId} table { border: none !important; box-shadow: none !important; }
#${gridId}[data-myapp-onepage] { padding-bottom: 0 !important; }
#${gridId} .TccScrollOuter,
#${gridId} .TccGridBodyScroll { position: relative !important; height: auto !important; overflow: visible !important; }`;
}

const ATT_TAB_GRIDS = ['grdTotal', 'grdApplyStat', 'grdAttd', 'grdPrj'];
const ATT_TAB_BUTTONS = ['btnTotalSearch', 'btnTotalDownload', 'btnApplyStatSearch', 'btnAttdSearch', 'btnAttdDounload', 'btnPrjSearch', 'btnPrjDounload'];
const ATT_TABS_CSS = `
#${A('tabAttd')} > .tcc-tab-content > .tcc-tab-pane.active {
  position: relative !important;
  top: 0 !important;
  left: 0 !important;
  height: auto !important;
  overflow: visible !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px;
  padding: 12px 0 32px !important;
  box-sizing: border-box !important;
}
#${A('tabAttd')} .tcc-tab-pane > .tcc-component.hline { display: none !important; }
/* 健康管理時間の帯は、「勤務表」のタブだけに出す（ほかのタブに同じものが出ても場所を取るだけ）。
   組織の欄（管理する人だけ）が出ているときは、その欄のために上の段を残す。
   （この CSS は :root.myapp-att-tab を頭に付けて入れる。( ) の中の , には付けない: layout.ts の scoped） */
.myapp-kenko { display: none !important; }
${['R2', 'R2_C1', 'blank3', 'blank3_body']
  .map((id) => `#frmAttendance:not(:has(#${A('qbxDept1')}:not([style*="visibility: hidden"]))) #${A(id)}`)
  .join(',\n')} { height: 0 !important; min-height: 0 !important; overflow: hidden !important; }
${SEARCH_CSS}
${ATT_TAB_BUTTONS.map((id) => fillButton(A(id))).join('')}

/* 勤務申請状況: まだ申請していない月は、名前の下にそう書く（申請状況の欄が空のとき） */
#${A('grdApplyStat')} .TccGridBodyScroll tr:has(> td.${A('grdApplyStat')}_tdCol3[data-myapp-blank]) > td.${A('grdApplyStat')}_tdCol2::after {
  content: 'まだ申請していません';
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 400;
  color: var(--myapp-text2);
}
/* 勤務表出力: 日付を「11/01(日)」で（JS の outputDates が data-myapp-date に入れる。元の 2026/11/01 は隠す） */
#${A('grdAttd')} .TccGridBodyScroll td.${A('grdAttd')}_tdCol1[data-myapp-date] > * { font-size: 0 !important; }
#${A('grdAttd')} .TccGridBodyScroll td.${A('grdAttd')}_tdCol1[data-myapp-date]::before { content: attr(data-myapp-date); font-size: 16px; }
/* 勤務表出力: 出勤の記録がない日（休日など）は、日付だけの空のカードにならないよう、そう書く */
#${A('grdAttd')} .TccGridBodyScroll tr:has(> td.${A('grdAttd')}_tdCol10[data-myapp-blank]):has(> td.${A('grdAttd')}_tdCol21[data-myapp-blank]) > td.${A('grdAttd')}_tdCol1::after {
  content: '勤務の記録なし';
  margin-left: 10px;
  font-size: 13px;
  font-weight: 400;
  color: var(--myapp-text2);
}
/* 結果: 1件1枚のカード。見出しの列は隠し、要る列だけを並べる */
${cardGrid(A('grdPrj'), [[3], [5], [9, 8, 4], [10]], { 9: '作業時間', 8: '作業内訳', 4: 'No.' }, { pager: true })}
${cardGrid(A('grdTotal'), [[2], [3, 4], [6, 12, 16, 17], [24, 23, 18]], { 4: '申請', 6: '出勤', 12: '有休', 16: '欠勤', 17: '代休', 24: '総労働', 23: '総残業', 18: '平日時間外' }, { pager: true })}
/* 集計の数字は、勤務表のまとめと同じく、見出しの下に大きな数字を4列で並べる（1行の文の中に並べない） */
#${A('grdTotal')} .TccGridBodyScroll td:is(${[6, 12, 16, 17, 24, 23, 18].map((n) => `.${A('grdTotal')}_tdCol${n}`).join(', ')}) {
  /* 4つで1段。項目のあいだのすき間（cardGrid の column-gap 10px × 3）のぶんを引く */
  flex: 0 0 calc(25% - 7.5px) !important;
  max-width: calc(25% - 7.5px) !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  margin-top: 10px !important;
  font-size: 20px !important;
  font-weight: 700 !important;
  color: var(--myapp-text) !important;
  font-variant-numeric: tabular-nums;
}
/* 値のない項目（欠勤・代休が 0 のときなど）は、見出しごと出さない（cardGrid の決まりより強く） */
#${A('grdTotal')} .TccGridBodyScroll tr td[data-myapp-blank] { display: none !important; }
#${A('grdTotal')} .TccGridBodyScroll td:is(${[6, 12, 16, 17, 24, 23, 18].map((n) => `.${A('grdTotal')}_tdCol${n}`).join(', ')})::before {
  display: block;
  margin: 0 0 2px !important;
  font-size: 13px;
  font-weight: 400;
  white-space: nowrap;
}
${cardGrid(A('grdApplyStat'), [[2], [3, 9, 10], [4, 5], [6, 7, 8]], { 3: '申請', 9: '給与処理', 4: '承認', 6: '第二承認', 8: 'コメント' }, { pager: true })}
${cardGrid(A('grdAttd'), [[1], [10, 11, 28], [20, 29, 21], [7, 9]], { 10: '出勤', 11: '退勤', 28: '勤務', 20: '休憩', 29: '残業', 21: '休暇' }, { pager: true })}
${ATT_TAB_GRIDS.map((id) => flowGrid(A(id))).join('\n')}

/* 工数: 「日ごと｜プロジェクトごと」の切り替え（JS の kosuView）と、プロジェクトごとのカード */
.myapp-kosu-seg {
  display: flex; gap: 2px; margin: 0 16px; padding: 3px;
  border-radius: 999px; background: var(--myapp-segment);
}
.myapp-kosu-seg button {
  flex: 1 1 0; height: 34px; margin: 0; padding: 0; border: 0; border-radius: 999px;
  background: transparent; color: var(--myapp-text2); font: inherit; font-size: 14px; font-weight: 600;
}
.myapp-kosu-seg button[aria-selected="true"] { background: var(--myapp-segment-on); color: var(--myapp-text); box-shadow: var(--myapp-segment-on-shadow); }
.myapp-kosu-sum { display: none; }
.myapp-kosu-project .myapp-kosu-sum { display: flex; flex-direction: column; gap: 8px; padding-bottom: 24px; }
.myapp-kosu-project #${A('grdPrj')} { display: none !important; }
.myapp-kosu-all { margin: 2px 16px 0; font-size: 13px; color: var(--myapp-text2); font-variant-numeric: tabular-nums; }
.myapp-kosu-card { margin: 0 16px; padding: 12px 16px; border-radius: 20px; background: var(--myapp-fill); }
.myapp-kosu-head { display: flex; align-items: baseline; gap: 12px; }
.myapp-kosu-name { flex: 1 1 auto; min-width: 0; font-size: 16px; font-weight: 600; line-height: 1.35; color: var(--myapp-text); }
.myapp-kosu-total { flex: none; font-size: 20px; font-weight: 700; color: var(--myapp-text); font-variant-numeric: tabular-nums; }
.myapp-kosu-meta, .myapp-kosu-kinds {
  display: flex; flex-wrap: wrap; gap: 2px 14px; margin-top: 4px;
  font-size: 13px; line-height: 1.4; color: var(--myapp-text2); font-variant-numeric: tabular-nums;
}
.myapp-kosu-kinds { margin-top: 6px; }
.myapp-kosu-kind b { margin-left: 4px; font-weight: 600; color: var(--myapp-text); }
.myapp-kosu-empty { margin: 0 16px; padding: 24px 0; text-align: center; font-size: 15px; color: var(--myapp-text2); }
.myapp-kosu-note { margin: 0 16px; font-size: 13px; line-height: 1.45; color: var(--myapp-text2); }
`;

// ---------------------------------------------------------------------------
// 勤怠実績登録（frmAttendanceDtl）: 1日分の入力
// ---------------------------------------------------------------------------
const D = (id: string) => `frmAttendanceDtl_${id}`;

// 時刻の「開始 ～ 終了」を、左の列（A）と右の列（B）に1組ずつ並べる。左には見出し（実績・休憩・休暇）を置く。
//   見出し 16〜72px / A の組 76px〜 / B の組（A の右 10px）〜 右の余白 16px
const PAIR = '((100% - 102px) / 2)'; // 1組の幅
const TIME = '((100% - 142px) / 4)'; // 時刻の入力欄1つの幅（1組 = 入力欄 + 「～」20px + 入力欄）
const COLUMNS = {
  A: { from: '76px', tilde: `calc(76px + ${TIME})`, to: `calc(96px + ${TIME})` },
  B: { from: `calc(86px + ${PAIR})`, tilde: `calc(86px + ${PAIR} + ${TIME})`, to: `calc(106px + ${PAIR} + ${TIME})` },
};

function timeRange(from: string, tilde: string, to: string, column: 'A' | 'B', top: number): string {
  const x = COLUMNS[column];
  return `
${place(D(from), x.from, top, `calc(${TIME})`, 40)}
${place(D(tilde), x.tilde, top, '20px', 40)}
${place(D(to), x.to, top, `calc(${TIME})`, 40)}
${fillInput(D(from))}
${fillInput(D(to))}
${text(D(tilde), 15, { muted: true, align: 'center' })}
`;
}

/** 見出し（実績・休憩・休暇など）を左に置く */
function heading(id: string, top: number): string {
  return `${place(D(id), '16px', top, '56px', 40)}\n${text(D(id), 15, { muted: true })}`;
}

// プロジェクトの行（6行）: 1行を3段に並べる。中身のある行と、その次の空の行だけを出す（JS が data-myapp-prj に数を入れる）
// 1行 = 3段（それぞれ、上に小さな欄の名前 18px と、入力欄 40px）
const PROJECT_ROW_HEIGHT = 200;
const projectRowTop = (n: number) => 40 + (n - 1) * PROJECT_ROW_HEIGHT;
const projectSectionHeight = (rows: number) => 34 + rows * PROJECT_ROW_HEIGHT;
const PROJECT_FIELDS = ['txtPrj', 'qbxProj', 'btnDel', 'qbxContent', 'chkTW', 'txtTime', 'txtRemark'];

/** 欄の上に小さな名前を出す（入力すると欄の中の薄い文字は消えるので、何の欄か分かるように） */
function caption(id: string, label: string): string {
  return `#${id} { overflow: visible !important; }
#${id}::before {
  content: '${label}';
  position: absolute;
  left: 0;
  top: -19px;
  font-size: 13px;
  line-height: 16px;
  white-space: nowrap;
  color: var(--myapp-text2);
  pointer-events: none;
}`;
}

function projectRow(n: number): string {
  const top = projectRowTop(n);
  return `
${place(D(`txtPrj${n}`), '16px', top + 18, '92px', 40)}
${place(D(`qbxProj${n}`), '116px', top + 18, 'calc(100% - 180px)', 40)}
#${D(`btnDel${n}`)} { left: auto !important; right: 16px !important; top: ${top + 18}px !important; width: 40px !important; height: 40px !important; }
${place(D(`qbxContent${n}`), '16px', top + 82, 'calc(100% - 224px)', 40)}
${place(D(`chkTW${n}`), 'calc(100% - 200px)', top + 82, '96px', 40)}
#${D(`chkTW${n}`)}::after {
  content: 'テレワーク';
  position: absolute;
  left: 28px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: var(--myapp-text2);
  pointer-events: none;
}
#${D(`txtTime${n}`)} { left: auto !important; right: 16px !important; top: ${top + 82}px !important; width: 80px !important; height: 40px !important; }
${place(D(`txtRemark${n}`), '16px', top + 146, 'calc(100% - 32px)', 40)}
${[`txtPrj${n}`, `qbxProj${n}`, `qbxContent${n}`, `txtTime${n}`, `txtRemark${n}`].map((id) => fillInput(D(id))).join('')}
${fillButton(D(`btnDel${n}`))}
${caption(D(`txtPrj${n}`), '番号')}
${caption(D(`qbxProj${n}`), 'プロジェクト')}
${caption(D(`qbxContent${n}`), '作業内訳')}
${caption(D(`txtTime${n}`), '時間')}
${caption(D(`txtRemark${n}`), '詳細')}
/* 中身のない最後の行には、消すボタンを出さない（JS が data-myapp-prj-empty を付ける）。プロジェクトの欄は、そのぶん右へ伸ばす */
#frmAttendanceDtl[data-myapp-prj="${n}"][data-myapp-prj-empty] #${D(`btnDel${n}`)} { display: none !important; }
#frmAttendanceDtl[data-myapp-prj="${n}"][data-myapp-prj-empty] #${D(`qbxProj${n}`)} { width: calc(100% - 132px) !important; }
`;
}

function projectRowsShown(rows: number): string {
  const hidden = [];
  for (let n = rows + 1; n <= 6; n += 1) hidden.push(...PROJECT_FIELDS.map((field) => `#frmAttendanceDtl[data-myapp-prj="${rows}"] #${D(`${field}${n}`)}`));
  return `
#frmAttendanceDtl[data-myapp-prj="${rows}"] #${D('R3')},
#frmAttendanceDtl[data-myapp-prj="${rows}"] #${D('R3')} > *,
#frmAttendanceDtl[data-myapp-prj="${rows}"] #${D('blank3')} { height: ${projectSectionHeight(rows)}px !important; }
${hidden.length ? `${hidden.join(',\n')} { display: none !important; }` : ''}
`;
}

const DTL_CSS = `
${fullWidth('frmAttendanceDtl')}
/* 長いプロジェクト名・作業内訳（JS の longNames）: 欄の中に2行で全部見せる。欄の文字は透明にして、上に重ねた札を見せる */
#frmAttendanceDtl [data-myapp-long] > .myapp-name-wrap {
  position: absolute;
  left: 0;
  top: 0;
  right: 28px;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: 0 4px 0 7px;
  box-sizing: border-box;
  pointer-events: none;
  font-size: 13px;
  line-height: 16px;
  color: var(--myapp-text);
  overflow: hidden;
}
/* 2行で切る。WebKit は「…」を付けても3行目を描いてしまうので、札の高さを2行ぶん（16px × 2）にして隠す */
#frmAttendanceDtl [data-myapp-long] > .myapp-name-wrap { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; top: 4px; bottom: auto; height: 32px; padding-top: 0; }
#frmAttendanceDtl [data-myapp-long]:not(:focus-within) input { color: transparent !important; -webkit-text-fill-color: transparent !important; }
#frmAttendanceDtl [data-myapp-long]:focus-within > .myapp-name-wrap { display: none !important; }
/* テレワークの四角（label の ::before に描いてある）は、上に寄っている。右の「テレワーク」の文字と同じ高さに下げる */
[id^="frmAttendanceDtl_chkTW"] label { transform: translateY(8px); }
[id^="frmAttendanceDtl_chkTW"] input { margin-top: 12px !important; }
#frmAttendanceDtl { height: auto !important; }
#frmAttendanceDtl .tcc-tile.col { float: none !important; }

/* 名前（タイトルはヘッダーに出す。閉じるはアプリの戻るで。入力欄の後ろの飾りの面も出さない） */
#${D('R1')}, #${D('R1')} > *, #${D('blank1')} { height: 32px !important; }
${place(D('lblUserName'), '16px', 4, 'calc(100% - 32px)', 24)}
${text(D('lblUserName'), 14, { muted: true })}
#${D('lblUserName')} i { margin-right: 6px !important; }
/* 名前の行は、ほかの画面の小見出しと同じく、画面の左から 20pt に（下の「カードの中の文字」の決まりより強く） */
#frmAttendanceDtl #${D('lblUserName')} .tcc-label-text { padding-left: 4px !important; }
${['lbl5', 'btnClose', 'lbl37', 'lbl18', 'lbl19', 'lbl22', 'lbl23', 'restBg1', 'restBg2', 'lbl35', 'lbl27', 'lbl34', 'lbl28', 'lbl29']
  .map((id) => `#${D(id)}`)
  .join(',\n')} { display: none !important; }

/* 勤怠日（登録は画面の下に固定した帯へ。bottomBars。削除は、いちばん下に小さく。JS が .myapp-dtl-footer に移す） */
#${D('R2')}, #${D('R2')} > *, #${D('blank2')} { height: 304px !important; }
${place(D('lbl32'), '16px', 4, '64px', 36)}
${text(D('lbl32'), 15, { muted: true })}
/* 勤怠日・勤務体系の値は、下の時刻の欄の中の文字と同じ位置から始める
   （欄は 76px から。欄の中の文字は真ん中寄せで、左に 7px ほど空く） */
${place(D('lblDt'), '84px', 4, 'calc(100% - 100px)', 36)}
${text(D('lblDt'), 17, { bold: true })}

/* 勤務体系 */
${place(D('lbl7'), '16px', 44, '72px', 28)}
${text(D('lbl7'), 15, { muted: true })}
${place(D('work_tp'), '84px', 44, 'calc(100% - 100px)', 28)}
${text(D('work_tp'), 15)}
#${D('lblDt')} .tcc-label, #${D('lblDt')} .tcc-label-text, #${D('work_tp')} .tcc-label, #${D('work_tp')} .tcc-label-text { padding-left: 0 !important; margin-left: 0 !important; }

/* カードの中の文字の左端は、どれもカードの左から 16px（ラベルの中の、EZCraft の余白はなくす）。
   見出し（実績・休憩・休暇・プロジェクト・備考）と、残業・コピーのカードの文字がそろう */
#frmAttendanceDtl .tcc-component.lbl .tcc-label { padding-left: 0 !important; padding-right: 0 !important; border-left-width: 0 !important; }
#frmAttendanceDtl .tcc-component.lbl .tcc-label-text { padding-left: 0 !important; }

/* ほかの日の内容をコピー: 時刻の欄より下の、別のカードに（JS が .myapp-copy に移す。いちばん使う時刻の欄を上に） */
#${D('lbl1')} { display: none !important; }
.myapp-copy {
  box-sizing: border-box;
  width: calc(100% - 32px);
  margin: 0 16px 12px;
  padding: 12px 16px 14px;
  border-radius: 22px;
  background-color: var(--myapp-surface);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  align-items: center;
  gap: 8px 10px;
}
#frmAttendanceDtl > .myapp-copy { width: calc(100% - 32px) !important; }
.myapp-copy-title { grid-column: 1 / -1; font-size: 13px; color: var(--myapp-text2); }
.myapp-copy > .tcc-component { position: relative !important; left: auto !important; top: auto !important; width: auto !important; min-width: 0 !important; height: 44px !important; }
.myapp-copy div.icon-rt, .myapp-copy div.icon-rt * { border: none !important; }
${fillInput(D('dtCopy'))}
${fillButton(D('btnCopy'))}

/* 実績（と勤務時間）・遅刻早退・休憩・休暇 */
${heading('lbl6', 88)}
${timeRange('work_stt_tm', 'lbl31', 'work_end_tm', 'A', 88)}
${place(D('lbl36'), COLUMNS.B.from, 88, '72px', 40)}
${text(D('lbl36'), 14, { muted: true })}
${place(D('work_tm'), `calc(158px + ${PAIR})`, 88, '64px', 40)}
${text(D('work_tm'), 16, { bold: true })}
/* 勤務時間は、時刻を入れて計算されるまで空。空のあいだは「—」 */
#${D('work_tm')} .tcc-label-text:empty::before { content: '—'; color: var(--myapp-text2); font-weight: 400; }
${place(D('lblLeave'), '76px', 132, '56px', 20)}
${place(D('lateEarly'), '132px', 132, '48px', 20)}
${place(D('lblEarly'), COLUMNS.B.from, 132, '56px', 20)}
${place(D('early'), `calc(142px + ${PAIR})`, 132, '48px', 20)}
${['lblLeave', 'lblEarly'].map((id) => text(D(id), 13, { muted: true })).join('')}
${['lateEarly', 'early'].map((id) => text(D(id), 13, { bold: true })).join('')}

${heading('lbl16', 156)}
${timeRange('break_tm_from1', 'lbl17', 'break_tm_to1', 'A', 156)}
${timeRange('break_tm_from2', 'lbl12', 'break_tm_to2', 'B', 156)}
${timeRange('break_tm_from3', 'lbl13', 'break_tm_to3', 'A', 204)}
${timeRange('break_tm_from4', 'lbl14', 'break_tm_to4', 'B', 204)}
/* 休憩の2段目（3つ目・4つ目）は、2つ目を入れるまで出さない（JS が data-myapp-breaks2 を付ける）。
   出さないあいだは、その下の休暇を 48px 上に詰める */
#frmAttendanceDtl:not([data-myapp-breaks2]) :is(${['break_tm_from3', 'lbl13', 'break_tm_to3', 'break_tm_from4', 'lbl14', 'break_tm_to4'].map((id) => `#${D(id)}`).join(', ')}) { display: none !important; }
#frmAttendanceDtl:not([data-myapp-breaks2]) :is(${['lbl15', 'leave_tp1', 'leave_tp2'].map((id) => `#${D(id)}`).join(', ')}) { top: 208px !important; }
#frmAttendanceDtl:not([data-myapp-breaks2]) :is(${['leave_tm_from1', 'rest1', 'leave_tm_to1', 'leave_tm_from2', 'rest2', 'leave_tm_to2'].map((id) => `#${D(id)}`).join(', ')}) { top: 256px !important; }

${heading('lbl15', 256)}
${place(D('leave_tp1'), COLUMNS.A.from, 256, `calc(${PAIR})`, 40)}
${place(D('leave_tp2'), COLUMNS.B.from, 256, `calc(${PAIR})`, 40)}
${fillInput(D('leave_tp1'))}
${fillInput(D('leave_tp2'))}
${timeRange('leave_tm_from1', 'rest1', 'leave_tm_to1', 'A', 304)}
${timeRange('leave_tm_from2', 'rest2', 'leave_tm_to2', 'B', 304)}
/* 休暇の時刻（時間単位の休暇のときだけ出る）が出ているときは、その段のぶん広げる */
#${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])),
#${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])) > *,
#${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])) #${D('blank2')} { height: 352px !important; }
#frmAttendanceDtl:not([data-myapp-breaks2]) :is(#${D('R2')}, #${D('R2')} > *, #${D('blank2')}) { height: 256px !important; }
#frmAttendanceDtl:not([data-myapp-breaks2]) #${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])),
#frmAttendanceDtl:not([data-myapp-breaks2]) #${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])) > *,
#frmAttendanceDtl:not([data-myapp-breaks2]) #${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])) #${D('blank2')} { height: 304px !important; }

/* 遅刻・早退の段（数字があるときだけ。JS が data-myapp-late を付ける）がないときは、その下を 24px 上に詰める */
#frmAttendanceDtl:not([data-myapp-late]) :is(${['lblLeave', 'lateEarly', 'lblEarly', 'early'].map((id) => `#${D(id)}`).join(', ')}) { display: none !important; }
#frmAttendanceDtl:not([data-myapp-late]) :is(${['lbl16', 'break_tm_from1', 'lbl17', 'break_tm_to1', 'break_tm_from2', 'lbl12', 'break_tm_to2', 'break_tm_from3', 'lbl13', 'break_tm_to3', 'break_tm_from4', 'lbl14', 'break_tm_to4', 'lbl15', 'leave_tp1', 'leave_tp2', 'leave_tm_from1', 'rest1', 'leave_tm_to1', 'leave_tm_from2', 'rest2', 'leave_tm_to2'].map((id) => `#${D(id)}`).join(', ')}) { transform: translateY(-24px); }
#frmAttendanceDtl:not([data-myapp-late]) :is(#${D('R2')}, #${D('R2')} > *, #${D('blank2')}) { height: 280px !important; }
#frmAttendanceDtl:not([data-myapp-late]) #${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])),
#frmAttendanceDtl:not([data-myapp-late]) #${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])) > *,
#frmAttendanceDtl:not([data-myapp-late]) #${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])) #${D('blank2')} { height: 328px !important; }
#frmAttendanceDtl:not([data-myapp-late]):not([data-myapp-breaks2]) :is(#${D('R2')}, #${D('R2')} > *, #${D('blank2')}) { height: 232px !important; }
#frmAttendanceDtl:not([data-myapp-late]):not([data-myapp-breaks2]) #${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])),
#frmAttendanceDtl:not([data-myapp-late]):not([data-myapp-breaks2]) #${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])) > *,
#frmAttendanceDtl:not([data-myapp-late]):not([data-myapp-breaks2]) #${D('R2')}:has(#${D('leave_tm_from1')}:not([style*="visibility: hidden"])) #${D('blank2')} { height: 280px !important; }

/* 削除: 登録と並べず、いちばん下に小さく赤い文字で（押し間違えないように） */
.myapp-dtl-footer { display: flex; justify-content: center; padding: 4px 0 8px; }
#frmAttendanceDtl > .myapp-dtl-footer { width: 100% !important; }
.myapp-dtl-footer:has(> [style*="visibility: hidden"]) { display: none; }
.myapp-dtl-footer > #${D('btnDel')} { position: relative !important; left: auto !important; top: auto !important; width: 160px !important; height: 44px !important; }
.myapp-dtl-footer > #${D('btnDel')} .tcc-btn { background: transparent !important; font-size: 16px !important; }
${fillButton(D('btnDel'))}

/* プロジェクト（見出しの「プロジェクト」と合計の時間。列の名前は欄の上に小さく出す） */
${place(D('lbl26'), '16px', 8, '160px', 24)}
${text(D('lbl26'), 13, { bold: true, muted: true })}
#${D('lblTotal')} { left: auto !important; right: 16px !important; top: 8px !important; width: 140px !important; height: 24px !important; }
${text(D('lblTotal'), 13, { bold: true, muted: true, align: 'right' })}
#${D('lblTotal')} .tcc-label-text { width: auto !important; max-width: none !important; overflow: visible !important; }
/* 右端は、下の欄の右端（カードの右から 16px）にそろえる。EZCraft の右の余白 5px はなくす */
#frmAttendanceDtl #${D('lblTotal')} .tcc-label-text { padding-right: 0 !important; }
#${D('lblTotal')} .tcc-label-text::before { content: '合計 '; font-weight: 400; }
/* 時間の札は、頭の 0 を取った形で見せる（JS の showTimes。元の文字は消さずに見えなくする） */
#${D('lblTotal')} .tcc-label-text[data-myapp-time], #${D('work_tm')} .tcc-label-text[data-myapp-time] { font-size: 0 !important; }
#${D('lblTotal')} .tcc-label-text[data-myapp-time]::before { font-size: 13px; }
#${D('lblTotal')} .tcc-label-text[data-myapp-time]::after { content: attr(data-myapp-time); font-size: 13px; }
#${D('work_tm')} .tcc-label-text[data-myapp-time]::after { content: attr(data-myapp-time); font-size: 16px; }
${[1, 2, 3, 4, 5, 6].map(projectRow).join('')}
#${D('R3')}, #${D('R3')} > *, #${D('blank3')} { height: ${projectSectionHeight(6)}px !important; }
${[1, 2, 3, 4, 5].map(projectRowsShown).join('')}

/* 備考 */
#${D('R4')}, #${D('R4')} > *, #${D('blank4')} { height: 136px !important; }
${place(D('lbl33'), '16px', 8, '100px', 24)}
${text(D('lbl33'), 13, { bold: true, muted: true })}
${place(D('remarks'), '16px', 36, 'calc(100% - 32px)', 88)}
#${D('remarks')} textarea { box-sizing: border-box !important; width: 100% !important; height: 100% !important; }

/* 勤怠日〜休暇・プロジェクト・備考を、それぞれ白いカードにする（中の部品の座標はそのまま。カードの幅に合わせて伸び縮みする）。
   カードの中の入力欄とボタンは、カードと見分けがつく灰色の面に（JS が myapp-card を付ける。GLASS_CSS） */
#frmAttendanceDtl #${D('R2')},
#frmAttendanceDtl #${D('R3')},
#frmAttendanceDtl #${D('R4')} {
  width: calc(100% - 32px) !important;
  margin: 0 16px 12px !important;
  border-radius: 22px !important;
  background-color: var(--myapp-surface) !important;
}

/* 残業（JS が .myapp-ot を作る）: 所定の時間を超えたら、何分の残業かと、その場で残業申請を作るボタンを出す */
.myapp-ot {
  box-sizing: border-box;
  width: calc(100% - 32px);
  margin: 0 16px 12px;
  padding: 14px 16px;
  border-radius: 22px;
  background-color: var(--myapp-surface);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.myapp-ot[hidden] { display: none; }
/* フォームの直下の部品は、fullWidth で幅いっぱいにされる。カードの幅（左右 16px あける）に戻す */
#frmAttendanceDtl > .myapp-ot { width: calc(100% - 32px) !important; }
.myapp-ot-head { display: flex; align-items: baseline; gap: 10px; }
.myapp-ot-title { font-size: 15px; font-weight: 600; color: var(--myapp-text); }
.myapp-ot-title b { margin-left: 6px; font-size: 22px; font-weight: 700; color: var(--myapp-warn); font-variant-numeric: tabular-nums; }
.myapp-ot-range { margin-left: auto; font-size: 15px; color: var(--myapp-text2); font-variant-numeric: tabular-nums; }
.myapp-ot-note { font-size: 13px; line-height: 1.45; color: var(--myapp-text2); }
.myapp-ot-btn {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  height: 44px;
  border-radius: 22px;
  /* 2つ目の操作は、どの画面でも同じ灰色のカプセル */
  background-color: var(--myapp-segment);
  color: var(--myapp-accent-text);
  font-size: 16px;
  font-weight: 600;
  transition: transform 0.15s;
}
.myapp-ot-btn:active { transform: scale(0.97); }
.myapp-ot[data-done] .myapp-ot-title b { color: var(--myapp-text); }
`;

// ---------------------------------------------------------------------------
// 勤怠申請（frmApply）: 「新規申請」のタブを開いているときだけ、申請の種類を1件1枚のカードにする。
// カード全体が「＋」のボタン（押すとその申請の画面が開く）。名前と説明はボタンの上に重ねる。
// ほかのタブ（承認待ち・申請検索・休暇照会）は、勤務表のほかのタブと同じ形（検索の条件を1行ずつ・結果は1件1枚のカード）。
// ---------------------------------------------------------------------------
const AP = (id: string) => `frmApply_${id}`;
/**
 * 申請の種類（よく使う順に）: ボタン・名前・説明の部品と、アイコン（色・24×24 の線の SVG の path）・短い説明。
 * 説明は Web 版の「〜する場合に使用」を、いつ使うかが分かる短い言葉にする（relabel）
 */
const APPLY_KINDS = [
  { button: 'zangyo', title: 'lbl20', note: 'lbl39', color: '#FF9500', icon: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z M12 7v5l3.5 2', text: '残業・深夜勤務をするとき' },
  { button: 'yukyu', title: 'lbl19', note: 'lbl38', color: '#34C759', icon: 'M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4', text: '有給休暇を取るとき' },
  { button: 'chikokuSotai', title: 'lbl22', note: 'lbl41', color: '#FF2D55', icon: 'M12 6a7 7 0 1 1 0 14a7 7 0 1 1 0-14z M12 9.5V13l2 1.5 M5 4 3 6 M19 4l2 2', text: '遅刻・早退をするとき' },
  { button: 'kyuzitu', title: 'lbl17', note: 'lbl36', color: '#5856D6', icon: 'M5 8h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 8z M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8', text: '休日に出勤するとき' },
  { button: 'daikyu', title: 'lbl16', note: 'lbl35', color: '#30B0C7', icon: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M4 10h16 M8 3v4 M16 3v4 M9 15l2 2 4-4', text: '休日出勤のかわりに休むとき' },
  { button: 'hurikyu', title: 'lbl18', note: 'lbl37', color: '#007AFF', icon: 'M4 8h13 M14 4.5 17.5 8 14 11.5 M20 16H7 M10 12.5 6.5 16l3.5 3.5', text: '休日と出勤日を入れ替えるとき' },
  { button: 'tokkyu', title: 'lbl21', note: 'lbl40', color: '#AF52DE', icon: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z', text: '慶弔などの特別休暇を取るとき' },
];
/** アイコンを、色の付いた四角に白い線で描いた画像（CSS の背景）にする */
function iconImage(path: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const APPLY_CARD = 76;
const APPLY_GAP = 12;
// 勤怠申請の枠（どのタブでも同じ）: ロゴ・名前・閉じる・題名は出さない（題名はヘッダーに出す。閉じるはアプリの戻るで）
const APPLY_FRAME_CSS = `
${fullWidth('frmApply')}
#frmApply { height: auto !important; }
#${AP('R1')}, #${AP('R2')} { display: none !important; }
#${AP('R3')}, #${AP('R3_C1')}, #${AP('blank4')}, #${AP('blank4_body')} { height: auto !important; overflow: visible !important; }
#${AP('tabApply')} { position: relative !important; top: 0 !important; left: 0 !important; display: block !important; height: auto !important; }
#${AP('tabApply')} > .tcc-tab-content {
  position: relative !important;
  top: 0 !important;
  left: 0 !important;
  height: auto !important;
  overflow: visible !important;
}
/* タブ（新規申請・承認待ち・申請検索・休暇照会）: ふだんは勤務表と同じく、画面の下のガラスのタブ（tabBars）に出すので、ここには出さない。
   下のタブが作れなかったときだけ、画面の幅に収まる切り替えスイッチにする（横にはみ出さない） */
#${AP('tabApply')}[data-myapp-tabbar] > ul.tcc-tab-head { display: none !important; }
#${AP('tabApply')}:not([data-myapp-tabbar]) > ul.tcc-tab-head {
  display: flex !important;
  flex-wrap: nowrap !important;
  width: auto !important;
  margin: 4px 16px 0 !important;
  padding: 3px !important;
  box-sizing: border-box;
}
#${AP('tabApply')} > ul.tcc-tab-head > li { flex: 1 1 0 !important; min-width: 0 !important; }
#${AP('tabApply')} > ul.tcc-tab-head a { display: block !important; width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; font-size: 13px !important; white-space: nowrap; text-align: center; padding-left: 0 !important; padding-right: 0 !important; }
`;

// 「新規申請」のタブ: 申請の種類を1件1枚のカードにする（アイコン・名前・いつ使うか）
const APPLY_CSS = `
#${AP('tabApply_tabs_0')} {
  position: relative !important;
  top: 0 !important;
  left: 0 !important;
  height: ${16 + APPLY_KINDS.length * (APPLY_CARD + APPLY_GAP) + 16}px !important;
  overflow: visible !important;
}
/* カードの後ろの四角と区切りの線は出さない */
${['lbl2', 'lbl3', 'lbl4', 'lbl5', 'lbl6', 'lbl7', 'lbl8', 'lin3', 'lin4', 'lin5', 'lin6', 'lin7', 'lin8', 'lin9']
  .map((id) => `#${AP(id)}`)
  .join(',\n')} { display: none !important; }
${APPLY_KINDS.map(({ button, title, note, color, icon }, i) => {
  const top = 16 + i * (APPLY_CARD + APPLY_GAP);
  return `
${row(AP(button), top, APPLY_CARD)}
${fillButton(AP(button))}
#${AP(button)} .tcc-btn {
  position: relative;
  border-radius: 22px !important;
  background-color: var(--myapp-fill) !important;
}
#${AP(button)} .tcc-btn i { display: none !important; }
#${AP(button)} .tcc-btn::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: ${color} ${iconImage(icon)} center / 22px 22px no-repeat;
}
#${AP(button)} .tcc-btn::after {
  content: '›';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 26px;
  color: var(--myapp-text2);
}
${place(AP(title), '88px', top + 12, 'calc(100% - 140px)', 26)}
${text(AP(title), 17, { bold: true })}
${place(AP(note), '88px', top + 40, 'calc(100% - 140px)', 24)}
${text(AP(note), 13, { muted: true })}
/* 名前と説明の字は、色の付いた印の右 16pt から（TiMS のメニューのカードと同じ）。EZCraft のラベルの左の余白はなくす */
#${AP(title)} .tcc-label, #${AP(note)} .tcc-label, #${AP(title)} .tcc-label-text, #${AP(note)} .tcc-label-text { padding-left: 0 !important; margin-left: 0 !important; border-left-width: 0 !important; }
/* 名前と説明はボタンの上に（この画面ではボタンのほうが後ろに書かれていて、上に重なるため）。押すとボタンが押される */
#${AP(title)}, #${AP(note)} { z-index: 50 !important; pointer-events: none !important; }
#${AP(title)} .tcc-label-text, #${AP(note)} .tcc-label-text { width: 100% !important; max-width: 100% !important; }
/* EZCraft のラベルは表（table）の形で、中身に合わせて広がるので、ふつうの箱にして幅で切る */
#${AP(note)}, #${AP(note)} .tcc-label { display: block !important; overflow: hidden !important; line-height: 24px !important; }
#${AP(note)} .tcc-label-text { overflow: hidden !important; text-overflow: ellipsis !important; }`;
}).join('\n')}
`;

// 勤怠申請のほかのタブ（承認待ち・申請検索・休暇照会）: 検索の条件（.myapp-search）と、結果の1件1枚のカード
const APPLY_TAB_BUTTONS = ['approve_search', 'btnApprove', 'btnReject', 'apply_search', 'apply_clear', 'leave_search', 'leave_clear'];
const APPLY_TABS_CSS = `
/* 承認待ちの「申請書名・タイトルで探す」: ほかの検索欄と同じ形（灰色の面・左に虫めがね） */
${searchField('#frmApply_approve_search_text')}
#${AP('tabApply')} > .tcc-tab-content > .tcc-tab-pane.active {
  position: relative !important;
  top: 0 !important;
  left: 0 !important;
  height: auto !important;
  overflow: visible !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px;
  padding: 16px 0 32px !important;
  box-sizing: border-box !important;
}
#${AP('tabApply')} .tcc-tab-pane > .tcc-component.hline { display: none !important; }
${SEARCH_CSS}
${APPLY_TAB_BUTTONS.map((id) => fillButton(AP(id))).join('')}
#${AP('btnReject')} .tcc-btn, #${AP('btnReject')} .tcc-btn i { color: var(--myapp-danger) !important; }
${cardGrid(AP('grdApprove'), [[4], [1, 6, 13, 14], [3, 8, 9, 11, 12], [15]], { 13: '対象', 14: '時間', 3: '申請', 8: '第一承認', 11: '第二承認', 15: '理由' }, { pager: true })}
${cardGrid(AP('grdSearch'), [[4], [7, 3, 6], [2, 1], [9, 10, 12, 13, 14]], { 6: '対象', 2: '申請', 1: 'No.', 9: '第一承認', 12: '第二承認', 14: 'コメント' }, { pager: true })}
${cardGrid(AP('grdLeave'), [[1], [2, 15], [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]], { 15: '合計', 3: '4月分', 4: '5月分', 5: '6月分', 6: '7月分', 7: '8月分', 8: '9月分', 9: '10月分', 10: '11月分', 11: '12月分', 12: '1月分', 13: '2月分', 14: '3月分' }, { pager: true })}
${['grdApprove', 'grdSearch', 'grdLeave'].map((id) => flowGrid(AP(id))).join('\n')}
/* 申請検索・承認待ちのカード:
   - 題名（2026/11/09_岡崎　昂功_有休）は「_」を「・」にして見せる（JS の applyTitles が data-myapp-title に入れる。元の文字は隠す）
   - 申請 No. の下線（パソコンのリンク風）は出さない
   - 承認は1人ずつ1行に。名前を左、日付を右に（日付だけが次の行に落ちないように） */
:is(#${AP('grdSearch')}, #${AP('grdApprove')}) .TccGridBodyScroll td[data-myapp-title] > * { font-size: 0 !important; }
:is(#${AP('grdSearch')}, #${AP('grdApprove')}) .TccGridBodyScroll td[data-myapp-title]::before { content: attr(data-myapp-title); font-size: 16px; }
:is(#${AP('grdSearch')}, #${AP('grdApprove')}) .TccGridBodyScroll td > div { text-decoration: none !important; }
#${AP('grdSearch')} .TccGridBodyScroll td:is(.${AP('grdSearch')}_tdCol9, .${AP('grdSearch')}_tdCol12) { flex: 0 0 calc(100% - 100px) !important; }
#${AP('grdSearch')} .TccGridBodyScroll td:is(.${AP('grdSearch')}_tdCol10, .${AP('grdSearch')}_tdCol13) { margin-left: auto; white-space: nowrap !important; font-variant-numeric: tabular-nums; }
#${AP('grdSearch')} .TccGridBodyScroll td.${AP('grdSearch')}_tdCol14 { flex-basis: 100% !important; }
:is(#${AP('grdSearch')}, #${AP('grdApprove')}, #${AP('grdLeave')}) .TccGridBodyScroll td[data-myapp-dup] { display: none !important; }
/* 休暇照会: どのカードにも「有休・付与数」の見出し（JS の leaveCards。元の文字は隠し、data-myapp-head を出す） */
#${AP('grdLeave')} .TccGridBodyScroll tr td.${AP('grdLeave')}_tdCol1[data-myapp-head] { display: block !important; }
#${AP('grdLeave')} .TccGridBodyScroll td[data-myapp-head] > * { font-size: 0 !important; }
#${AP('grdLeave')} .TccGridBodyScroll td[data-myapp-head]::before { content: attr(data-myapp-head); font-size: 16px; }
:is(#${AP('grdSearch')}, #${AP('grdApprove')}) .TccGridBodyScroll td[data-myapp-state] {
  margin-left: auto;
  padding: 1px 9px !important;
  border-radius: 999px;
  font-size: 12px !important;
  font-weight: 600 !important;
  background-color: var(--myapp-tab-on) !important;
  color: var(--myapp-accent-text) !important;
}
:is(#${AP('grdSearch')}, #${AP('grdApprove')}) .TccGridBodyScroll td[data-myapp-state="ok"] { background-color: var(--myapp-success-bg) !important; color: var(--myapp-success) !important; }
:is(#${AP('grdSearch')}, #${AP('grdApprove')}) .TccGridBodyScroll td[data-myapp-state="ng"] { background-color: rgba(255, 59, 48, 0.14) !important; color: var(--myapp-danger) !important; }
/* 一覧の注意書き（「赤字は申請ベースの取得予定数です」など）は、小さな灰色の文字で折り返す */
#${AP('lbl44')} *, #${AP('lblMsg')} * { white-space: normal !important; font-size: 13px !important; color: var(--myapp-text2) !important; }
/* 文の頭の EZCraft の「❗」の印は出さない（Web 風に見える。注意書きは灰色の文字だけで分かる） */
#${AP('lbl44')} i.fa, #${AP('lblMsg')} i.fa { display: none !important; }
`;

// ---------------------------------------------------------------------------
// 有給休暇申請（frmApply_yukyu）: 申請の情報 → キャンセル・登録 → 入力欄（縦に1列）→ 付与・使用・残りの日数
// ---------------------------------------------------------------------------
const Y = (id: string) => `frmApply_yukyu_${id}`;
/** 左に見出し（72px）、右に値を置く1行 */
function labeled(label: string, value: string, top: number, height = 26): string {
  return `${place(Y(label), '16px', top, '72px', height)}
${text(Y(label), 15, { muted: true })}
${place(Y(value), '104px', top, 'calc(100% - 120px)', height)}
${text(Y(value), 15)}`;
}
/** 見出しを左に（ほかの申請と同じ）、右の列に「開始」の欄、その下に「～ 終了」の欄（2段で 88px） */
function rangeLeft(label: string, from: string, tilde: string, to: string, top: number): string {
  return `${place(Y(label), '16px', top, '84px', 40)}
${text(Y(label), 15, { muted: true })}
${place(Y(from), '104px', top, 'calc(100% - 120px)', 40)}
${place(Y(tilde), '78px', top + 48, '24px', 40)}
${text(Y(tilde), 15, { muted: true, align: 'center' })}
${place(Y(to), '104px', top + 48, 'calc(100% - 120px)', 40)}
${fillInput(Y(from))}
${fillInput(Y(to))}`;
}
/** 見出しを上に、その下に複数行の入力欄 */
function areaBelow(label: string, area: string, top: number): string {
  return `${place(Y(label), '16px', top, 'calc(100% - 32px)', 22)}
${text(Y(label), 15, { muted: true })}
${place(Y(area), '16px', top + 24, 'calc(100% - 32px)', 88)}
#${Y(area)} textarea { box-sizing: border-box !important; width: 100% !important; height: 100% !important; }`;
}
const YUKYU_CSS = `
/* 付与・ステータスの切り替え: パソコン向けの小さな飾りの印（画びょう・道・ベル）は出さない */
#frmApply_yukyu_tabApply > ul.tcc-tab-head i { display: none !important; }
${fullWidth('frmApply_yukyu')}
#frmApply_yukyu { height: auto !important; }
#frmApply_yukyu .tcc-tile.col { float: none !important; }
#${Y('lblTitle')} { display: none !important; }

/* 申請の情報（キャンセル・登録は、画面の下に固定した帯へ。bottomBars） */
#${Y('R1')}, #${Y('R1')} > *, #${Y('blank1')} { height: 140px !important; }
${labeled('lbl22', 'apply_no', 8)}
#${Y('apply_status')} { left: auto !important; right: 16px !important; top: 8px !important; width: 96px !important; height: 26px !important; }
/* 新しい申請では、「未申請」の札と「キャンセル」（戻るボタンと同じ）を出さない */
#frmApply_yukyu[data-myapp-new] #${Y('apply_status')},
:root:has(#frmApply_yukyu[data-myapp-new]) #${Y('btnCancel')} { display: none !important; }
${text(Y('apply_status'), 13, { bold: true, align: 'right' })}
${place(Y('lbl23'), '16px', 36, '72px', 26)}
${text(Y('lbl23'), 15, { muted: true })}
${place(Y('apply_dt'), '104px', 36, '120px', 26)}
${place(Y('apply_tm'), '228px', 36, '80px', 26)}
${text(Y('apply_dt'), 15)}
${text(Y('apply_tm'), 15)}
${labeled('lbl25', 'dept_nm', 64)}
${place(Y('lbl24'), '16px', 92, '72px', 40)}
${text(Y('lbl24'), 15, { muted: true })}
${place(Y('qbxEmp'), '104px', 92, 'calc(100% - 120px)', 40)}
${fillInput(Y('qbxEmp'))}
/* 新しく申請するとき（申請No がまだない）は、空の申請No・申請日時を出さずに詰める（JS が data-myapp-new を付ける） */
#frmApply_yukyu[data-myapp-new] :is(#${Y('lbl22')}, #${Y('apply_no')}, #${Y('lbl23')}, #${Y('apply_dt')}, #${Y('apply_tm')}) { display: none !important; }
#frmApply_yukyu[data-myapp-new] :is(#${Y('R1')}, #${Y('R1')} > *, #${Y('blank1')}) { height: 88px !important; }
#frmApply_yukyu[data-myapp-new] #${Y('lbl25')}, #frmApply_yukyu[data-myapp-new] #${Y('dept_nm')} { top: 8px !important; }
#frmApply_yukyu[data-myapp-new] #${Y('lbl24')}, #frmApply_yukyu[data-myapp-new] #${Y('qbxEmp')} { top: 36px !important; }

/* 入力欄。休暇時刻は「有休（時間単位）」のときだけ出す（JS が data-myapp-hourly を付ける） */
#${Y('R2')}, #${Y('R2')} > *, #${Y('blank2')} { height: 464px !important; }
#frmApply_yukyu[data-myapp-hourly] :is(#${Y('R2')}, #${Y('R2')} > *, #${Y('blank2')}) { height: 564px !important; }
#frmApply_yukyu:not([data-myapp-hourly]) :is(#${Y('lbl4')}, #${Y('tm_from')}, #${Y('lbl8')}, #${Y('tm_to')}) { display: none !important; }
${labeled('lbl1', 'apply_title', 8)}
/* タイトルは、値があるときだけ出す（新しい申請では空。JS が data-myapp-notitle を付ける） */
#frmApply_yukyu[data-myapp-notitle] :is(#${Y('lbl1')}, #${Y('apply_title')}) { display: none !important; }
/* タイトルを出さないときは、その下を 36px 上に詰める */
#frmApply_yukyu[data-myapp-notitle] #${Y('blank2_body')} > .tcc-component { transform: translateY(-36px); }
#frmApply_yukyu[data-myapp-notitle] :is(#${Y('R2')}, #${Y('R2')} > *, #${Y('blank2')}) { height: 428px !important; }
#frmApply_yukyu[data-myapp-notitle][data-myapp-hourly] :is(#${Y('R2')}, #${Y('R2')} > *, #${Y('blank2')}) { height: 528px !important; }
${place(Y('lbl33'), '16px', 44, '72px', 26)}
${text(Y('lbl33'), 15, { muted: true })}
/* 休暇種別の選択肢は、ほかの欄と同じく右の余白 16px まで */
${place(Y('apply_tp'), '104px', 40, 'calc(100% - 120px)', 65)}
/* 「?」（説明）は、見出し「休暇種別」のすぐ下に。押せる広さは 44pt */
${place(Y('lbl35'), '6px', 70, '44px', 44)}
${rangeLeft('lbl3', 'dt_from', 'lbl34', 'dt_to', 116)}
${rangeLeft('lbl4', 'tm_from', 'lbl8', 'tm_to', 216)}
${areaBelow('lbl9', 'reason', 216)}
${areaBelow('lbl10', 'remarks', 340)}
${scoped('#frmApply_yukyu[data-myapp-hourly]', areaBelow('lbl9', 'reason', 316))}
${scoped('#frmApply_yukyu[data-myapp-hourly]', areaBelow('lbl10', 'remarks', 440))}
/* 「?」は黒く目立たせず、灰色に */
#${Y('lbl35')} .tcc-label, #${Y('lbl35')} .tcc-label-text { width: 100% !important; height: 100% !important; font-size: 20px !important; justify-content: center !important; text-align: center !important; }
#${Y('lbl35')} i { color: var(--myapp-text2) !important; }
/* 休暇種別の選択肢: 枠の線をやめ、白いカードに */
#${Y('apply_tp')}, #${Y('apply_tp')} > * {
  border: none !important;
  border-radius: 16px !important;
  background-color: var(--myapp-fill) !important;
}
/* 必須の「＊」（欄の右の外に赤く出る）は出さない。入れなくてよい欄（備考）の見出しにだけ「任意」を添える */
#frmApply_yukyu [data-ezc-require]::after { display: none !important; }
#${Y('lbl10')} .tcc-label-text::after { content: '任意'; margin-left: 6px; font-size: 11px; font-weight: 400; color: var(--myapp-text2); }

/* 付与・使用・残りの日数（タブ）と、申請のステータス。いちばん知りたい残りの日数なので、画面のいちばん上に出す（JS が並べ替える） */
#${Y('R3')}, #${Y('R3')} > *, #${Y('blank3')} { height: 140px !important; }
#${Y('R3')}:has(#${Y('tabApply_tabs_1')}.active),
#${Y('R3')}:has(#${Y('tabApply_tabs_1')}.active) > *,
#${Y('R3')}:has(#${Y('tabApply_tabs_1')}.active) #${Y('blank3')},
#${Y('R3')}:has(#${Y('tabApply_tabs_2')}.active),
#${Y('R3')}:has(#${Y('tabApply_tabs_2')}.active) > *,
#${Y('R3')}:has(#${Y('tabApply_tabs_2')}.active) #${Y('blank3')} { height: 240px !important; }
#${Y('tabApply')} { left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; }
/* 付与・ステータスなどの切り替え: 画面の端から 16px あけた切り替えスイッチ */
#${Y('tabApply')} > ul.tcc-tab-head {
  display: flex !important;
  width: auto !important;
  margin: 4px 16px 0 !important;
  padding: 3px !important;
  box-sizing: border-box;
}
#${Y('tabApply')} > ul.tcc-tab-head > li { flex: 1 1 0 !important; min-width: 0 !important; }
#${Y('tabApply')} > ul.tcc-tab-head a { display: block !important; width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; text-align: center; font-size: 13px !important; padding-left: 0 !important; padding-right: 0 !important; }
#${Y('tabApply')} > .tcc-tab-content { height: calc(100% - 44px) !important; }
#${Y('tabApply_tabs_0')}, #${Y('tabApply_tabs_1')}, #${Y('tabApply_tabs_2')} { height: 100% !important; }
/* 代休申請・勤務表のまとめと同じ形: カードの左から 16px、3 列。見出しの下に大きな数字を左寄せで */
${place(Y('lbl13'), '32px', 24, 'calc((100% - 64px) / 3)', 22)}
${place(Y('lbl14'), 'calc(32px + (100% - 64px) / 3)', 24, 'calc((100% - 64px) / 3)', 22)}
${place(Y('lbl31'), 'calc(32px + (100% - 64px) * 2 / 3)', 24, 'calc((100% - 64px) / 3)', 22)}
${place(Y('grant_days1'), '32px', 48, 'calc((100% - 64px) / 3)', 32)}
${place(Y('num_use1'), 'calc(32px + (100% - 64px) / 3)', 48, 'calc((100% - 64px) / 3)', 32)}
${place(Y('remaining1'), 'calc(32px + (100% - 64px) * 2 / 3)', 48, 'calc((100% - 64px) / 3)', 32)}
${['lbl13', 'lbl14', 'lbl31'].map((id) => text(Y(id), 13, { muted: true })).join('')}
/* 「27日 6時間」と長いので、数字は 17px（20px だと隣の列とくっついて見える） */
${['grant_days1', 'num_use1', 'remaining1'].map((id) => text(Y(id), 17, { bold: true })).join('')}
:is(#${Y('lbl13')}, #${Y('lbl14')}, #${Y('lbl31')}, #${Y('grant_days1')}, #${Y('num_use1')}, #${Y('remaining1')}) :is(.tcc-label, .tcc-label-text) { padding-left: 0 !important; padding-right: 0 !important; }
:is(#${Y('grant_days1')}, #${Y('num_use1')}, #${Y('remaining1')}) .tcc-label-text { font-variant-numeric: tabular-nums; }
/* 付与・使用・残りの数字は、残業申請のその月の数字と同じく、白いカードの上に（灰色の地にじかに置かない）。
   数字の置き場所は変えずに、後ろにカードを敷く */
#${Y('tabApply_tabs_0')}::before {
  content: '';
  position: absolute;
  left: 16px;
  right: 16px;
  top: 10px;
  bottom: 0;
  border-radius: 22px;
  background-color: var(--myapp-fill);
  pointer-events: none;
}
/* 残りの日数をいちばん目立たせる（枠の線は出さない） */
:is(#${Y('grant_days1')}, #${Y('num_use1')}, #${Y('remaining1')}) .tcc-label { border: none !important; }
#${Y('remaining1')} .tcc-label-text { color: var(--myapp-accent) !important; }
#${Y('grdStatus')} { left: 16px !important; top: 8px !important; width: calc(100% - 32px) !important; height: calc(100% - 16px) !important; border-radius: 20px !important; overflow: hidden !important; }
/* 承認の流れがまだないときは、空の面を低く */
#frmApply_yukyu_tabApply .tcc-tab-pane:has(#${Y('grdStatus')}.myapp-empty) { height: 120px !important; }
${cardGrid(Y('grdStatus'), [[1, 2], [3, 4], [6]], { 4: '承認日' })}
${place(Y('comment'), '16px', 12, 'calc(100% - 32px)', 120)}
#${Y('comment')} textarea { box-sizing: border-box !important; width: 100% !important; height: 100% !important; }
`;

// ---------------------------------------------------------------------------
// ほかの申請画面（残業・特別休暇・振休・代休・休日出勤・遅刻早退）。どれも同じ作り:
//   R1 … 申請の情報（申請No・申請日・部署・申請者・状況）と、登録・キャンセル
//   R2 … 入力欄（画面ごとに違う）
//   R3 … その月の時間外などの数字（タブ）と、申請のステータス
// R1 は有給と同じ並べ方にする。R2 は、パソコン向けの座標を JS が読み、見出しと入力欄を1行ずつ縦に並べ直す（reflow）。
// R3 は数字を小さな札に並べ直して、画面のいちばん上に出す。登録・キャンセルは画面の下に固定する。
// ---------------------------------------------------------------------------
const APPLY_FORMS = [
  'frmApply_zangyo',
  'frmApply_tokkyu',
  'frmApply_hurikyu',
  'frmApply_daikyu',
  'frmApply_kyuzitu',
  'frmApply_chikokuSotai',
];
function applyFormCss(f: string): string {
  const F = (id: string) => `${f}_${id}`;
  const info = (label: string, value: string, top: number) => `${place(F(label), '16px', top, '80px', 26)}
${text(F(label), 15, { muted: true })}
${place(F(value), '104px', top, 'calc(100% - 120px)', 26)}
${text(F(value), 15)}`;
  return `
${fullWidth(f)}
#${f} { height: auto !important; }
#${f} .tcc-tile.col { float: none !important; }
#${F('lblTitle')} { display: none !important; }

/* 申請の情報（新しく申請するときは、空の申請No・申請日を出さずに詰める。JS が data-myapp-new を付ける） */
#${F('R1')}, #${F('R1')} > *, #${F('blank1')} { height: 140px !important; }
${info('lbl22', 'apply_no', 8)}
#${F('apply_status')} { left: auto !important; right: 16px !important; top: 8px !important; width: 96px !important; height: 26px !important; }
${text(F('apply_status'), 13, { bold: true, align: 'right' })}
${place(F('lbl23'), '16px', 36, '80px', 26)}
${text(F('lbl23'), 15, { muted: true })}
${place(F('apply_dt'), '104px', 36, '120px', 26)}
${place(F('apply_tm'), '228px', 36, '80px', 26)}
${text(F('apply_dt'), 15)}
${text(F('apply_tm'), 15)}
${info('lbl25', 'dept_nm', 64)}
${place(F('lbl24'), '16px', 92, '80px', 40)}
${text(F('lbl24'), 15, { muted: true })}
${place(F('qbxEmp'), '104px', 92, 'calc(100% - 120px)', 40)}
${fillInput(F('qbxEmp'))}
#${f}[data-myapp-new] :is(#${F('lbl22')}, #${F('apply_no')}, #${F('lbl23')}, #${F('apply_dt')}, #${F('apply_tm')}) { display: none !important; }
/* 新しい申請では、「未申請」の札と「キャンセル」（戻るボタンと同じ）を出さない。下の帯は「登録」だけになる */
#${f}[data-myapp-new] #${F('apply_status')},
:root:has(#${f}[data-myapp-new]) #${F('btnCancel')} { display: none !important; }
/* 新しい申請には、まだ「ステータス」（承認の流れ）もコメントもないので、その切り替えを出さない。
   その月の数字（.myapp-stats）がない申請では、下の段ごと出さない */
#${f}[data-myapp-new] #${F('tabApply')} > ul.tcc-tab-head { display: none !important; }
#${f}[data-myapp-new] #${F('R3')}:not(:has(.myapp-stats)) { display: none !important; }
#${f}[data-myapp-new] :is(#${F('R1')}, #${F('R1')} > *, #${F('blank1')}) { height: 88px !important; }
#${f}[data-myapp-new] :is(#${F('lbl25')}, #${F('dept_nm')}) { top: 8px !important; }
#${f}[data-myapp-new] :is(#${F('lbl24')}, #${F('qbxEmp')}) { top: 36px !important; }

/* 入力欄（JS が .myapp-row に並べ直す） */
#${F('R2')}, #${F('R2')} > *, #${F('blank2')}, #${F('blank2_body')} { height: auto !important; overflow: visible !important; }
#${F('blank2_body')} {
  display: flex !important;
  flex-direction: column !important;
  gap: 14px;
  padding: 16px !important;
  box-sizing: border-box !important;
}

/* その月の数字（JS が .myapp-stats に並べ直す）と、ステータス・コメント */
#${F('R3')}, #${F('R3')} > *, #${F('blank3')} { height: auto !important; overflow: visible !important; }
#${F('tabApply')} { position: relative !important; left: 0 !important; top: 0 !important; width: 100% !important; height: auto !important; }
#${F('tabApply')} > ul.tcc-tab-head {
  display: flex !important;
  width: auto !important;
  margin: 4px 16px 0 !important;
  padding: 3px !important;
  box-sizing: border-box;
}
#${F('tabApply')} > ul.tcc-tab-head > li { flex: 1 1 0 !important; min-width: 0 !important; }
#${F('tabApply')} > ul.tcc-tab-head a { display: block !important; width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; text-align: center; font-size: 13px !important; padding-left: 0 !important; padding-right: 0 !important; }
#${F('tabApply')} > .tcc-tab-content { position: relative !important; height: auto !important; }
#${F('tabApply_tabs_0')} { position: relative !important; height: auto !important; }
#${F('tabApply_tabs_1')}, #${F('tabApply_tabs_2')} { position: relative !important; height: 200px !important; }
#${F('tabApply')} .tcc-tab-pane:has([id$="_grdStatus"]) { height: 200px !important; }
#${F('grdStatus')} { left: 16px !important; top: 8px !important; width: calc(100% - 32px) !important; height: calc(100% - 16px) !important; border-radius: 20px !important; overflow: hidden !important; }
${cardGrid(F('grdStatus'), [[1, 2], [3, 4], [6]], { 4: '承認日' })}
${place(F('comment'), '16px', 12, 'calc(100% - 32px)', 160)}
#${F('comment')} textarea { box-sizing: border-box !important; width: 100% !important; height: 100% !important; }
`;
}

// 並べ直した入力欄・数字の札・「今日」などの小さなボタンの見た目（申請画面で共通）
const REFLOW_CSS = `
.myapp-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.myapp-row.myapp-hidden { display: none !important; }
.myapp-row > .tcc-component {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  height: 40px !important;
}
.myapp-row > .tcc-component[style*="visibility: hidden"] { display: none !important; }
/* 見出しは 80px に固定する（「休日出勤日」など長い見出しで広がると、右の入力欄が画面からはみ出す） */
.myapp-row > .myapp-heading { flex: 0 0 80px !important; width: 80px !important; min-width: 0 !important; max-width: 80px !important; box-sizing: border-box !important; padding: 0 !important; }
.myapp-row > .myapp-heading .tcc-label,
.myapp-row > .myapp-heading .tcc-label-text {
  width: 100% !important;
  padding: 0 !important;
  white-space: nowrap !important;
  letter-spacing: -0.02em;
  justify-content: flex-start !important;
  text-align: left !important;
  font-size: 15px !important;
  font-weight: 400 !important;
  color: var(--myapp-text2) !important;
  background: transparent !important;
  border: none !important;
}
/* 上の「部署 :」などと左をそろえる余白は、内側に付ける（外に付けると、右の入力欄の幅の計算がずれる） */
.myapp-row > .myapp-heading .tcc-label { box-sizing: border-box !important; padding-left: 6px !important; }
.myapp-row.myapp-indent { padding-left: 88px; }
.myapp-row > .myapp-sub { flex: 0 0 auto !important; width: auto !important; }
.myapp-row > .myapp-sub .tcc-label,
.myapp-row > .myapp-sub .tcc-label-text { width: auto !important; font-size: 13px !important; color: var(--myapp-text2) !important; }
.myapp-row > .myapp-field { flex: 1 1 0 !important; min-width: 0 !important; width: auto !important; }
.myapp-row > .myapp-field input,
.myapp-row > .myapp-field .text-box { box-sizing: border-box !important; width: 100% !important; height: 100% !important; }
.myapp-row > .myapp-field > div.icon-rt { left: auto !important; right: 4px !important; top: 0 !important; height: 100% !important; display: flex !important; align-items: center; }
.myapp-row > .myapp-area { flex: 1 1 100% !important; width: 100% !important; height: 96px !important; }
.myapp-row > .myapp-area textarea { box-sizing: border-box !important; width: 100% !important; height: 100% !important; }
.myapp-row > .myapp-value { flex: 1 1 0 !important; width: auto !important; }
.myapp-row > .myapp-value .tcc-label,
.myapp-row > .myapp-value .tcc-label-text { width: 100% !important; justify-content: flex-start !important; text-align: left !important; font-size: 15px !important; }
.myapp-row > .myapp-after { flex: 1 1 100% !important; width: auto !important; height: auto !important; padding-left: 88px; box-sizing: border-box !important; }
/* 欄の下の小さな説明は、欄の中の文字と同じ位置から始める（欄の左 + 12px） */
.myapp-row > .myapp-after .tcc-label { padding-left: 12px !important; }
/* 遅刻早退: 欄の下に出る「出勤した時刻（遅刻のとき）」は、欄の左端にそろえる */
#frmApply_chikokuSotai .myapp-row > .myapp-after .tcc-label { padding-left: 0 !important; }
.myapp-row > .myapp-after.myapp-blank { display: none !important; }
.myapp-row > .myapp-after .tcc-label,
.myapp-row > .myapp-after .tcc-label-text { width: 100% !important; justify-content: flex-start !important; text-align: left !important; font-size: 13px !important; color: var(--myapp-text2) !important; }
.myapp-row > .myapp-choice { flex: 1 1 0 !important; width: auto !important; height: auto !important; min-height: 40px; }
/* 選択肢（ラジオ・チェック）は、座標で置かず縦に1つずつ並べる（選択肢が多くても全部見えるように） */
.myapp-row > .myapp-choice > *,
.myapp-row > .myapp-choice .tcc-radio-group {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  height: auto !important;
  padding: 4px 0 !important;
  box-sizing: border-box !important;
}
/* 選択肢を囲む枠は出さない。ラジオの組だけは、ほかの入力欄と同じ白い面に（有給休暇申請の休暇種別と同じ。
   面がないと、ダークでは共通の灰色の面が出て、明るいときは地と同じ色で消える、と見え方がそろわない） */
.myapp-row > .myapp-choice,
.myapp-row > .myapp-choice > *,
.myapp-row > .myapp-choice .tcc-radio-group { border: none !important; background: transparent !important; }
.myapp-row > .myapp-choice.radio { background-color: var(--myapp-field) !important; border-radius: 16px !important; }
/* 1つ目の選択肢を、見出し（40px の行の真ん中）と同じ高さに */
.myapp-row > .myapp-choice.radio > *, .myapp-row > .myapp-choice .tcc-radio-group { padding-top: 3px !important; padding-bottom: 3px !important; }
.myapp-row > .myapp-choice .tcc-component {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  width: 100% !important;
  height: auto !important;
  min-height: 34px;
  display: flex !important;
  align-items: center;
  /* 選択肢の字と丸を、行（34px）の上下の真ん中に（この行は縦向きの flex なので justify で。EZCraft は上に寄せる） */
  justify-content: center !important;
  padding: 0 10px !important;
  box-sizing: border-box !important;
}
.myapp-row > .myapp-choice .tcc-component * { white-space: normal !important; }
.myapp-row > .myapp-choice .tcc-component { text-align: left !important; }
/* 選択肢の中身（丸と字）は左に寄せる。選択肢の行そのものは縦向きの flex なので、ここでは寄せない（上の justify-content: center で上下の真ん中に） */
.myapp-row > .myapp-choice .tcc-component > *,
.myapp-row > .myapp-choice label { justify-content: flex-start !important; text-align: left !important; }
.myapp-row > .myapp-choice .tcc-component > * { margin-left: 0 !important; margin-right: auto !important; width: auto !important; }
.myapp-row:has(> .myapp-choice) { align-items: flex-start; }
.myapp-row:has(> .myapp-choice) > .myapp-heading { height: 40px !important; }
/* 必須の「＊」（EZCraft が欄の右の外に赤く出す）は出さない。ほとんどの欄が必須なので、
   入れなくてよい欄の見出しにだけ「任意」を添える（JS が myapp-optional を付ける） */
.myapp-row [data-ezc-require]::after { display: none !important; }
.myapp-row > .myapp-heading.myapp-optional .tcc-label-text::after {
  content: '任意';
  margin-left: 6px;
  font-size: 11px;
  font-weight: 400;
  color: var(--myapp-text2);
  opacity: 0.8;
}

/* その月の数字: いちばん上に「総〜」を大きく、ほかは 0 でないものだけを小さな札で */
.myapp-stats {
  display: flex !important;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin: 12px 16px 4px !important;
  padding: 12px 16px !important;
  border-radius: 22px;
  background-color: var(--myapp-fill);
  box-sizing: border-box !important;
}
.myapp-stats-month { font-size: 13px; color: var(--myapp-text2); }
/* 札の左右の余白は、ページの側の「div の余白 0」より強く書く（字が札の左の端にくっつかないように） */
.myapp-stat { display: inline-flex; gap: 4px; align-items: baseline; padding: 2px 10px !important; border-radius: 999px; background-color: var(--myapp-inset); }
.myapp-stat-label { font-size: 12px; color: var(--myapp-text2); white-space: nowrap; }
.myapp-stat-value { font-size: 13px; font-weight: 600; color: var(--myapp-text); }
.myapp-stat[data-zero] { display: none; }
.myapp-stat.myapp-stat-main { margin-left: auto; background: transparent; padding: 0 !important; }
.myapp-stat.myapp-stat-main .myapp-stat-label { display: none; }
.myapp-stat.myapp-stat-main .myapp-stat-value { font-size: 20px; font-weight: 700; color: var(--myapp-text); }
.myapp-stats-break { flex-basis: 100%; height: 0; }
/* 「総〜」のないもの: 勤務表のまとめ（出勤・有休・…）と同じ、見出しの下に大きな数字の列 */
.myapp-stats.myapp-stats-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); gap: 8px 12px; padding: 14px 16px !important; }
.myapp-stats-grid .myapp-stat { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 0 !important; border-radius: 0; background: transparent; }
.myapp-stats-grid .myapp-stat-label { font-size: 13px; }
.myapp-stats-grid .myapp-stat-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.myapp-stats.myapp-stats-table { display: block !important; padding: 8px 12px !important; }
.myapp-stats table { width: 100%; border-collapse: collapse; }
.myapp-stats th, .myapp-stats td { padding: 6px 4px; font-size: 13px; text-align: right; white-space: nowrap; border: none !important; background: transparent !important; font-variant-numeric: tabular-nums; }
.myapp-stats tr:first-child th { font-size: 13px; font-weight: 400; color: var(--myapp-text2); }
.myapp-stats th.myapp-stats-rowname { text-align: left; font-weight: 400; color: var(--myapp-text); }
.myapp-stats td { color: var(--myapp-text2); }
.myapp-stats td.myapp-stats-last { font-weight: 700; color: var(--myapp-text); }

.myapp-chips { display: flex; flex-wrap: wrap; gap: 0 4px; margin-left: -4px; }
.myapp-chips.myapp-indent { padding-left: 88px; }
.myapp-chip {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  /* 押せる高さは 44pt（見た目の札は 36pt。上下 4pt は透明な縁で取る） */
  height: 44px;
  padding: 0 16px;
  border: 4px solid transparent;
  background-clip: padding-box;
  border-radius: 22px;
  background-color: var(--myapp-segment);
  color: var(--myapp-accent);
  font-size: 14px;
  font-weight: 600;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.myapp-chip:active { opacity: 0.6; }
`;

// ---------------------------------------------------------------------------
// プロジェクト選択（frmSelProj）: 勤怠実績登録のプロジェクトの「検索」で出るダイアログ。
// 画面いっぱいのシートにし、上に検索欄（打つたびに検索）、その下に1件1枚のカード（名前が上、番号・期間・顧客・チームが下）。
// カードを押したら、そのプロジェクトに決まる（OK・Cancel は出さない。閉じるのは上の ×）
// ---------------------------------------------------------------------------
const S = (id: string) => `frmSelProj_${id}`;
const PROJECT_SELECT_CSS = `
${sheetDialog('frmSelProj', [
  { id: 'R1', height: 64 },
  { id: 'R2', height: 'rest' },
])}
${searchBox('frmSelProj', 'txtQuery')}
/* タブ（プロジェクト・その他業務）と一覧: タブの見出しの下を、一覧が残りの高さいっぱいに使う
   （見出しの高さを決め打ちにすると、一覧の下のページ送りが画面の外に切れる） */
#${S('tabPrj')} {
  left: 0 !important;
  top: 0 !important;
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}
#${S('tabPrj')} > ul.tcc-tab-head { flex: none !important; width: auto !important; margin: 0 16px 8px !important; padding: 3px !important; box-sizing: border-box !important; }
#${S('tabPrj')} > ul.tcc-tab-head > li { flex: 1 1 0 !important; }
#${S('tabPrj')} > ul.tcc-tab-head > li > a { display: block !important; width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; text-align: center; }
#${S('tabPrj')} > .tcc-tab-content { position: relative !important; flex: 1 1 auto !important; min-height: 0 !important; height: auto !important; }
#${S('tabPrj_tabs_0')}, #${S('tabPrj_tabs_1')} { height: 100% !important; }
#${S('grdPrj1')}, #${S('grdPrj2')} { left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; }
/* 一覧は画面の幅いっぱいなので、枠と角の丸みは付けず、上に線だけ */
#${S('grdPrj1')}, #${S('grdPrj2')} { border: none !important; border-top: 1px solid var(--myapp-field-border) !important; border-radius: 0 !important; }
/* 最近使ったプロジェクト（JS が .myapp-recent を作る。押すと、その番号で探す）。あるときは、そのぶん上の段を高くする */
#frmSelProj[data-myapp-recent] #${S('R1')} { height: 108px !important; }
#frmSelProj[data-myapp-recent] #${S('R2')} { height: calc(100% - 108px) !important; }
.myapp-recent {
  position: absolute;
  left: 0;
  right: 0;
  top: 60px;
  height: 40px;
  display: flex;
  gap: 8px;
  padding: 0 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.myapp-recent::-webkit-scrollbar { display: none; }
.myapp-recent-label { flex: none; align-self: center; font-size: 12px; color: var(--myapp-text2); }
.myapp-recent button {
  -webkit-appearance: none;
  appearance: none;
  flex: none;
  max-width: 220px;
  height: 36px;
  margin: 2px 0;
  padding: 0 14px;
  border: none;
  border-radius: 18px;
  background-color: var(--myapp-tab-on);
  color: var(--myapp-accent-text);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
${cardGrid(S('grdPrj1'), [[4], [1, 2, 3], [6, 7]], { 1: 'No.', 3: '〜', 7: 'チーム' }, { pager: true })}
${cardGrid(S('grdPrj2'), [[4], [1, 2, 3], [6, 7]], { 1: 'No.', 3: '〜' }, { pager: true })}
${listToBottom('frmSelProj', [S('grdPrj1'), S('grdPrj2')])}
`;

// ---------------------------------------------------------------------------
// 社員選択（frmSelEmp）: 勤務表の「社員名」の検索で出るダイアログ。プロジェクト選択と同じ作り
// （カード: 名前が上、社員番号・かな・組織が下）
// ---------------------------------------------------------------------------
const E = (id: string) => `frmSelEmp_${id}`;
const EMPLOYEE_SELECT_CSS = `
${sheetDialog('frmSelEmp', [
  { id: 'R1', height: 64 },
  { id: 'R2', height: 'rest' },
])}
${searchBox('frmSelEmp', 'txtEmp')}
#${E('grdEmp')} { left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; }
#${E('grdEmp')} { border: none !important; border-top: 1px solid var(--myapp-border) !important; border-radius: 0 !important; }
${cardGrid(E('grdEmp'), [[2], [1, 3], [5]], {}, { pager: true })}
${listToBottom('frmSelEmp', [E('grdEmp')])}
`;

// ---------------------------------------------------------------------------
// 時刻・時間の欄（欄の ID → ダイヤルのシートの題名）。押すと、キーボードではなく、時と分を回して選ぶシートを出す（JS の openDial）
// ---------------------------------------------------------------------------
const TIME_DIALS: Record<string, string> = {
  [D('work_stt_tm')]: '出勤',
  [D('work_end_tm')]: '退勤',
  ...Object.fromEntries([1, 2, 3, 4].flatMap((n) => [[D(`break_tm_from${n}`), '休憩の開始'], [D(`break_tm_to${n}`), '休憩の終了']])),
  ...Object.fromEntries([1, 2].flatMap((n) => [[D(`leave_tm_from${n}`), '休暇の開始'], [D(`leave_tm_to${n}`), '休暇の終了']])),
  // プロジェクトごとの作業の時間（時刻ではなく長さ。JS は ID の txtTime で見分ける）
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [D(`txtTime${n}`), '作業の時間'])),
  [Y('tm_from')]: '休暇の開始',
  [Y('tm_to')]: '休暇の終了',
  frmApply_zangyo_tm_from: '残業の開始',
  frmApply_zangyo_tm_to: '残業の終了',
  frmApply_chikokuSotai_tm_from: '出勤の時刻',
  frmApply_chikokuSotai_tm_to: '退勤の時刻',
  frmApply_kyuzitu_tm_from: '出勤',
  frmApply_kyuzitu_tm_to: '退勤',
  ...Object.fromEntries(['tokkyu', 'hurikyu', 'daikyu'].flatMap((f) => [[`frmApply_${f}_tm_from`, '開始'], [`frmApply_${f}_tm_to`, '終了']])),
};

/**
 * 残業の計算（ページの中の SCRIPT に入れる）。時刻の読み書きと、残業の時間帯の始まり。
 * ページのほかの部分に頼らない計算だけなので、ここだけ分けてテストする（src/__tests__/overtime-test.ts）
 */
export const OVERTIME_MATH_JS = `
  function minutesOf(t) {
    var m = /^(\\d{1,2}):?(\\d{2})$/.exec(String(t || '').trim());
    return m ? +m[1] * 60 + +m[2] : null;
  }
  // 分を「H:MM」にする（負の値・数でないものは空。0 時より前の時刻を入力欄に入れないように）
  function hhmm(min) {
    if (typeof min !== 'number' || !isFinite(min) || min < 0) return '';
    min = Math.round(min);
    return Math.floor(min / 60) + ':' + ('0' + (min % 60)).slice(-2);
  }
  // 残業の始まり: 退勤から、休憩の時間を飛ばしながら、残業のぶん（分）だけさかのぼった時刻。
  // breaks は [{ from, to }]（分）。夕方の休憩（18:00〜18:30 など）を残業の時間帯に入れないため
  function overtimeStart(end, minutes, breaks) {
    var cur = end;
    var left = minutes;
    var list = breaks.filter(function (b) { return b.to > b.from && b.from < end; })
      .sort(function (a, b) { return b.to - a.to; });
    for (var i = 0; i < list.length && left > 0; i++) {
      var b = list[i];
      var to = Math.min(b.to, cur);
      if (to < cur) {
        var take = Math.min(left, cur - to);
        cur -= take;
        left -= take;
        if (left <= 0) break;
      }
      if (b.from < cur) cur = b.from;
    }
    return cur - left;
  }
`;

// ---------------------------------------------------------------------------
// ページの中で動かすもの（画面が変わるたびに呼ばれる。同じ結果なら何も書き換えない）
// ---------------------------------------------------------------------------
const SCRIPT = `
(function () {
  function markDays() {
    var rpt = document.getElementById('frmAttendance_rptWork');
    var body = rpt && rpt.querySelector('.tcc-rpt-body');
    if (!body) return;
    if (!rpt.hasAttribute('data-myapp-nodark')) rpt.setAttribute('data-myapp-nodark', '');
    // 一覧の見出し（「2026年11月 【社員番号】 名前」）から年を、各行の「11/16(月)」から月日を読む
    var title = (rpt.querySelector('.tcc-rpt-title') || {}).textContent || '';
    var ym = title.match(/(\\d{4})年/);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var hasTop = false;
    // 勤怠登録の通知のため、一覧の月（見出しの「2026年11月」）の日ごとの状態を集める（reportDays）
    var listYm = title.match(/(\\d{4})年(\\d{1,2})月/);
    var codes = [];
    var rows = 0;
    Array.prototype.forEach.call(body.children, function (row) {
      if (!row.classList.contains('tcc-rpt-row')) return;
      var dateEl = row.querySelector('[id^="frmAttendance_dispDt"] .tcc-label-text');
      var m = ((dateEl && dateEl.textContent) || '').trim().match(/^(\\d{1,2})\\/(\\d{1,2})/);
      var kind = 'blank';
      var order = 9;
      if (m) {
        // 締め日の都合で、一覧が年をまたぐ（12 月の一覧に 1 月の行がある・1 月の一覧に 12 月の行がある）ときは、行の年をずらす
        var year = ym ? +ym[1] : now.getFullYear();
        var titleMonth = listYm ? +listYm[2] : 0;
        if (titleMonth >= 11 && +m[1] <= 2) year += 1;
        else if (titleMonth && titleMonth <= 2 && +m[1] >= 11) year -= 1;
        var time = new Date(year, +m[1] - 1, +m[2]).getTime();
        var statusEl = row.querySelector('[id^="frmAttendance_biko"]');
        var status = ((statusEl && statusEl.textContent) || '').trim();
        if (time === today) { kind = 'today'; order = 1; }
        else if (status === '未登録' && time < today) { kind = 'todo'; order = 2; }
        else if (status === '未登録') { kind = 'future'; order = 4; }
        else if (/休日$/.test(status)) { kind = 'off'; order = 4; }
        else { kind = 'day'; order = 4; }
        if (order < 4) hasTop = true;
        if (listYm && +m[1] === +listYm[2]) {
          codes[+m[2] - 1] = status === '未登録' ? 'u' : /休日$/.test(status) ? 'o' : status ? 'r' : '-';
          rows++;
        }
      }
      if (row.getAttribute('data-myapp-day') !== kind) row.setAttribute('data-myapp-day', kind);
      var icon = row.querySelector('[id^="frmAttendance_lblIcon"] i');
      var color = (icon && icon.style.color) || '';
      // 黒いアイコン（承認済みのしるしなど）は、ダークでは地に溶けて見えないので、灰色にする
      var rgb = /^rgb\\((\\d+), (\\d+), (\\d+)\\)$/.exec(color);
      if (color === 'black' || (rgb && +rgb[1] < 90 && +rgb[2] < 90 && +rgb[3] < 90)) color = '';
      if (row.style.getPropertyValue('--myapp-day-color') !== color) row.style.setProperty('--myapp-day-color', color);
      if (row.style.order !== String(order)) row.style.order = String(order);
      // 時刻の書き方をそろえる（「残業 00:30」→「残業 0:30」。アプリのほかの所と同じ）
      fixTimes(row.querySelector('[id^="frmAttendance_biko"] .tcc-label-text'));
    });
    if (listYm) reportDays(+listYm[1], +listYm[2], codes, rows);
    // 月末（25日から）か、過ぎた月を見ているときは、勤務表申請を上に出す（CSS）
    var ymInput = document.getElementById('frmAttendance_yrmWork');
    ymInput = ymInput && ymInput.querySelector('input');
    var vm = ymInput && /^(\\d{4})\\/(\\d{1,2})$/.exec(ymInput.value.trim());
    var monthEnd = false;
    if (vm) {
      var viewing = +vm[1] * 12 + +vm[2];
      var current = now.getFullYear() * 12 + now.getMonth() + 1;
      monthEnd = viewing < current || (viewing === current && now.getDate() >= 25);
    }
    var attForm = document.getElementById('frmAttendance');
    if (attForm && attForm.hasAttribute('data-myapp-monthend') !== monthEnd) attForm.toggleAttribute('data-myapp-monthend', monthEnd);
    var hasDays = !!body.querySelector(':scope > .tcc-rpt-row');
    if (attForm && attForm.hasAttribute('data-myapp-days') !== hasDays) attForm.toggleAttribute('data-myapp-days', hasDays);
    head(body, 'top', hasTop ? '今日と未登録の日' : '', 0);
    head(body, 'rest', hasTop ? 'ほかの日' : '', 3);
  }
  // 勤怠登録の通知（src/attendanceReminder.ts）: 見ている月の、日ごとの状態をアプリに知らせる（変わったときだけ）。
  //   u: 未登録（勤務日）  o: 休日  r: 登録した日（休暇も）  -: 分からない
  // 一覧の行が月の日数そろってから知らせる（読み直しの途中の、行が欠けたものは知らせない）。
  // ほかの人の表も見る人（管理する人）の画面では、出ている表が自分のものとは限らないので、知らせない
  var lastDays = '';
  function reportDays(year, month, codes, rows) {
    var size = new Date(year, month, 0).getDate();
    if (rows !== size || isManager()) return;
    var days = '';
    for (var i = 0; i < size; i++) days += codes[i] || '-';
    var key = year + '-' + (month < 10 ? '0' : '') + month;
    if (key + days === lastDays) return;
    lastDays = key + days;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'attendanceDays', month: key, days: days })); } catch (e) {}
  }
  // 申請の一覧の題名（2026/11/09_岡崎　昂功_有休）を「2026/11/09・岡崎 昂功・有休」で見せる（見せるだけ。CSS が data-myapp-title を出す）
  // あわせて、題名の最後（有休・勤務表）と同じ言葉の列は二重なので隠し（data-myapp-dup）、
  // 状況（承認済・申請中・差戻 など）は色の付いた札にする（data-myapp-state。CSS）
  var STATES = [[/承認済|完了/, 'ok'], [/申請中|承認待|未承認|処理中/, 'wait'], [/差戻|却下|取消|取下/, 'ng']];
  function applyTitles() {
    ['frmApply_grdSearch', 'frmApply_grdApprove'].forEach(function (g) {
      document.querySelectorAll('#' + g + ' .TccGridBodyScroll tbody tr').forEach(function (tr) {
        var td = tr.querySelector('td.' + g + '_tdCol4');
        if (!td) return;
        var raw = (td.textContent || '').trim();
        var parts = raw.indexOf('_') >= 0 ? raw.split('_').map(function (p) { return p.replace(/[\\s\\u3000]+/g, ' ').trim(); }).filter(Boolean) : [];
        // 年月だけの頭（202610）は「2026/10」に
        if (parts.length && /^\\d{6}$/.test(parts[0])) parts[0] = parts[0].slice(0, 4) + '/' + parts[0].slice(4);
        var t = parts.join('・');
        if ((td.getAttribute('data-myapp-title') || '') !== t) {
          if (t) td.setAttribute('data-myapp-title', t);
          else td.removeAttribute('data-myapp-title');
        }
        var kind = parts.length ? parts[parts.length - 1] : '';
        Array.prototype.forEach.call(tr.children, function (cell) {
          if (cell === td) return;
          var text = (cell.textContent || '').trim();
          var dup = !!kind && text === kind;
          if (cell.hasAttribute('data-myapp-dup') !== dup) cell.toggleAttribute('data-myapp-dup', dup);
          var state = '';
          if (text && text.length <= 6) STATES.forEach(function (s) { if (!state && s[0].test(text)) state = s[1]; });
          if ((cell.getAttribute('data-myapp-state') || '') !== state) {
            if (state) cell.setAttribute('data-myapp-state', state);
            else cell.removeAttribute('data-myapp-state');
          }
        });
      });
    });
  }
  // 休暇照会: 1つの休暇（有休など）が「付与数・使用数・残数」の3行に分かれ、休暇の名前は真ん中の行にしかない。
  // どのカードにも「有休・付与数」のような見出しを付ける（CSS が data-myapp-head を出す。見出しに入れた「付与数」の列は隠す）
  function leaveCards() {
    var rows = document.querySelectorAll('#frmApply_grdLeave .TccGridBodyScroll tbody tr');
    var groups = [];
    Array.prototype.forEach.call(rows, function (tr) {
      var kind = tr.querySelector('td.frmApply_grdLeave_tdCol2');
      var k = kind ? (kind.textContent || '').trim() : '';
      if (!k) return;
      if (!groups.length || k === '付与数') groups.push([]);
      groups[groups.length - 1].push(tr);
    });
    groups.forEach(function (g) {
      var name = '';
      g.forEach(function (tr) {
        var c1 = tr.querySelector('td.frmApply_grdLeave_tdCol1');
        var t = c1 ? (c1.textContent || '').trim() : '';
        if (t && !name) name = t;
      });
      g.forEach(function (tr) {
        var c1 = tr.querySelector('td.frmApply_grdLeave_tdCol1');
        var c2 = tr.querySelector('td.frmApply_grdLeave_tdCol2');
        if (!c1 || !c2) return;
        var head = name ? name + '・' + (c2.textContent || '').trim() : '';
        if ((c1.getAttribute('data-myapp-head') || '') !== head) {
          if (head) c1.setAttribute('data-myapp-head', head);
          else c1.removeAttribute('data-myapp-head');
        }
        if (c2.hasAttribute('data-myapp-dup') !== !!head) c2.toggleAttribute('data-myapp-dup', !!head);
      });
    });
  }
  // 勤務表の日の行: 左肩の申請の札（有休など）が、右の状態（有休）と同じ言葉なら、二重になるので札は出さない（CSS）。
  // LSmart Holiday の札は、お知らせと同じ「L-SMART Holiday」と書く
  function dayBadges() {
    document.querySelectorAll('#frmAttendance_rptWork .tcc-rpt-row').forEach(function (row) {
      var rib = row.querySelector('.ribon span');
      var status = row.querySelector('[id^="frmAttendance_biko"]');
      var dup = !!rib && !!status && (rib.textContent || '').trim() !== '' && (status.textContent || '').indexOf((rib.textContent || '').trim()) >= 0;
      if (row.hasAttribute('data-myapp-dupbadge') !== dup) row.toggleAttribute('data-myapp-dupbadge', dup);
      var hl = row.querySelector('.lsmartHl');
      if (hl && /LSmart/i.test(hl.textContent || '')) {
        var w = document.createTreeWalker(hl, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = w.nextNode())) {
          var v = node.nodeValue.replace(/LSmart/gi, 'L-SMART');
          if (v !== node.nodeValue) node.nodeValue = v;
        }
      }
    });
  }
  // 勤務表出力の日付（2026/11/01）を、勤務表のタブと同じ「11/01(日)」で見せる。文字は書き換えず（まとめて申請が日付を読む）、
  // 印（data-myapp-date）を付けて CSS で出す
  function outputDates() {
    document.querySelectorAll('#frmAttendance_grdAttd .TccGridBodyScroll td.frmAttendance_grdAttd_tdCol1').forEach(function (td) {
      var m = /(\\d{4})\\/(\\d{2})\\/(\\d{2})/.exec(td.textContent || '');
      var label = m ? m[2] + '/' + m[3] + '(' + '日月火水木金土'.charAt(new Date(+m[1], +m[2] - 1, +m[3]).getDay()) + ')' : '';
      if ((td.getAttribute('data-myapp-date') || '') !== label) {
        if (label) td.setAttribute('data-myapp-date', label);
        else td.removeAttribute('data-myapp-date');
      }
    });
  }
  // 入力の画面の中の時間の札（勤務時間・合計）は、EZCraft が登録のときに読むかもしれないので、文字は書き換えない。
  // 頭の 0 を取った形（08:00 → 8:00）を data-myapp-time に入れ、CSS でそれを見せる
  function showTimes(ids) {
    ids.forEach(function (id) {
      var el = document.querySelector('#' + id + ' .tcc-label-text');
      if (!el) return;
      var m = /^\\s*0?(\\d{1,2}:\\d{2})\\s*$/.exec(el.textContent || '');
      var t = m ? m[1] : '';
      if ((el.getAttribute('data-myapp-time') || '') !== t) {
        if (t) el.setAttribute('data-myapp-time', t);
        else el.removeAttribute('data-myapp-time');
      }
    });
  }
  // 時刻の頭の 0 を取る（00:30 → 0:30、09:00 → 9:00）。同じなら書き換えない
  function fixTimes(el) {
    if (!el) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var v = node.nodeValue.replace(/(^|[^\\d:])0(\\d:\\d\\d)/g, '$1$2');
      if (v !== node.nodeValue) node.nodeValue = v;
    }
  }
  // 日を押したら、次の画面が開くまで、その行に読み込み中の印を出す（押したことがすぐ分かるように）。
  // iOS は指を離すとすぐ mousedown を送り、click は少し遅れて送るので、mousedown で出す（スクロールでは送られない）
  document.addEventListener('mousedown', function (e) {
    var row = e.target && e.target.closest && e.target.closest('#frmAttendance_rptWork .tcc-rpt-row');
    if (!row) return;
    row.classList.add('myapp-opening');
    setTimeout(function () { row.classList.remove('myapp-opening'); }, 4000);
  }, true);
  // 一覧の中の小見出し（なければ作り、要らなければ消す）
  function head(body, key, label, order) {
    var el = body.querySelector('.myapp-att-head[data-key="' + key + '"]');
    if (!label) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'myapp-att-head';
      el.setAttribute('data-key', key);
      body.appendChild(el);
    }
    if (el.textContent !== label) el.textContent = label;
    if (el.style.order !== String(order)) el.style.order = String(order);
  }

  // 勤務表: 健康管理時間を、数字と目標の棒で見せる
  function num(id) {
    var el = document.getElementById('frmAttendance_' + id);
    var m = el && (el.textContent || '').match(/\\d+(\\.\\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function kenkoCard() {
    var body = document.getElementById('frmAttendance_blank3_body');
    var now = num('lbl_kenko_hour');
    if (!body || now === null) return;
    var goal = num('lbl_kenko_hour2');
    var limit = num('lbl_kenko_hour1');
    var card = body.querySelector('.myapp-kenko');
    if (!card) {
      card = document.createElement('div');
      card.className = 'myapp-kenko';
      card.setAttribute('data-myapp-nodark', '');
      body.appendChild(card);
    }
    // 見ている月（勤務年月）が今月でなければ「10月の」のように出す
    var ymInput = document.querySelector('#frmAttendance_yrmWork input');
    var ym = ymInput && /^(\\d{4})\\/(\\d{1,2})$/.exec(ymInput.value.trim());
    var today = new Date();
    var month = !ym || (+ym[1] === today.getFullYear() && +ym[2] === today.getMonth() + 1) ? '今月' : +ym[2] + '月';
    var key = [now, goal, limit, month].join('/');
    if (card.__key === key) return;
    card.__key = key;
    var max = limit || goal || now || 1;
    var pct = function (v) { return Math.max(0, Math.min(100, (v / max) * 100)); };
    card.setAttribute('data-level', limit && now > limit ? 'limit' : goal && now > goal ? 'over' : 'ok');
    card.innerHTML =
      '<div class="myapp-kenko-top"><span>' + month + 'の健康管理時間</span><span><b>' + now + '</b>' + (goal ? ' / ' + goal : '') + ' 時間</span></div>' +
      '<div class="myapp-kenko-bar"><div class="myapp-kenko-fill" style="width:' + pct(now) + '%"></div>' +
      (goal ? '<div class="myapp-kenko-mark" style="left:' + pct(goal) + '%"></div>' : '') + '</div>' +
      '<div class="myapp-kenko-note">' + (goal ? '目標は ' + goal + ' 時間以内' : '') + (limit ? '・' + limit + ' 時間を超えるのは厳禁' : '') + '</div>';
  }

  // 勤務表: 月の集計（横に長い表）から、0 でない項目だけを札にして出す
  function summary() {
    var pane = document.getElementById('frmAttendance_tabAttd_tabs_0');
    var grid = document.getElementById('frmAttendance_grdWorkTotal');
    if (!pane || !grid) return;
    var heads = {};
    grid.querySelectorAll('.TccGridHeadScroll th').forEach(function (th) {
      var m = th.className.match(/_tdCol(\\d+)/);
      if (m && getComputedStyle(th).display !== 'none') heads[m[1]] = (th.textContent || '').trim();
    });
    var chips = [];
    var tr = grid.querySelector('.TccGridBodyScroll tbody tr');
    if (tr) tr.querySelectorAll('td').forEach(function (td) {
      var m = td.className.match(/_tdCol(\\d+)/);
      if (!m || !heads[m[1]]) return;
      var v = (td.textContent || '').trim();
      if (!v || /^0+([.:]0+)?$/.test(v)) return;
      chips.push([heads[m[1]], v]);
    });
    var box = pane.querySelector('.myapp-att-summary');
    if (!box) {
      box = document.createElement('div');
      box.className = 'myapp-att-summary';
      box.setAttribute('data-myapp-nodark', '');
      pane.insertBefore(box, pane.firstChild);
    }
    var key = JSON.stringify(chips);
    if (box.__key === key) return;
    box.__key = key;
    box.textContent = '';
    chips.forEach(function (c) {
      var chip = document.createElement('span');
      chip.className = 'myapp-att-chip';
      if (/申請/.test(c[0])) chip.setAttribute('data-kind', 'status');
      chip.appendChild(document.createTextNode(c[0].replace(/\\((日|時間|時)\\)$/, '')));
      var b = document.createElement('b');
      b.textContent = c[1];
      chip.appendChild(b);
      box.appendChild(chip);
    });
  }

  // 勤務表: 勤務年月を変えたら、「検索」を押さなくても読み込む
  var lastYm = null;
  function autoMonth() {
    var input = document.querySelector('#frmAttendance_yrmWork input');
    if (!input) return;
    if (lastYm === null) { lastYm = input.value; return; }
    if (input.value !== lastYm && /^\\d{4}\\/\\d{1,2}$/.test(input.value)) {
      lastYm = input.value;
      var b = document.querySelector('#frmAttendance_btnCalendarSearch .tcc-btn');
      if (b) b.click();
    }
  }

  // 勤務表: 勤務年月の右に「前の月・次の月」。押すと月を変えて読み込む（管理する人の画面では出さない。CSS）
  function monthNav() {
    var comp = document.getElementById('frmAttendance_yrmWork');
    if (!comp || comp.parentElement.querySelector(':scope > .myapp-month-nav')) return;
    comp.parentElement.appendChild(makeMonthNav(comp, function (ym) {
      lastYm = ym;
      var search = document.querySelector('#frmAttendance_btnCalendarSearch .tcc-btn');
      if (search) search.click();
    }));
  }
  // 「前の月・次の月」のボタン。押すと年月の欄（comp）を1か月ずらし、onPick(新しい年月) を呼ぶ
  function makeMonthNav(comp, onPick) {
    var nav = document.createElement('div');
    nav.className = 'myapp-month-nav';
    nav.setAttribute('data-myapp-nodark', '');
    [['‹', -1, '前の月'], ['›', 1, '次の月']].forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = d[0];
      b.setAttribute('aria-label', d[2]);
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var input = comp.querySelector('input');
        var m = input && /^(\\d{4})\\/(\\d{1,2})$/.exec(input.value.trim());
        if (!m) return;
        var y = +m[1];
        var mo = +m[2] + d[1];
        if (mo < 1) { mo = 12; y -= 1; }
        if (mo > 12) { mo = 1; y += 1; }
        var ym = y + '/' + (mo < 10 ? '0' : '') + mo;
        typeInto(input, ym);
        onPick(ym);
      });
      nav.appendChild(b);
    });
    return nav;
  }

  // 勤務表のほかのタブ: 検索の条件を1行ずつ（見出し＋入力欄）に並べ直し、ボタンは下にまとめる。
  // 「が」「時間」のような短い言葉は、前の入力欄と同じ行に置く（抽出条件: [項目] が [数] 時間 [以上]）
  var KINDS = ['lbl', 'text', 'btn', 'radio', 'chkbox', 'list', 'switch', 'grid', 'hline', 'vline'];
  function kindOf(el) {
    for (var i = 0; i < KINDS.length; i++) if (el.classList.contains(KINDS[i])) return KINDS[i];
    return 'other';
  }
  function reflowSearch(pane) {
    if (pane.__myappSearch) return;
    var items = Array.prototype.filter.call(pane.children, function (c) {
      return c.classList && c.classList.contains('tcc-component');
    }).map(function (c) {
      return { el: c, kind: kindOf(c), left: px(c.style.left), top: px(c.style.top) };
    }).filter(function (it) {
      if (it.kind === 'grid' || it.kind === 'hline' || it.kind === 'vline') return false;
      if (it.el.style.visibility === 'hidden') return false;
      if (it.kind === 'lbl' && !(it.el.textContent || '').trim()) return false;
      return true;
    });
    if (items.length === 0) return;
    pane.__myappSearch = true;
    var box = document.createElement('div');
    box.className = 'myapp-search';
    box.setAttribute('data-myapp-nodark', '');
    var buttons = [];
    var bulk = [];
    var lines = [];
    items.sort(function (a, b) { return a.top - b.top || a.left - b.left; });
    items.forEach(function (it) {
      // 一括の操作（一括承認・一括却下と「すべてチェック」）は、検索とは分けて一覧の上に置く
      if (/一括/.test(it.el.textContent || '') || /_chkDoAll$/.test(it.el.id)) { bulk.push(it); return; }
      if (it.kind === 'btn') { buttons.push(it); return; }
      var last = lines[lines.length - 1];
      if (last && Math.abs(last.top - it.top) <= 20) last.items.push(it);
      else lines.push({ top: it.top, items: [it] });
    });
    lines.forEach(function (line) {
      line.items.sort(function (a, b) { return a.left - b.left; });
      var row = null;
      var hasField = false;
      var lineHasLabel = line.items.some(function (it) { return it.kind === 'lbl'; });
      line.items.forEach(function (it) {
        var text = (it.el.textContent || '').trim();
        var connector = it.kind === 'lbl' && text.length <= 2 && hasField;
        // 長い文（「※ あなたが承認すべき申請の一覧です」など）は見出しではなく、幅いっぱいの注意書きにする
        if (it.kind === 'lbl' && !connector && text.length > 12) {
          row = null;
          var note = document.createElement('div');
          note.className = 'myapp-row myapp-note-row';
          it.el.classList.add('myapp-note');
          note.appendChild(it.el);
          box.appendChild(note);
          return;
        }
        if (it.kind === 'lbl' && !connector) {
          row = document.createElement('div');
          row.className = 'myapp-row';
          box.appendChild(row);
          hasField = false;
          it.el.classList.add('myapp-heading');
          if (text.replace(/[\\s:：]/g, '').length > 6) it.el.classList.add('myapp-long');
          row.appendChild(it.el);
          return;
        }
        if (!row) {
          row = document.createElement('div');
          // 見出しのない行: 前の見出しの続き（選択肢の2行目など）は字下げし、見出しのない行（検索の欄だけ）は幅いっぱいに
          row.className = !lineHasLabel && box.children.length > 0 ? 'myapp-row myapp-indent' : 'myapp-row';
          box.appendChild(row);
        }
        if (it.kind === 'lbl') it.el.classList.add('myapp-sub');
        else if (it.kind === 'switch') { it.el.classList.add('myapp-switch-field'); row.classList.add('myapp-switch-row'); }
        else if (it.kind === 'radio' || it.kind === 'chkbox' || it.kind === 'list') it.el.classList.add('myapp-choice');
        else { it.el.classList.add('myapp-field'); hasField = true; }
        // 組織・社員・ほかの人をしぼる条件は、管理する人だけが使う（自分の分だけを見る人には出さない）
        if (MANAGER_ONLY.test(it.el.id)) row.classList.add('myapp-manager-only');
        row.appendChild(it.el);
        // 年月の欄は、勤務表のタブと同じ「‹ 年月 ›」の1つのカプセルにする（‹ › を押したら、その月で検索し直す）
        if (/_yrm[A-Za-z]+$/.test(it.el.id)) {
          row.classList.add('myapp-month-row');
          var nav = makeMonthNav(it.el, function () {
            var go = pane.querySelector('.myapp-search-go .tcc-btn');
            if (go) setTimeout(function () { go.click(); }, 50);
          });
          var pill = document.createElement('div');
          pill.className = 'myapp-month-pill';
          pill.setAttribute('data-myapp-nodark', '');
          row.appendChild(pill);
          pill.appendChild(nav.children[0]);
          pill.appendChild(it.el);
          pill.appendChild(nav.children[0]);
        }
      });
    });
    // チェックボックスが2つ以上並ぶ行（表示対象・申請状況 など）は、1つの「折り返す選択肢の組」にまとめる。
    // 次の行が見出しのないチェックボックスだけの行（選択肢の2行目）なら、それも同じ組に入れる（文字が重ならず、全部読める）
    Array.prototype.slice.call(box.querySelectorAll(':scope > .myapp-row')).forEach(function (row) {
      var boxes = Array.prototype.filter.call(row.children, function (c) {
        return c.classList.contains('myapp-choice') && c.classList.contains('chkbox');
      });
      if (!boxes.length) return;
      var prev = row.previousElementSibling;
      var group = null;
      if (boxes.length === row.children.length && prev && prev.__myappChoices) group = prev.__myappChoices;
      if (!group) {
        if (boxes.length < 2) return;
        group = document.createElement('div');
        group.className = 'myapp-choice-wrap';
        row.insertBefore(group, boxes[0]);
        row.__myappChoices = group;
      }
      boxes.forEach(function (c) { group.appendChild(c); });
      if (!row.children.length) row.remove();
    });
    var actions = null;
    if (buttons.length) {
      actions = document.createElement('div');
      actions.className = 'myapp-search-actions';
      // 「検索」（「表示」）を右に大きく。CSV出力・クリアなどはその左に
      var GO = /検索|表示/;
      buttons.sort(function (a, b) {
        var sa = GO.test(a.el.textContent || '') ? 1 : 0;
        var sb = GO.test(b.el.textContent || '') ? 1 : 0;
        return sa - sb;
      });
      buttons.forEach(function (it) {
        if (GO.test(it.el.textContent || '')) it.el.classList.add('myapp-search-go');
        actions.appendChild(it.el);
      });
      box.appendChild(actions);
    }
    // 条件の行が多いときは、ふだんは閉じておく（自分の分は開いたときに検索するので、まず結果を見せる）
    var condRows = box.querySelectorAll(':scope > .myapp-row:not(.myapp-note-row)').length;
    if (condRows >= 4) {
      box.classList.add('myapp-collapsible');
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'myapp-search-toggle';
      // 閉じているときも、どの月の結果かが分かるように、右に年月を出す（toggleSummary）
      toggle.innerHTML = '<span>検索の条件</span><span class="myapp-search-toggle-value"></span>';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        var open = !box.classList.contains('myapp-open');
        box.classList.toggle('myapp-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      box.insertBefore(toggle, box.firstChild);
      // CSV出力などの「検索」以外のボタンは、閉じた条件の中に隠さず、条件の下にいつも出す（今の条件のまま出力する）
      var outs = actions ? Array.prototype.filter.call(actions.children, function (el) {
        return !el.classList.contains('myapp-search-go') && /出力|ダウンロード|CSV|Excel/i.test(el.textContent || '');
      }) : [];
      if (outs.length) {
        var exportRow = document.createElement('div');
        exportRow.className = 'myapp-export';
        outs.forEach(function (el) { exportRow.appendChild(el); });
        // 条件（開くと出る）と「検索」の下、いちばん下に置く。閉じているときは、見出しのすぐ下に見える
        box.appendChild(exportRow);
      }
    }
    if (bulk.length) {
      var bulkRow = document.createElement('div');
      bulkRow.className = 'myapp-bulk';
      bulk.sort(function (a, b) { return (a.kind === 'btn' ? 1 : 0) - (b.kind === 'btn' ? 1 : 0); });
      bulk.forEach(function (it) { bulkRow.appendChild(it.el); });
      box.appendChild(bulkRow);
    }
    pane.insertBefore(box, pane.firstChild);
  }
  var MANAGER_ONLY = /_(qbxDept\\d|qbxEmp\\d|cmbOvtmCol|txtOvtnNum|cmbCompare|cmbPayProc|lstApplyStat|lstEmpClass|cmbEmpClass\\d|rdoTotal)$/;
  // 管理する人（組織・社員を選んで、ほかの人の分も見る人）か。勤務表の上に「組織」が出ているかで見分ける
  function isManager() {
    var dept = document.getElementById('frmAttendance_qbxDept1');
    return !!dept && dept.style.visibility !== 'hidden';
  }
  // 自分の分だけを見る人は、タブを開いたら一度だけ「検索」を押して、すぐに自分のデータを出す
  var lastPane = null;
  // 検索の条件の見出しの右に、いまの年月（2026/11 など）を出す
  function toggleSummary(pane) {
    var value = pane.querySelector('.myapp-search-toggle-value');
    if (!value) return;
    var ym = pane.querySelector('.myapp-search [id*="_yrm"] input');
    var text = ym && /^\\d{4}\\/\\d{1,2}$/.test((ym.value || '').trim()) ? ym.value.trim() : '';
    if (value.textContent !== text) value.textContent = text;
  }
  function showTab(pane) {
    toggleSummary(pane);
    // 管理する人だけの条件は、自分の分だけを見る人には出さない
    var manager = isManager();
    pane.querySelectorAll('.myapp-manager-only').forEach(function (row) {
      var hide = !manager;
      if (row.classList.contains('myapp-hidden') !== hide) row.classList.toggle('myapp-hidden', hide);
    });
    // タブを切り替えたら、いちばん上から見せる（前のタブのスクロールの位置のままにしない）
    if (lastPane !== pane) {
      lastPane = pane;
      pane.__myappShownAt = Date.now();
      toTop();
    }
    // 検索の結果が出たときに、EZCraft が一覧までスクロールすることがある。開いてすぐ（5 秒）は上に戻す
    if (Date.now() - (pane.__myappShownAt || 0) < 5000 && !touchedSince(pane.__myappShownAt)) toTop();
  }
  var lastTouch = 0;
  document.addEventListener('touchstart', function () { lastTouch = Date.now(); }, { capture: true, passive: true });
  // 勤務表のほかのタブの一覧は、ページといっしょにスクロールさせている。EZCraft の表は指の動きを自分で受け取って
  // （ページを動かさずに）表の中をスクロールしようとするので、表の上で指を動かしてもページが動かない。
  // 表の上の指の動きは EZCraft に渡さず、ふつうのページのスクロールにする
  window.addEventListener('touchmove', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#frmAttendance_tabAttd .tcc-tab-pane:not(#frmAttendance_tabAttd_tabs_0) .tcc-component.grid, #frmApply_tabApply .tcc-tab-pane:not(#frmApply_tabApply_tabs_0) .tcc-component.grid')) e.stopPropagation();
  }, { capture: true, passive: true });
  function toTop() {
    var el = document.scrollingElement || document.documentElement;
    if (el.scrollTop > 0) el.scrollTop = 0;
    if (window.scrollY > 0) window.scrollTo(0, 0);
  }
  function touchedSince(t) { return lastTouch > (t || 0); }
  function autoSearch(pane, waitForValue) {
    if (pane.__myappSearched || isManager()) return;
    var ym = pane.querySelector('.myapp-search .myapp-field input');
    if (waitForValue && ym && !ym.value) return; // 年月などの初期値が入るのを待つ
    var go = pane.querySelector('.myapp-search-go .tcc-btn');
    if (!go) return;
    pane.__myappSearched = true;
    setTimeout(function () { go.click(); }, 150);
  }

  // 有給休暇申請: 残りの日数をいちばん上に。新しい申請か、時間単位かのしるしを付ける
  function yukyu(form) {
    var r1 = document.getElementById('frmApply_yukyu_R1');
    var r3 = document.getElementById('frmApply_yukyu_R3');
    if (r1 && r3 && r1.parentElement === r3.parentElement && r3.style.order !== '-1') {
      r1.parentElement.style.display = 'flex';
      r1.parentElement.style.flexDirection = 'column';
      r3.style.order = '-1';
    }
    var no = document.getElementById('frmApply_yukyu_apply_no');
    var isNew = !no || !(no.textContent || '').trim();
    if (form.hasAttribute('data-myapp-new') !== isNew) form.toggleAttribute('data-myapp-new', isNew);
    var title = document.getElementById('frmApply_yukyu_apply_title');
    var noTitle = !title || !(title.textContent || '').trim();
    if (form.hasAttribute('data-myapp-notitle') !== noTitle) form.toggleAttribute('data-myapp-notitle', noTitle);
    var hourly = !!document.querySelector('#frmApply_yukyu_apply_tp_2 input:checked');
    if (form.hasAttribute('data-myapp-hourly') !== hourly) form.toggleAttribute('data-myapp-hourly', hourly);
  }

  // ---- 申請画面（共通）: 入力欄を1行ずつ並べ直す。パソコン向けの座標（style の left・top）から、
  // 左の列・右の列に分け、上から順に、同じ高さのものを1行にする。左端のラベルは見出し、ほかのラベルは小さな説明
  function px(v) { return parseFloat(v) || 0; }
  function reflow(body) {
    if (body.__myappReflowed) return;
    var comps = Array.prototype.filter.call(body.children, function (c) { return c.classList && c.classList.contains('tcc-component'); });
    if (comps.length === 0) return;
    body.__myappReflowed = true;
    var items = comps.map(function (c) {
      var kind = (c.className.match(/tcc-component\\s+(\\S+)/) || [])[1] || '';
      return { el: c, kind: kind, left: px(c.style.left), top: px(c.style.top) };
    });
    // 飾りの面（文字のないラベル・線）は出さない
    items = items.filter(function (it) {
      if (it.kind === 'hline' || it.kind === 'vline') { it.el.style.display = 'none'; return false; }
      if (it.kind === 'lbl' && !(it.el.textContent || '').trim() && /^lbl\\d+$/.test(it.el.id.split('_').pop())) { it.el.style.display = 'none'; return false; }
      return true;
    });
    var split = 400; // これより右にあるものは、右の列
    var columns = [items.filter(function (it) { return it.left < split; }), items.filter(function (it) { return it.left >= split; })];
    columns.forEach(function (col) {
      col.sort(function (a, b) { return a.top - b.top || a.left - b.left; });
      var headX = Math.min.apply(null, col.filter(function (it) { return it.kind === 'lbl'; }).map(function (it) { return it.left; }).concat([9999]));
      var rows = [];
      col.forEach(function (it) {
        var last = rows[rows.length - 1];
        if (last && Math.abs(last.top - it.top) <= 20) last.items.push(it);
        else rows.push({ top: it.top, items: [it] });
      });
      rows.forEach(function (r) {
        r.items.sort(function (a, b) { return a.left - b.left; });
        var row = document.createElement('div');
        row.className = 'myapp-row';
        r.items.forEach(function (it, i) {
          var c = it.el;
          if (it.kind === 'lbl') {
            var heading = i === 0 && Math.abs(it.left - headX) < 30;
            var afterField = r.items.slice(0, i).some(function (p) { return p.kind !== 'lbl'; });
            var beforeField = r.items.slice(i + 1).some(function (p) { return p.kind !== 'lbl'; });
            // 見出し / 入力欄の前の小さな説明（出勤 : など）/ 入力欄のあとの補足（その日の勤務体系など。次の行に出す）/ 値
            c.classList.add(heading ? 'myapp-heading' : beforeField ? 'myapp-sub' : afterField ? 'myapp-after' : 'myapp-value');
          } else if (it.kind === 'textarea') c.classList.add('myapp-area');
          else if (it.kind === 'radio' || it.kind === 'chkbox' || it.kind === 'list') c.classList.add('myapp-choice');
          else c.classList.add('myapp-field');
          row.appendChild(c);
        });
        if (Math.abs(r.items[0].left - headX) >= 30) row.classList.add('myapp-indent');
        body.appendChild(row);
      });
    });
  }
  // 中身の見えない行（隠れている部品や、値のない「タイトル」だけの行）は出さない
  function tidyRows(body) {
    body.querySelectorAll('.myapp-row').forEach(function (row) {
      var shown = Array.prototype.filter.call(row.children, function (c) {
        if ((c.getAttribute('style') || '').indexOf('visibility: hidden') >= 0) return false;
        if (c.classList.contains('myapp-heading')) return false;
        if (c.classList.contains('myapp-value') && !(c.textContent || '').trim()) return false;
        if (c.classList.contains('myapp-field')) {
          var input = c.querySelector('input');
          if (input && input.readOnly && !input.value) return false; // 使えない（読むだけで空の）欄
        }
        if (c.classList.contains('myapp-sub')) return false;
        if (c.classList.contains('myapp-after')) return false;
        return true;
      });
      row.classList.toggle('myapp-hidden', shown.length === 0);
      row.querySelectorAll('.myapp-after').forEach(function (a) { a.classList.toggle('myapp-blank', !(a.textContent || '').trim()); });
      // 入れなくてよい欄（入力できる欄があって、どれも必須のしるしがない）の見出しに「任意」。選択肢の行には付けない
      var heading = row.querySelector(':scope > .myapp-heading');
      if (heading) {
        var inputs = Array.prototype.filter.call(row.querySelectorAll(':scope > .myapp-field, :scope > .myapp-area'), function (c) {
          var el = c.querySelector('input, textarea');
          return el && !el.readOnly && !el.disabled && (c.getAttribute('style') || '').indexOf('visibility: hidden') < 0;
        });
        var optional = inputs.length > 0 && !row.querySelector(':scope > .myapp-choice') &&
          !inputs.some(function (c) { return c.hasAttribute('data-ezc-require'); });
        if (heading.classList.contains('myapp-optional') !== optional) heading.classList.toggle('myapp-optional', optional);
      }
    });
  }
  // その月の数字（ラベルが上・値が下に並んだもの）を、小さな札にする。「総〜」をいちばん大きく
  function stats(form) {
    var pane = document.getElementById(form.id + '_tabApply_tabs_0');
    if (!pane) return;
    var comps = Array.prototype.filter.call(pane.querySelectorAll('.tcc-component.lbl'), function (c) { return c.parentElement.closest('.tcc-tab-pane') === pane; });
    if (comps.length === 0) return;
    var month = '';
    var items = [];
    comps.forEach(function (c) {
      var t = (c.textContent || '').trim();
      if (/^\\d{1,2}月$/.test(t)) { month = t; return; }
      items.push({ left: px(c.style.left), top: px(c.style.top), text: t });
    });
    var topMin = Math.min.apply(null, items.map(function (it) { return it.top; }));
    var heads = items.filter(function (it) { return Math.abs(it.top - topMin) < 10; }).sort(function (a, b) { return a.left - b.left; });
    var headLeft = Math.min.apply(null, heads.map(function (it) { return it.left; }));
    var rowNames = items.filter(function (it) { return Math.abs(it.top - topMin) >= 10 && it.left < headLeft - 10; }).sort(function (a, b) { return a.top - b.top; });
    var cell = function (left, top) {
      return (items.filter(function (it) { return Math.abs(it.left - left) < 10 && Math.abs(it.top - top) < 10; })[0] || {}).text || '';
    };
    var model;
    if (rowNames.length > 0) {
      // 表: 行の名前 × 見出しの列
      model = { table: true, heads: heads.map(function (h) { return h.text; }), rows: rowNames.map(function (r) {
        return { name: r.text, cells: heads.map(function (h) { return cell(h.left, r.top); }) };
      }) };
    } else {
      // 見出しの下に値が1つずつ
      model = { table: false, list: heads.map(function (h) {
        var below = items.filter(function (it) { return Math.abs(it.left - h.left) < 10 && it.top > h.top + 5; }).sort(function (a, b) { return a.top - b.top; });
        return { label: h.text, value: below.length ? below[below.length - 1].text : '' };
      }) };
    }
    var key = month + JSON.stringify(model);
    var box = pane.querySelector('.myapp-stats');
    if (box && box.__key === key) return;
    if (!box) {
      box = document.createElement('div');
      box.className = 'myapp-stats';
      box.setAttribute('data-myapp-nodark', '');
      pane.insertBefore(box, pane.firstChild);
      comps.forEach(function (c) { c.style.setProperty('display', 'none', 'important'); });
    }
    box.__key = key;
    box.textContent = '';
    var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    if (model.table) {
      box.classList.add('myapp-stats-table');
      var table = el('table');
      var tr = el('tr');
      tr.appendChild(el('th', '', ''));
      model.heads.forEach(function (h) { tr.appendChild(el('th', '', h)); });
      table.appendChild(tr);
      model.rows.forEach(function (r) {
        var row = el('tr');
        row.appendChild(el('th', 'myapp-stats-rowname', r.name));
        r.cells.forEach(function (c, i) { row.appendChild(el('td', i === r.cells.length - 1 ? 'myapp-stats-last' : '', c)); });
        table.appendChild(row);
      });
      box.appendChild(table);
      return;
    }
    var list = model.list.filter(function (s) { return s.label; });
    var main = list.filter(function (s) { return /^総/.test(s.label); })[0];
    // 「総〜」のないもの（代休の付与・使用・残りなど）は、勤務表のまとめと同じ、見出しと大きな数字の列にする
    if (box.classList.contains('myapp-stats-grid') !== !main) box.classList.toggle('myapp-stats-grid', !main);
    if (main) {
      box.appendChild(el('div', 'myapp-stats-month', (month ? month + 'の' : '今月の') + main.label));
      var mv = el('div', 'myapp-stat myapp-stat-main');
      mv.appendChild(el('div', 'myapp-stat-value', main.value));
      box.appendChild(mv);
      box.appendChild(el('div', 'myapp-stats-break'));
    }
    list.forEach(function (s) {
      if (s === main) return;
      var d = el('div', 'myapp-stat');
      // 「総〜」のある時間外の一覧だけ、0 の項目を出さない（休暇の残りの日数などは 0 でも出す）
      if (main && /^[0:.\\s日＋+]*$/.test(s.value.replace(/[0０]/g, '0'))) d.setAttribute('data-zero', '');
      d.appendChild(el('div', 'myapp-stat-label', s.label));
      d.appendChild(el('div', 'myapp-stat-value', s.value));
      box.appendChild(d);
    });
  }

  // EZCraft の入力欄に、人が打ったのと同じように値を入れる（入れて、欄を離れたことにする）
  function typeInto(input, value) {
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
  }
  function ymd(offset) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate());
  }
  function chips(after, list, indent) {
    if (after.nextElementSibling && after.nextElementSibling.classList.contains('myapp-chips')) return after.nextElementSibling;
    var box = document.createElement('div');
    box.className = 'myapp-chips' + (indent ? ' myapp-indent' : '');
    box.setAttribute('data-myapp-nodark', '');
    list.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'myapp-chip';
      b.textContent = c.label;
      b.addEventListener('click', function (e) { e.preventDefault(); c.run(); });
      box.appendChild(b);
    });
    after.parentElement.insertBefore(box, after.nextElementSibling);
    return box;
  }

  // 残業申請: 新しく申請するときは日付に今日を入れておく。日付の下に「今日・明日」、理由の下に「前回の理由」。
  // 勤怠実績登録から開いたとき（アプリが window.__myappPrefill に日付と時刻を入れてくる）は、その日付と時刻を入れておく
  var LAST_REASON = 'myapp.overtime.lastReason';
  var OT_APPLIED = 'myapp.overtime.applied'; // この端末から残業申請を出した日（勤怠実績登録で「作成済み」と出すため）
  function appliedDates() {
    try { return JSON.parse(localStorage.getItem(OT_APPLIED) || '[]'); } catch (e) { return []; }
  }
  function prefillOvertime(form, date) {
    var pf = window.__myappPrefill;
    if (!pf || form.__myappPrefilled) return false;
    var from = document.querySelector('#frmApply_zangyo_tm_from input');
    var to = document.querySelector('#frmApply_zangyo_tm_to input');
    if (!date || !from || !to) return false;
    form.__myappPrefilled = true;
    form.__myappDated = true;
    if (pf.date) typeInto(date, pf.date);
    // 日付を入れると、EZCraft が時刻の欄を入れ直すことがある。少し待ってから時刻を入れ、もう一度確かめる
    var times = function () {
      if (pf.from && from.value !== pf.from && document.activeElement !== from) typeInto(from, pf.from);
      if (pf.to && to.value !== pf.to && document.activeElement !== to) typeInto(to, pf.to);
    };
    setTimeout(times, 400);
    setTimeout(times, 1500);
    // まとめて申請のときは、理由に前回の理由を入れておく（空のときだけ）
    if (pf.reason === 'last') setTimeout(function () {
      var reason = document.querySelector('#frmApply_zangyo_reason textarea');
      var last = '';
      try { last = localStorage.getItem(LAST_REASON) || ''; } catch (e) {}
      if (reason && last && !reason.value.trim()) typeInto(reason, last);
    }, 600);
    return true;
  }
  // 部品の中の文字を置き換える（アイコンは残す。同じなら何もしない）
  function retext(el, from, to) {
    if (!el) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.indexOf(from) >= 0) node.nodeValue = node.nodeValue.split(from).join(to);
    }
  }
  function overtime(form, isNew) {
    var date = document.querySelector('#frmApply_zangyo_dt_from input');
    if (isNew) prefillOvertime(form, date);
    if (date && isNew && !date.value && !form.__myappDated) { form.__myappDated = true; typeInto(date, ymd(0)); }
    // 時刻の欄の名前: EZCraft は「出勤・退勤」だが、残業の「開始・終了」のこと
    [['tm_from', '出勤', '開始'], ['tm_to', '退勤', '終了']].forEach(function (t) {
      var field = document.getElementById('frmApply_zangyo_' + t[0]);
      var row = field && field.closest('.myapp-row');
      if (row) row.querySelectorAll('.myapp-sub, .myapp-heading').forEach(function (l) { retext(l, t[1], t[2]); });
    });
    // 勤怠実績登録から開いたとき（日付が入っている）は、「今日・明日」は出さない
    var dateRow = !window.__myappPrefill && date && date.closest('.myapp-row');
    if (dateRow) chips(dateRow, [
      { label: '今日', run: function () { typeInto(date, ymd(0)); } },
      { label: '明日', run: function () { typeInto(date, ymd(1)); } },
    ], true);
    var reason = document.querySelector('#frmApply_zangyo_reason textarea');
    var reasonRow = reason && reason.closest('.myapp-row');
    var last = '';
    try { last = localStorage.getItem(LAST_REASON) || ''; } catch (e) {}
    if (reasonRow && last && isNew) chips(reasonRow, [
      { label: '前回の理由: ' + last.replace(/\\s+/g, ' ').slice(0, 24), run: function () { typeInto(reason, last); } },
    ], false);
    // 登録を押したら、理由と日付を覚えておき、書き込みがうまくいってから（bridge.ts の myapp-saved）この端末に記録する
    // （次の申請の「前回の理由」と、勤怠実績登録の「作成済み」のため）。
    // 押しただけでは記録しない。理由が空で弾かれた・サーバーで失敗した・確かめでやめたときに「作成済み」になり、
    // その日の残業申請が出されないままになるため。保存が取り消されたら（myapp-save-end の ok が false）、記録も消す
    var done = document.querySelector('#frmApply_zangyo_btnDone .tcc-btn');
    if (done && !done.__myappRemember) {
      done.__myappRemember = true;
      done.addEventListener('click', function () {
        form.__myappOtSubmit = { reason: reason && reason.value.trim(), date: date && date.value.trim(), at: Date.now() };
      }, true);
    }
    if (!form.__myappOtSaved) {
      form.__myappOtSaved = true;
      window.addEventListener('myapp-saved', function () {
        var s = form.__myappOtSubmit;
        if (!s || Date.now() - s.at > 60000) return;
        form.__myappOtSubmit = null;
        if (s.reason) { try { localStorage.setItem(LAST_REASON, s.reason); } catch (e) {} }
        if (s.date) {
          markApplied(s.date, true);
          form.__myappOtRecorded = { date: s.date, at: Date.now() };
        }
      });
      window.addEventListener('myapp-save-end', function (e) {
        var rec = form.__myappOtRecorded;
        form.__myappOtRecorded = null;
        if (rec && e.detail && e.detail.ok === false && Date.now() - rec.at < 60000) markApplied(rec.date, false);
      });
    }
  }
  function markApplied(date, on) {
    var list = appliedDates().filter(function (x) { return x !== date; });
    if (on) list.push(date);
    try { localStorage.setItem(OT_APPLIED, JSON.stringify(list.slice(-60))); } catch (e) {}
  }

  function applyForm(form) {
    stats(form);
    var r1 = document.getElementById(form.id + '_R1');
    var r3 = document.getElementById(form.id + '_R3');
    var hasStats = !!(r3 && r3.querySelector('.myapp-stats'));
    if (r1 && r3 && r1.parentElement === r3.parentElement && hasStats && r3.style.order !== '-1') {
      r1.parentElement.style.display = 'flex';
      r1.parentElement.style.flexDirection = 'column';
      r3.style.order = '-1';
    }
    var no = document.getElementById(form.id + '_apply_no');
    var isNew = !no || !(no.textContent || '').trim();
    if (form.hasAttribute('data-myapp-new') !== isNew) form.toggleAttribute('data-myapp-new', isNew);
    var body = document.getElementById(form.id + '_blank2_body');
    if (body) { reflow(body); tidyRows(body); }
    if (form.id === 'frmApply_zangyo') overtime(form, isNew);
    if (form.id === 'frmApply_chikokuSotai') lateEarly(form);
  }
  // 遅刻早退: 見出しの「遅早時刻」は「時刻」に。欄の下の「出勤」「退勤」は、何の時刻かが分かる言い方に
  // （ちょうどその語だけのときに置き換える。何度呼ばれても同じ）
  function lateEarly(form) {
    form.querySelectorAll('.myapp-row .tcc-label-text').forEach(function (el) {
      var t = (el.textContent || '').trim();
      var to = t === '遅早時刻' ? '時刻' : t === '出勤' ? '出勤した時刻（遅刻のとき）' : t === '退勤' ? '退勤した時刻（早退のとき）' : '';
      if (!to) return;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue.trim() === t) { node.nodeValue = to; break; }
      }
    });
  }

  // 勤怠実績登録: プロジェクトは、中身のある行と次の空の行だけを出す（欄の名前は欄の上に出している。CSS の caption）
  var PROJECT_KEYS = ['txtPrj', 'qbxProj', 'qbxContent', 'txtTime', 'txtRemark'];
  function markProjects(form) {
    var last = 0;
    for (var n = 1; n <= 6; n++) {
      var filled = false;
      PROJECT_KEYS.forEach(function (key) {
        var input = document.querySelector('#frmAttendanceDtl_' + key + n + ' input');
        if (input && input.value && input.value.trim()) filled = true;
      });
      var tw = document.querySelector('#frmAttendanceDtl_chkTW' + n + ' input[type="checkbox"]');
      if (tw && tw.checked) filled = true;
      if (filled) last = n;
    }
    var shown = String(Math.min(6, last + 1));
    if (form.getAttribute('data-myapp-prj') !== shown) form.setAttribute('data-myapp-prj', shown);
    if (form.hasAttribute('data-myapp-prj-empty') !== last < 6) form.toggleAttribute('data-myapp-prj-empty', last < 6);
  }
  // 勤怠実績登録: 休憩の2段目は、2つ目（か2段目）に何か入っているときだけ出す
  function markBreaks(form) {
    var more = ['break_tm_from2', 'break_tm_to2', 'break_tm_from3', 'break_tm_to3', 'break_tm_from4', 'break_tm_to4'].some(function (id) {
      var input = document.querySelector('#frmAttendanceDtl_' + id + ' input');
      return !!(input && input.value && input.value.trim());
    });
    if (form.hasAttribute('data-myapp-breaks2') !== more) form.toggleAttribute('data-myapp-breaks2', more);
  }

  // 勤怠実績登録: 勤怠日〜休暇・プロジェクト・備考を、白いカードにする（中の入力欄とボタンは灰色の面に。GLASS_CSS の .myapp-card）
  function dtlCards() {
    ['R2', 'R3', 'R4'].forEach(function (r) {
      var el = document.getElementById('frmAttendanceDtl_' + r);
      if (el && !el.classList.contains('myapp-card')) el.classList.add('myapp-card');
    });
    // 遅刻・早退の数字があるか（0 や空なら、その段を出さずに詰める。CSS）
    var form = document.getElementById('frmAttendanceDtl');
    var late = ['lateEarly', 'early'].some(function (id) {
      var t = textOf('frmAttendanceDtl_' + id);
      return t !== '' && !/^[0:\\s]*$/.test(t);
    });
    if (form && form.hasAttribute('data-myapp-late') !== late) form.toggleAttribute('data-myapp-late', late);
  }

  // 勤怠実績登録: 残業。所定の時間（勤務体系ごと）を超えて働いたぶんを残業とし、その場で残業申請を作れるようにする。
  //   - 「残業申請を作る」を押すと、日付と時刻（退勤から残業のぶんさかのぼった時刻〜退勤）を入れた残業申請の画面が開く
  //   - 時刻を入れ直して残業のある日を「登録」したら、登録が終わったところで、その画面を自動で開く（理由を入れて登録するだけ）。
  //     時刻を変えずに登録したとき（プロジェクトだけ直したときなど）は開かない
  //   この端末から残業申請を出した日は「作成済み」と出し、自動では開かない
  // 所定の時間: 一般・平日は 9:00〜17:30（休憩 1 時間）で 7:30。9:00〜18:00（休憩 1 時間）なら 0:30 が残業
  var STANDARD = [{ match: '平日', minutes: 450 }];
  // 時刻の読み書き・残業の時間帯（minutesOf・hhmm・overtimeStart）
${OVERTIME_MATH_JS}
  // 勤怠実績登録の休憩の時刻（分）。出勤より前の時刻は、日をまたいだものとして 24 時間を足す
  function dtlBreaks(start) {
    var out = [];
    for (var n = 1; n <= 4; n++) {
      var f = document.querySelector('#frmAttendanceDtl_break_tm_from' + n + ' input');
      var t = document.querySelector('#frmAttendanceDtl_break_tm_to' + n + ' input');
      var from = minutesOf(f && f.value);
      var to = minutesOf(t && t.value);
      if (from === null || to === null) continue;
      if (start !== null && from < start) from += 1440;
      if (start !== null && to < start) to += 1440;
      if (to < from) to += 1440;
      out.push({ from: from, to: to });
    }
    return out;
  }
  function textOf(id) { var el = document.getElementById(id); return el ? (el.textContent || '').trim() : ''; }
  function overtimeOf() {
    var tp = textOf('frmAttendanceDtl_work_tp');
    var rule = STANDARD.filter(function (r) { return tp.indexOf(r.match) >= 0; })[0];
    if (!rule) return null;
    var work = minutesOf(textOf('frmAttendanceDtl_work_tm'));
    var endInput = document.querySelector('#frmAttendanceDtl_work_end_tm input');
    var sttInput = document.querySelector('#frmAttendanceDtl_work_stt_tm input');
    var end = minutesOf(endInput && endInput.value);
    var start = minutesOf(sttInput && sttInput.value);
    if (work === null || end === null) return null;
    // 退勤が出勤より前の時刻なら、日をまたいだ（1:00 は 25:00）
    if (start !== null && end < start) end += 1440;
    var ot = work - rule.minutes;
    if (ot <= 0) return null;
    var from = overtimeStart(end, ot, dtlBreaks(start));
    if (from < 0) return null;
    var dm = /(\\d{4})\\D(\\d{1,2})\\D(\\d{1,2})/.exec(textOf('frmAttendanceDtl_lblDt'));
    if (!dm) return null;
    var p = function (n) { return ('0' + n).slice(-2); };
    var date = dm[1] + '/' + p(+dm[2]) + '/' + p(+dm[3]);
    return { date: date, from: hhmm(from), to: hhmm(end), minutes: ot, standard: rule.minutes };
  }
  function postApply(ot, auto) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'apply', form: 'frmApply_zangyo', auto: auto,
        prefill: { date: ot.date, from: ot.from, to: ot.to },
      }));
    } catch (e) {}
  }
  function overtimeCard(form) {
    var r2 = document.getElementById('frmAttendanceDtl_R2');
    if (!r2 || !r2.parentElement) return;
    var card = form.querySelector('.myapp-ot');
    if (!card) {
      card = document.createElement('div');
      card.className = 'myapp-ot';
      card.setAttribute('data-myapp-nodark', '');
      card.hidden = true;
      card.innerHTML = '<div class="myapp-ot-head"><span class="myapp-ot-title">残業<b></b></span><span class="myapp-ot-range"></span></div>' +
        '<div class="myapp-ot-note"></div><button type="button" class="myapp-ot-btn">残業申請を作る</button>';
      card.querySelector('.myapp-ot-btn').addEventListener('click', function (e) {
        e.preventDefault();
        if (card.__ot) postApply(card.__ot, false);
      });
      // 登録を押したら覚えておき、書き込みが終わったら（bridge.ts の myapp-saved）すぐアプリに知らせる。
      // 登録のあと EZCraft がすぐ画面を閉じることがあるので、ページの側では待たない（待つのはアプリの側。閉じたら戻ってから開く）
      window.addEventListener('myapp-saved', function () {
        var pending = form.__myappPendingApply;
        if (!pending || Date.now() - pending.at > 20000) return;
        form.__myappPendingApply = null;
        postApply(pending.ot, true);
      });
    }
    if (card.previousElementSibling !== r2) r2.parentElement.insertBefore(card, r2.nextSibling);
    // 人が時刻の欄を打ったか（EZCraft が値を入れたとき・コピーしたときは数えない）
    ['work_stt_tm', 'work_end_tm', 'break_tm_from1', 'break_tm_to1', 'break_tm_from2', 'break_tm_to2'].forEach(function (id) {
      var input = document.querySelector('#frmAttendanceDtl_' + id + ' input');
      if (!input || input.__myappOtWatch) return;
      input.__myappOtWatch = true;
      // キーボードで打った（isTrusted）か、時刻のダイヤルで選んだ（__myappDialEdit。openDial）ときだけ数える
      input.addEventListener('input', function (e) { if (e.isTrusted || input.__myappDialEdit) form.__myappTimesEdited = true; });
    });
    var save = document.querySelector('#frmAttendanceDtl_btnIns .tcc-btn');
    if (save && !save.__myappOt) {
      save.__myappOt = true;
      save.addEventListener('click', function () {
        var now = card.__ot;
        var auto = now && form.__myappTimesEdited && !card.hasAttribute('data-done');
        form.__myappPendingApply = auto ? { ot: now, at: Date.now() } : null;
      }, true);
    }
    var ot = overtimeOf();
    var done = !!ot && appliedDates().indexOf(ot.date) >= 0;
    var key = ot ? [ot.date, ot.from, ot.to, done].join('|') : '';
    if (card.__key === key) return;
    card.__key = key;
    card.__ot = ot;
    card.hidden = !ot;
    if (!ot) return;
    card.toggleAttribute('data-done', done);
    card.querySelector('.myapp-ot-title b').textContent = hhmm(ot.minutes);
    card.querySelector('.myapp-ot-range').textContent = ot.from + '〜' + ot.to;
    card.querySelector('.myapp-ot-note').textContent = done
      ? 'この日の残業申請は、この iPhone から作成済みです。'
      : '所定の ' + hhmm(ot.standard) + ' を超えたぶんです。時刻を入れて「登録」すると、この時間の残業申請が開きます。';
    card.querySelector('.myapp-ot-btn').textContent = done ? 'もう一度、残業申請を作る' : '残業申請を作る';
  }

  // 勤怠実績登録: 「ほかの日をコピー」を時刻の欄の下の別のカードへ、「削除」をいちばん下へ移す（部品は動かすだけ。押したときの動きは EZCraft のまま）
  // プロジェクト・作業内訳の名前が欄に入りきらないとき（「取引規制システム一新_…」など）は、欄の中で2行に折り返して全部見せる。
  // 入力欄そのものは1行なので、上に同じ文字の札（.myapp-name-wrap）を重ね、欄の文字は透明にする。打っているあいだは札を出さない
  function longNames(form) {
    form.querySelectorAll('[id^="frmAttendanceDtl_qbxProj"], [id^="frmAttendanceDtl_qbxContent"]').forEach(function (comp) {
      var input = comp.querySelector('input');
      if (!input) return;
      var value = input.value || '';
      var long = !!value && input.scrollWidth > input.clientWidth + 2;
      if (long !== comp.hasAttribute('data-myapp-long')) comp.toggleAttribute('data-myapp-long', long);
      var wrap = comp.querySelector(':scope > .myapp-name-wrap');
      if (!long) { if (wrap) wrap.remove(); return; }
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'myapp-name-wrap';
        wrap.setAttribute('aria-hidden', 'true');
        comp.appendChild(wrap);
      }
      if (wrap.textContent !== value) wrap.textContent = value;
    });
  }
  function dtlLayout(form) {
    longNames(form);
    var r2 = document.getElementById('frmAttendanceDtl_R2');
    if (!r2 || !r2.parentElement) return;
    var host = r2.parentElement;
    var copy = host.querySelector(':scope > .myapp-copy');
    if (!copy) {
      copy = document.createElement('div');
      copy.className = 'myapp-copy myapp-card';
      copy.setAttribute('data-myapp-nodark', '');
      var title = document.createElement('div');
      title.className = 'myapp-copy-title';
      title.textContent = 'ほかの日の入力をこの日にコピー';
      copy.appendChild(title);
    }
    var after = host.querySelector(':scope > .myapp-ot') || r2;
    if (copy.previousElementSibling !== after) host.insertBefore(copy, after.nextSibling);
    ['dtCopy', 'btnCopy'].forEach(function (id) {
      var el = document.getElementById('frmAttendanceDtl_' + id);
      if (el && el.parentElement !== copy) copy.appendChild(el);
    });
    var del = document.getElementById('frmAttendanceDtl_btnDel');
    if (del) {
      var footer = host.querySelector(':scope > .myapp-dtl-footer');
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'myapp-dtl-footer';
        footer.setAttribute('data-myapp-nodark', '');
      }
      if (footer.parentElement !== host || footer.nextElementSibling) host.appendChild(footer);
      if (del.parentElement !== footer) footer.appendChild(del);
    }
  }

  // プロジェクト選択: 選んだプロジェクトを覚えておき（この端末だけ。番号と名前）、次からダイアログの上に「最近使った」で出す
  var RECENT = 'myapp.recentProjects';
  function recentProjects() {
    try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch (e) { return []; }
  }
  function cellText(tr, col) {
    var td = Array.prototype.filter.call(tr.children, function (c) { return new RegExp('_tdCol' + col + '(\\\\s|$)').test(c.className); })[0];
    return td ? (td.textContent || '').trim() : '';
  }
  document.addEventListener('click', function (e) {
    var tr = e.target && e.target.closest && e.target.closest('#frmSelProj_grdPrj1 .TccGridBodyScroll tr');
    if (!tr) return;
    var no = cellText(tr, 1);
    var name = cellText(tr, 4);
    if (!no || !name) return;
    var list = recentProjects().filter(function (p) { return p.no !== no; });
    list.unshift({ no: no, name: name });
    try { localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 6))); } catch (err) {}
  }, true);
  function recentChips() {
    var dialog = document.getElementById('frmSelProj');
    var query = document.getElementById('frmSelProj_txtQuery');
    if (!dialog || !query) return;
    var list = recentProjects();
    var has = list.length > 0;
    if (dialog.hasAttribute('data-myapp-recent') !== has) dialog.toggleAttribute('data-myapp-recent', has);
    var box = query.parentElement.querySelector(':scope > .myapp-recent');
    if (!has) { if (box) box.remove(); return; }
    var key = JSON.stringify(list);
    if (box && box.__key === key) return;
    if (!box) {
      box = document.createElement('div');
      box.className = 'myapp-recent';
      box.setAttribute('data-myapp-nodark', '');
      query.parentElement.appendChild(box);
    }
    box.__key = key;
    box.textContent = '';
    var label = document.createElement('span');
    label.className = 'myapp-recent-label';
    label.textContent = '最近';
    box.appendChild(label);
    list.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.name;
      b.setAttribute('aria-label', p.name + ' で探す');
      b.addEventListener('click', function (e) {
        e.preventDefault();
        typeInto(query.querySelector('input'), p.no);
      });
      box.appendChild(b);
    });
  }

  // ---- 勤怠実績登録: 番号の欄を押したら、今月使ったプロジェクトから選べるようにする（下から出るシート） ----
  // 今月の工数は、勤務表の「工数」タブの一覧から取る。勤務表を開いたときに裏で一度読み（preloadKosu）、
  // この端末に控える（番号・プロジェクト名・作業内訳・日付だけ。新しい2か月分）。勤怠実績登録を開いたときに
  // 入っていたプロジェクトも足す。シートの「番号を入力する」を選べば、今までどおりキーボードで打てる。
  var MONTH_PRJ = 'myapp.monthProjects';
  var loadedAt = Date.now();
  function monthOf(text) {
    var m = /(\\d{4})\\D(\\d{1,2})/.exec(text || '');
    return m ? m[1] + '/' + (m[2].length < 2 ? '0' : '') + m[2] : '';
  }
  function readMonthPrj() {
    try {
      var v = JSON.parse(localStorage.getItem(MONTH_PRJ) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
  }
  function addMonthPrj(month, items) {
    if (!month || !items.length) return;
    var all = readMonthPrj();
    var list = (all[month] && all[month].list) || [];
    items.forEach(function (it) {
      if (!it.no) return;
      var old = list.filter(function (p) { return p.no === it.no; })[0];
      if (!old) { list.push({ no: it.no, name: it.name || '', content: it.content || '', date: it.date || '' }); return; }
      if (it.name) old.name = it.name;
      if (it.content) old.content = it.content;
      if (it.date && (!old.date || it.date > old.date)) old.date = it.date;
    });
    all[month] = { list: list, at: Date.now() };
    Object.keys(all).sort().reverse().slice(2).forEach(function (k) { delete all[k]; });
    try { localStorage.setItem(MONTH_PRJ, JSON.stringify(all)); } catch (e) {}
  }
  // 勤務表の「工数」タブの一覧（日付・No.・プロジェクト・作業内訳）を控える
  function harvestKosu() {
    var grid = document.getElementById('frmAttendance_grdPrj');
    if (!grid) return;
    var rows = grid.querySelectorAll('.TccGridBodyScroll tbody tr');
    if (!rows.length) return;
    // 一覧が描き直されたか（EZCraft は描き直すとき、行を新しく作る）。最初と最後の行と数が同じなら、同じ一覧
    // （一覧の文字を全部読んで比べると、ページが変わるたびに重いため）
    // （行を使い回して中身だけ書き換えることもあるので、最初と最後の行の文字も比べる）
    var last = rows[rows.length - 1];
    var seen = rows.length + '|' + (rows[0].textContent || '') + '|' + (last.textContent || '');
    var h = grid.__myappHarvested;
    if (h && h.first === rows[0] && h.last === last && h.seen === seen) return;
    grid.__myappHarvested = { first: rows[0], last: last, seen: seen };
    var byMonth = {};
    Array.prototype.forEach.call(rows, function (tr) {
      var date = cellText(tr, 3);
      var no = cellText(tr, 4);
      var month = monthOf(date);
      if (!month || !no) return;
      (byMonth[month] = byMonth[month] || []).push({ no: no, name: cellText(tr, 5), content: cellText(tr, 8), date: date });
    });
    Object.keys(byMonth).forEach(function (m) { addMonthPrj(m, byMonth[m]); });
  }
  // ---- 勤務表の「工数」タブ: 日ごと（EZCraft の一覧）と、プロジェクトごと（月のまとめ）を切り替える ----
  // プロジェクトごとは、いま一覧に出ている行（検索の条件で選んだ月）から作る。合計時間の多い順に、
  // プロジェクト名・No.・合計時間・日数・作業内訳ごとの時間を1枚のカードに並べる。どちらで見るかは、この端末に覚える
  var KOSU_VIEW = 'myapp.kosuView';
  function kosuMinutes(text) {
    var m = /^(\\d{1,3}):(\\d{2})$/.exec((text || '').trim());
    return m ? +m[1] * 60 + +m[2] : 0;
  }
  function kosuHm(min) {
    var m = min % 60;
    return Math.floor(min / 60) + ':' + (m < 10 ? '0' : '') + m;
  }
  function kosuEl(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function kosuMode() {
    try { return localStorage.getItem(KOSU_VIEW) === 'project' ? 'project' : 'day'; } catch (e) { return 'day'; }
  }
  // 一覧の行を、プロジェクトごとにまとめる（合計時間の多い順。同じなら No. の順）
  function kosuProjects(grid) {
    var byNo = {};
    var list = [];
    Array.prototype.forEach.call(grid.querySelectorAll('.TccGridBodyScroll tbody tr'), function (tr) {
      var no = cellText(tr, 4);
      var min = kosuMinutes(cellText(tr, 9));
      if (!no) return;
      var p = byNo[no];
      if (!p) { p = byNo[no] = { no: no, name: cellText(tr, 5), total: 0, days: {}, kinds: {}, kindOrder: [] }; list.push(p); }
      p.total += min;
      var date = cellText(tr, 3);
      if (date) p.days[date] = true;
      var kind = cellText(tr, 8) || 'その他';
      if (!(kind in p.kinds)) { p.kinds[kind] = 0; p.kindOrder.push(kind); }
      p.kinds[kind] += min;
    });
    return list.sort(function (a, b) { return b.total - a.total || (a.no < b.no ? -1 : 1); });
  }
  function kosuView(pane) {
    var grid = document.getElementById('frmAttendance_grdPrj');
    if (!grid || !pane.contains(grid)) return;
    var mode = kosuMode();
    var seg = pane.querySelector('.myapp-kosu-seg');
    var sum = pane.querySelector('.myapp-kosu-sum');
    if (!seg) {
      seg = kosuEl('div', 'myapp-kosu-seg');
      seg.setAttribute('role', 'tablist');
      seg.setAttribute('data-myapp-nodark', '');
      [['day', '日ごと'], ['project', 'プロジェクトごと']].forEach(function (it) {
        var b = kosuEl('button', '', it[1]);
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('data-mode', it[0]);
        b.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          try { localStorage.setItem(KOSU_VIEW, it[0]); } catch (err) {}
          kosuView(pane);
        });
        seg.appendChild(b);
      });
      sum = kosuEl('div', 'myapp-kosu-sum');
      sum.setAttribute('data-myapp-nodark', '');
      grid.parentNode.insertBefore(seg, grid);
      grid.parentNode.insertBefore(sum, grid);
    }
    Array.prototype.forEach.call(seg.children, function (b) {
      var on = b.getAttribute('data-mode') === mode ? 'true' : 'false';
      if (b.getAttribute('aria-selected') !== on) b.setAttribute('aria-selected', on);
    });
    if (pane.classList.contains('myapp-kosu-project') !== (mode === 'project')) pane.classList.toggle('myapp-kosu-project', mode === 'project');
    if (mode !== 'project') return;
    // 一覧が変わったときだけ作り直す（一覧の行の数と中身の長さで見分ける）
    var body = grid.querySelector('.TccGridBodyScroll tbody');
    var key = (body ? body.children.length + ':' + (body.textContent || '').length : '0');
    if (sum.__myappKey === key) return;
    sum.__myappKey = key;
    var projects = kosuProjects(grid);
    sum.textContent = '';
    if (!projects.length) { sum.appendChild(kosuEl('div', 'myapp-kosu-empty', 'データはありません')); return; }
    var all = projects.reduce(function (t, p) { return t + p.total; }, 0);
    sum.appendChild(kosuEl('div', 'myapp-kosu-all', projects.length + '件のプロジェクト　合計 ' + kosuHm(all)));
    projects.forEach(function (p) {
      var card = kosuEl('div', 'myapp-kosu-card');
      var head = kosuEl('div', 'myapp-kosu-head');
      head.appendChild(kosuEl('div', 'myapp-kosu-name', p.name || '（名前なし）'));
      head.appendChild(kosuEl('div', 'myapp-kosu-total', kosuHm(p.total)));
      card.appendChild(head);
      var meta = kosuEl('div', 'myapp-kosu-meta');
      meta.appendChild(kosuEl('span', '', 'No. ' + p.no));
      meta.appendChild(kosuEl('span', '', Object.keys(p.days).length + '日'));
      card.appendChild(meta);
      var kinds = kosuEl('div', 'myapp-kosu-kinds');
      p.kindOrder.sort(function (a, b) { return p.kinds[b] - p.kinds[a]; }).forEach(function (k) {
        var item = kosuEl('span', 'myapp-kosu-kind');
        item.appendChild(kosuEl('span', '', k));
        item.appendChild(kosuEl('b', '', kosuHm(p.kinds[k])));
        kinds.appendChild(item);
      });
      card.appendChild(kinds);
      sum.appendChild(card);
    });
    // 一覧が2ページ以上に分かれているときは、このページの分だけのまとめであることを伝える（1ページは 100 件）
    var tcc = window.jQuery && window.jQuery(grid).data('tcc');
    if (tcc && tcc.lastPage > 1) sum.appendChild(kosuEl('div', 'myapp-kosu-note', '日ごとの一覧の、いま開いているページ（' + tcc.currPage + '/' + tcc.lastPage + '）の分だけのまとめです'));
  }
  // 勤務表のほかのタブ（工数・出力）の一覧を、タブを開かずに裏で読む（読み込み中の印は出さない。見ている勤務表の邪魔をしない）。
  // 読めたら done(true)。そのタブを開いたときに、もう一度は検索しない
  function quietSearch(gridId, done) {
    var grid = document.getElementById(gridId);
    var pane = grid && grid.closest('.tcc-tab-pane');
    var rows = function () { return grid.querySelectorAll('.TccGridBodyScroll tbody tr').length; };
    if (!pane) { done(false); return; }
    if (rows() > 0) { done(true); return; }
    if (!pane.__myappSearched) {
      if (pane.classList.contains('active')) { done(false); return; }
      var go = Array.prototype.filter.call(pane.querySelectorAll('a.tcc-btn'), function (a) {
        return /^(検索|表示)$/.test((a.textContent || '').trim());
      })[0];
      var ymSet = Array.prototype.some.call(pane.querySelectorAll('input'), function (i) { return /\\d{4}\\D?\\d{1,2}/.test(i.value || ''); });
      if (!go || !ymSet) { done(false); return; }
      pane.__myappSearched = true;
      var root = document.documentElement;
      root.classList.add('myapp-quiet');
      go.click();
      setTimeout(function () { root.classList.remove('myapp-quiet'); }, 4000);
    }
    var start = Date.now();
    var timer = setInterval(function () {
      if (rows() > 0) { clearInterval(timer); done(true); }
      else if (Date.now() - start > 8000) { clearInterval(timer); done(false); }
    }, 200);
  }
  // 勤務表: 勤怠実績登録で「登録」「削除」をして戻ってきたとき（アプリが呼ぶ。src/webview/bridge.ts の childClosedJs）。
  // ページを丸ごと読み直さずに、Web 版と同じく、勤務表が用意した「閉じたあとの処理」を呼ぶ
  // （勤務表のデータだけ読み直して、「登録しました」を出す）。できたら true（できなければ、アプリが丸ごと読み直す）
  window.__myappChildClosed = function (label) {
    if (!document.getElementById('frmAttendance')) return false;
    var name = /削除/.test(label) ? '削除' : /登録/.test(label) ? '登録' : '';
    if (!name) return false;
    var F = window.FALCON && FALCON.apps && FALCON.apps.procedure && FALCON.apps.procedure.Forms;
    var cf = F && F._getCashedform && F._getCashedform(F._getUniqueId());
    var cb = cf && cf.closedCb;
    // 何もしない処理（画面が用意していない）なら、丸ごと読み直してもらう
    if (typeof cb !== 'function' || /^function\\s*\\w*\\s*\\([^)]*\\)\\s*\\{\\s*\\}$/.test(String(cb))) return false;
    // 読み込み中の印・ページの高さ・見ていた位置は、アプリが呼ぶときに保つ（src/webview/bridge.ts の childClosedJs）
    cb(name);
    // ほかのタブ（工数・出力・集計など）で読んであった一覧も、裏で読み直す（古いまま見えないように）
    setTimeout(refreshLoadedTabs, 3500);
    return true;
  };
  function refreshLoadedTabs() {
    var form = document.getElementById('frmAttendance');
    if (!form) return;
    var panes = Array.prototype.filter.call(form.querySelectorAll('.tcc-tab-pane'), function (pane) {
      return !pane.classList.contains('active') && pane.querySelector('.TccGridBodyScroll tbody tr');
    });
    var next = function (i) {
      if (i >= panes.length) return;
      var go = Array.prototype.filter.call(panes[i].querySelectorAll('a.tcc-btn'), function (a) {
        return /^(検索|表示)$/.test((a.textContent || '').trim());
      })[0];
      if (go) {
        var root = document.documentElement;
        root.classList.add('myapp-quiet');
        go.click();
        setTimeout(function () { root.classList.remove('myapp-quiet'); }, 3000);
      }
      setTimeout(function () { next(i + 1); }, go ? 2000 : 0);
    };
    next(0);
  }
  // 勤務表を開いたら、裏で一度「工数」タブを読んで、今月の工数を控える（30 分以内に読んだものがあれば読まない）
  var kosuQueued = false;
  function preloadKosu() {
    if (kosuQueued || isManager()) return;
    var cur = readMonthPrj()[monthOf(ymd(0))];
    kosuQueued = true;
    if (cur && Date.now() - cur.at < 30 * 60 * 1000) return;
    setTimeout(function () { quietSearch('frmAttendance_grdPrj', function () {}); }, 1500);
  }

  // ---- 勤務表: 残業をまとめて申請 ----
  // 残業のある日を選ぶと、残業申請を1日ずつ続けて開く（日付・開始・終了・前回の理由を入れておく。「申請」は自分で押す）。
  // 開始・終了は、「出力」タブの一覧（日ごとの退勤・残業）から求める（退勤 − 残業 〜 退勤）。一覧は、押したときに裏で読む
  function otDays() {
    var rpt = document.getElementById('frmAttendance_rptWork');
    var body = rpt && rpt.querySelector('.tcc-rpt-body');
    if (!body) return [];
    var ym = ((rpt.querySelector('.tcc-rpt-title') || {}).textContent || '').match(/(\\d{4})年/);
    if (!ym) return [];
    var applied = appliedDates();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var out = [];
    Array.prototype.forEach.call(body.children, function (row) {
      if (!row.classList.contains('tcc-rpt-row')) return;
      var dateEl = row.querySelector('[id^="frmAttendance_dispDt"] .tcc-label-text');
      var label = ((dateEl && dateEl.textContent) || '').trim();
      var m = label.match(/^(\\d{1,2})\\/(\\d{1,2})/);
      var o = ((row.querySelector('[id^="frmAttendance_biko"]') || {}).textContent || '').match(/残業\\s*(\\d{1,2}):(\\d{2})/);
      if (!m || !o || +o[1] * 60 + +o[2] <= 0) return;
      var date = ym[1] + '/' + p(+m[1]) + '/' + p(+m[2]);
      // 申請済み: この端末から出した日か、勤務表の日の札（サーバーが出す申請の印）に「残業」とある日（Web やほかの端末から出したもの）
      var rib = row.querySelector('.ribon span');
      var onServer = !!rib && /残業/.test(rib.textContent || '');
      out.push({ date: date, label: label, applied: onServer || applied.indexOf(date) >= 0 });
    });
    return out.sort(function (a, b) { return a.date.localeCompare(b.date); });
  }
  // 一覧の列を、見出しの文字で確かめる。いつもの列（fallback）の見出しが pattern に合えばそれ、合わなければ合う最初の列。
  // 見出しが読めない一覧は fallback のまま。見出しはあるのに合う列がなければ -1（列が並べ替えられた。違う列の値を使わない）
  function columnOf(grid, fallback, pattern) {
    var heads = {};
    var any = false;
    grid.querySelectorAll('.TccGridHeadScroll th').forEach(function (th) {
      var m = th.className.match(/_tdCol(\\d+)/);
      if (!m) return;
      var text = (th.textContent || '').replace(/\\s+/g, '');
      if (text) { heads[m[1]] = text; any = true; }
    });
    if (!any) return fallback;
    if (pattern.test(heads[fallback] || '')) return fallback;
    for (var k in heads) if (pattern.test(heads[k])) return +k;
    return -1;
  }
  // 「出力」タブの一覧から、日ごとの退勤と残業（日付 → { end: 分, ot: 分 }）。見ている月の分だけ
  function attdTimes() {
    var map = {};
    var grid = document.getElementById('frmAttendance_grdAttd');
    if (!grid) return map;
    var endCol = columnOf(grid, 11, /退勤|終業|終了/);
    var otCol = columnOf(grid, 29, /残業/);
    if (endCol < 0 || otCol < 0) return map;
    grid.querySelectorAll('.TccGridBodyScroll tbody tr').forEach(function (tr) {
      var date = (cellText(tr, 1).match(/\\d{4}\\/\\d{2}\\/\\d{2}/) || [])[0];
      var end = minutesOf(cellText(tr, endCol));
      var ot = minutesOf(cellText(tr, otCol));
      if (date && end !== null && ot && end - ot >= 0) map[date] = { end: end, ot: ot };
    });
    return map;
  }
  function otBulkButton() {
    var pane = document.getElementById('frmAttendance_tabAttd_tabs_0');
    var rpt = document.getElementById('frmAttendance_rptWork');
    var body = rpt && rpt.querySelector('.tcc-rpt-body');
    if (!pane || !body) return;
    var open = otDays().filter(function (d) { return !d.applied; }).length;
    var btn = body.querySelector(':scope > .myapp-ot-bulk');
    if (!open || isManager()) { if (btn) btn.remove(); return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'myapp-ot-bulk';
      btn.setAttribute('data-myapp-nodark', '');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        btn.disabled = true;
        btn.setAttribute('data-loading', '');
        quietSearch('frmAttendance_grdAttd', function (ok) {
          btn.disabled = false;
          btn.removeAttribute('data-loading');
          openOtBulk(ok ? attdTimes() : {});
        });
      });
      body.appendChild(btn);
    }
    var text = '残業をまとめて申請（' + open + '日）';
    if (btn.textContent !== text) btn.textContent = text;
  }
  function openOtBulk(times) {
    closePicker();
    var days = otDays().map(function (d) {
      var t = times[d.date];
      return { date: d.date, label: d.label, applied: d.applied, from: t ? hhmm(t.end - t.ot) : '', to: t ? hhmm(t.end) : '', ot: t ? t.ot : 0 };
    }).filter(function (d) { return d.to; });
    var back = document.createElement('div');
    back.className = 'myapp-pick-back';
    back.setAttribute('data-myapp-nodark', '');
    back.addEventListener('click', closePicker);
    var sheet = document.createElement('div');
    sheet.className = 'myapp-pick myapp-ot-pick';
    sheet.setAttribute('data-myapp-nodark', '');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', '残業をまとめて申請');
    var title = document.createElement('div');
    title.className = 'myapp-pick-title';
    title.textContent = '残業をまとめて申請';
    title.appendChild(pickClose());
    sheet.appendChild(title);
    var note = document.createElement('div');
    note.className = 'myapp-pick-note';
    note.textContent = days.length
      ? '選んだ日の残業申請を、1日ずつ開きます。申請済みの日は外してください。'
      : '残業の時刻を読めませんでした。勤怠実績登録から1日ずつ申請してください。';
    sheet.appendChild(note);
    var go = document.createElement('button');
    go.type = 'button';
    go.className = 'myapp-pick-go';
    var count = function () {
      var n = sheet.querySelectorAll('.myapp-ot-day[aria-pressed="true"]').length;
      go.textContent = n ? n + '日分を申請する' : '日を選んでください';
      go.disabled = !n;
    };
    days.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'myapp-ot-day';
      b.setAttribute('aria-pressed', d.applied ? 'false' : 'true');
      b.__day = d;
      // 日付と時刻は別の箱に（日付の幅をそろえて、時刻が縦にそろうように）
      var name = document.createElement('span');
      name.className = 'myapp-pick-name myapp-ot-day-name';
      var dayLabel = document.createElement('span');
      dayLabel.className = 'myapp-ot-day-date';
      dayLabel.textContent = d.label;
      name.appendChild(dayLabel);
      name.appendChild(document.createTextNode(d.from + '〜' + d.to));
      var meta = document.createElement('span');
      meta.className = 'myapp-pick-meta';
      meta.textContent = '残業 ' + hhmm(d.ot) + (d.applied ? '　この端末から申請済み' : '');
      b.appendChild(name);
      b.appendChild(meta);
      b.addEventListener('click', function (e) {
        e.preventDefault();
        // 1回のタップで2回 click が届くことがある（アプリの「1回のタップで押す」と iOS の両方）。すぐの2回目は数えない
        if (Date.now() - (b.__myappAt || 0) < 400) return;
        b.__myappAt = Date.now();
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        count();
      });
      sheet.appendChild(b);
    });
    go.addEventListener('click', function (e) {
      e.preventDefault();
      var items = Array.prototype.filter.call(sheet.querySelectorAll('.myapp-ot-day'), function (b) {
        return b.getAttribute('aria-pressed') === 'true';
      }).map(function (b) { return { date: b.__day.date, from: b.__day.from, to: b.__day.to, reason: 'last' }; });
      if (!items.length) return;
      closePicker();
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'applyQueue', form: 'frmApply_zangyo', items: items })); } catch (err) {}
    });
    // 申請する・やめる は、シートの下に固定する（日が多くても、スクロールせずに押せる）
    var foot = document.createElement('div');
    foot.className = 'myapp-pick-foot';
    if (days.length) { count(); foot.appendChild(go); }
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'myapp-pick-manual';
    cancel.textContent = days.length ? 'やめる' : '閉じる';
    cancel.addEventListener('click', function (e) { e.preventDefault(); closePicker(); });
    foot.appendChild(cancel);
    sheet.appendChild(foot);
    document.body.appendChild(back);
    document.body.appendChild(sheet);
  }

  // 勤怠実績登録を開いたときに入っていたプロジェクトも控える（開いてすぐのものだけ。書きかけは控えない）
  function harvestDtl() {
    if (Date.now() - loadedAt > 8000) return;
    var date = textOf('frmAttendanceDtl_lblDt');
    var month = monthOf(date);
    if (!month) return;
    var items = [];
    for (var n = 1; n <= 6; n++) {
      var no = ((document.querySelector('#frmAttendanceDtl_txtPrj' + n + ' input') || {}).value || '').trim();
      if (!no) continue;
      var name = ((document.querySelector('#frmAttendanceDtl_qbxProj' + n + ' input') || {}).value || '').trim();
      var content = ((document.querySelector('#frmAttendanceDtl_qbxContent' + n + ' input') || {}).value || '').trim();
      items.push({ no: no, name: name, content: content, date: date });
    }
    var key = month + JSON.stringify(items);
    if (harvestDtl.key === key) return;
    harvestDtl.key = key;
    addMonthPrj(month, items);
  }
  // 選べるプロジェクト（勤怠日の月のもの。最近使った順）
  function monthChoices() {
    var month = monthOf(textOf('frmAttendanceDtl_lblDt')) || monthOf(ymd(0));
    var entry = readMonthPrj()[month];
    var list = (entry && entry.list) || [];
    return list.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') || (a.name || '').localeCompare(b.name || ''); });
  }
  // シートの右上の閉じるボタン（×）
  function pickClose() {
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'myapp-pick-close';
    x.setAttribute('aria-label', '閉じる');
    x.textContent = '✕';
    x.addEventListener('click', function (e) { e.preventDefault(); closePicker(); });
    return x;
  }
  function closePicker() {
    document.querySelectorAll('.myapp-pick, .myapp-pick-back').forEach(function (el) { el.remove(); });
  }
  // 選べるプロジェクト: この端末に控えたもの全部（今月・先月の工数と、プロジェクト選択で選んだもの）。今月のものが先
  function knownProjects() {
    var month = monthOf(textOf('frmAttendanceDtl_lblDt')) || monthOf(ymd(0));
    var all = readMonthPrj();
    var seen = {};
    var out = [];
    var add = function (p, mine) {
      if (!p || !p.no || seen[p.no]) return;
      seen[p.no] = true;
      out.push({ no: String(p.no), name: p.name || '', content: p.content || '', mine: mine });
    };
    monthChoices().forEach(function (p) { add(p, true); });
    Object.keys(all).sort().reverse().forEach(function (m) {
      if (m === month) return;
      ((all[m] && all[m].list) || []).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).forEach(function (p) { add(p, false); });
    });
    recentProjects().forEach(function (p) { add(p, false); });
    return out;
  }
  // キーボードが出たら、シートをキーボードのすぐ上に上げ、見えている高さいっぱいに広げる（下にくっつけたままだと、キーボードに隠れる）
  function fitToKeyboard(sheet) {
    var vv = window.visualViewport;
    if (!vv) return;
    var fit = function () {
      if (!sheet.isConnected) {
        vv.removeEventListener('resize', fit);
        vv.removeEventListener('scroll', fit);
        return;
      }
      var kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      sheet.style.bottom = kb > 40 ? kb + 'px' : '';
      sheet.style.height = kb > 40 ? Math.round(vv.height - 12) + 'px' : '';
      sheet.style.maxHeight = kb > 40 ? 'none' : '';
      sheet.classList.toggle('myapp-kb', kb > 40);
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    fit();
  }
  // ---- すべてのプロジェクト（番号でしぼるため） ----
  // EZCraft のプロジェクト選択は、開いたときに全部（プロジェクト・その他業務）をページに読む（見せるのは 50 件ずつ）。
  // それを、この端末に控える（番号・名前・顧客だけ）。EZCraft の検索は番号ぴったりでしか見つからないので、
  // 「98」で始まる番号は、控えた一覧からこちらで探す
  var CATALOG = 'myapp.projectCatalog';
  function readCatalog() {
    try {
      var v = JSON.parse(localStorage.getItem(CATALOG) || 'null');
      return v && Array.isArray(v.list) ? v : null;
    } catch (e) { return null; }
  }
  function gridData(id) {
    var g = document.getElementById(id);
    try {
      var t = g && window.jQuery && window.jQuery(g).data('tcc');
      var d = t && t.getData && t.getData();
      return Array.isArray(d) ? d : [];
    } catch (e) { return []; }
  }
  // 検索欄が空のとき（しぼっていない一覧）だけ控える
  function harvestCatalog() {
    var dialog = document.getElementById('frmSelProj');
    var query = document.querySelector('#frmSelProj_txtQuery input');
    if (!dialog || !dialog.offsetWidth || !query || query.value.trim()) return false;
    var a = gridData('frmSelProj_grdPrj1');
    var b = gridData('frmSelProj_grdPrj2');
    if (a.length + b.length < 20) return false;
    // 同じ一覧なら、つなぎ直さない（ダイアログが開いているあいだ、ページが変わるたびに呼ばれるため）
    var first = a[0] || b[0];
    var key = (a.length + b.length) + ':' + (first && first.PRJ_NO);
    if (harvestCatalog.key === key) return true;
    var rows = a.concat(b);
    var list = [];
    rows.forEach(function (r) {
      var no = r && r.PRJ_NO != null ? String(r.PRJ_NO).trim() : '';
      if (no) list.push({ no: no, name: String(r.PRJ_NM || '').trim(), cust: String(r.CUST_INC_NM || '').trim() });
    });
    try {
      localStorage.setItem(CATALOG, JSON.stringify({ at: Date.now(), list: list }));
      harvestCatalog.key = key;
    } catch (e) { return false; }
    return true;
  }
  // 控えがない・1日より古いときは、裏でプロジェクト選択を開いて読み、すぐ閉じる（画面には出さない。読み込み中の印も出さない）
  var catalogLoading = false;
  var catalogPreload = null; // 裏で読んでいるあいだだけ、やめるための関数（preloadCatalog）
  function preloadCatalog(input, done) {
    var cat = readCatalog();
    if (catalogLoading || (cat && Date.now() - cat.at < 24 * 3600 * 1000)) return false;
    var comp = input.closest('[id^="frmAttendanceDtl_txtPrj"]');
    var n = comp ? comp.id.replace('frmAttendanceDtl_txtPrj', '') : '';
    var icon = document.querySelector('#frmAttendanceDtl_qbxProj' + n + ' div.icon-rt');
    var open = document.getElementById('frmSelProj');
    if (!icon || (open && open.offsetWidth)) return false;
    catalogLoading = true;
    var root = document.documentElement;
    root.classList.add('myapp-quiet', 'myapp-quiet-prj');
    icon.click();
    var start = Date.now();
    var cleared = false;
    // 裏で読んでいるあいだに、人が「プロジェクト選択を開く」を押した: 裏で読むのをやめて、開いているダイアログをそのまま見せる
    // （隠したダイアログの上からもう一度開こうとすると、何も出ないまま、あとで閉じてしまっていた）
    catalogPreload = function () {
      clearInterval(timer);
      catalogPreload = null;
      root.classList.remove('myapp-quiet', 'myapp-quiet-prj');
      catalogLoading = false;
      if (done) done(false);
    };
    var timer = setInterval(function () {
      var dialog = document.getElementById('frmSelProj');
      // ダイアログが自分の入力欄を選んだら外す（キーボードを出さない）
      if (dialog && document.activeElement && dialog.contains(document.activeElement)) document.activeElement.blur();
      // 前に検索したままなら、空にして全部を読み直す
      var query = document.querySelector('#frmSelProj_txtQuery input');
      if (!cleared && query && query.value.trim() && dialog && dialog.offsetWidth) {
        cleared = true;
        typeInto(query, '');
        var go = document.querySelector('#frmSelProj_btnQuery .tcc-btn');
        if (go) go.click();
        start = Date.now();
        return;
      }
      var ok = Date.now() - start > 300 && harvestCatalog();
      if (!ok && Date.now() - start < 10000) return;
      clearInterval(timer);
      catalogPreload = null;
      var quit = dialog && dialog.querySelector('.tcc-modal-quit');
      if (quit) quit.click();
      setTimeout(function () {
        root.classList.remove('myapp-quiet', 'myapp-quiet-prj');
        catalogLoading = false;
        if (done) done(ok);
      }, 400);
    }, 200);
    return true;
  }
  // 「プロジェクト選択を開く」: その行の 🔍 を押して、EZCraft のプロジェクト選択を開く（ページをめくって探す・名前で探す）
  function searchAllProjects(input) {
    closePicker();
    var comp = input.closest('[id^="frmAttendanceDtl_txtPrj"]');
    var n = comp ? comp.id.replace('frmAttendanceDtl_txtPrj', '') : '';
    var icon = document.querySelector('#frmAttendanceDtl_qbxProj' + n + ' div.icon-rt');
    if (!icon) return;
    var reuse = false;
    if (catalogPreload) {
      catalogPreload();
      var opened = document.getElementById('frmSelProj');
      reuse = !!(opened && opened.offsetWidth);
    }
    if (!reuse) icon.click();
    // 前に探したままの言葉が残っていたら、消して全部を出す（開いたときに、関係のない1件だけが出ないように）
    var tries = 0;
    var clear = function () {
      var dialog = document.getElementById('frmSelProj');
      var box = document.querySelector('#frmSelProj_txtQuery input');
      if (!(dialog && box && dialog.offsetWidth)) { if (++tries < 40) setTimeout(clear, 100); return; }
      if (!box.value.trim()) return;
      typeInto(box, '');
      setTimeout(function () {
        var go = document.querySelector('#frmSelProj_btnQuery .tcc-btn');
        if (go) go.click();
      }, 80);
    };
    setTimeout(clear, 150);
  }
  // 番号の欄を押したら出すシート: 上の欄に番号を打つと、その番号で始まるものにしぼる（98 → 98414・98427 …）。
  // 最近使ったものを先に、つづけて、すべてのプロジェクト（控えた一覧）から番号の順に。何も打っていないときは、今月使ったもの
  var PICK_MAX = 60; // 一度に出す数（多いときは、もう少し打ってもらう）
  function openPicker(input) {
    closePicker();
    var known = knownProjects();
    var catalog = (readCatalog() || {}).list || [];
    var loading = false;
    var back = document.createElement('div');
    back.className = 'myapp-pick-back';
    back.setAttribute('data-myapp-nodark', '');
    back.addEventListener('click', closePicker);
    var sheet = document.createElement('div');
    sheet.className = 'myapp-pick myapp-prj-pick';
    sheet.setAttribute('data-myapp-nodark', '');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'プロジェクト');
    var title = document.createElement('div');
    title.className = 'myapp-pick-title';
    title.textContent = 'プロジェクト';
    title.appendChild(pickClose());
    sheet.appendChild(title);
    var search = document.createElement('div');
    search.className = 'myapp-pick-search';
    var field = document.createElement('input');
    field.type = 'text';
    field.setAttribute('inputmode', 'numeric');
    field.setAttribute('enterkeyhint', 'done');
    field.setAttribute('autocomplete', 'off');
    field.setAttribute('aria-label', '番号で探す');
    field.placeholder = '番号で探す（例: 98）';
    search.appendChild(field);
    sheet.appendChild(search);
    var note = document.createElement('div');
    note.className = 'myapp-pick-note';
    sheet.appendChild(note);
    var listBox = document.createElement('div');
    listBox.className = 'myapp-pick-list';
    sheet.appendChild(listBox);
    // 一覧のいちばん下に置く（下に固定すると、キーボードが出たときに一覧が2行ぶんしか見えない）
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'myapp-pick-manual myapp-pick-all';
    all.addEventListener('click', function (e) {
      e.preventDefault();
      searchAllProjects(input);
    });
    var pick = function (no) {
      closePicker();
      typeInto(input, no);
    };
    var row = function (nameText, q, p) {
      var b = document.createElement('button');
      b.type = 'button';
      var name = document.createElement('span');
      name.className = 'myapp-pick-name';
      name.textContent = nameText;
      var meta = document.createElement('span');
      meta.className = 'myapp-pick-meta';
      if (p) {
        // 打った番号のぶんを太く（98414 の 98）
        meta.appendChild(document.createTextNode('No. '));
        if (q && p.no.indexOf(q) === 0) {
          var hit = document.createElement('b');
          hit.textContent = q;
          meta.appendChild(hit);
          meta.appendChild(document.createTextNode(p.no.slice(q.length)));
        } else {
          meta.appendChild(document.createTextNode(p.no));
        }
        // 最近使ったものは作業内訳、ほかは顧客
        var sub = p.content || p.cust || '';
        if (sub) meta.appendChild(document.createTextNode('　' + sub));
      }
      b.appendChild(name);
      b.appendChild(meta);
      return b;
    };
    var matches = [];
    var render = function () {
      var q = field.value.replace(/[\\s　]/g, '');
      // 全角の数字（９８）も、半角として探す
      q = q.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
      var digits = /^\\d+$/.test(q);
      var low = q.toLowerCase();
      var test = digits
        ? function (p) { return p.no.indexOf(q) === 0; }
        : function (p) { return (p.name + ' ' + (p.content || '') + ' ' + (p.cust || '')).toLowerCase().indexOf(low) >= 0; };
      if (!q) {
        matches = known.filter(function (p) { return p.mine; });
        if (!matches.length) matches = known;
      } else {
        var seen = {};
        matches = [];
        known.forEach(function (p) { if (test(p) && !seen[p.no]) { seen[p.no] = true; matches.push(p); } });
        catalog.filter(test).sort(function (a, b) { return a.no.length - b.no.length || a.no.localeCompare(b.no); }).forEach(function (p) {
          if (!seen[p.no]) { seen[p.no] = true; matches.push(p); }
        });
      }
      var what = digits ? '「' + q + '」で始まる番号' : '「' + q + '」を含むもの';
      note.textContent = !q
        ? (known.some(function (p) { return p.mine; }) ? '今月使ったプロジェクト' : '最近使ったプロジェクト')
        : (matches.length ? what + '（' + matches.length + '件）' : what + 'はありません')
          + (loading ? '・すべてのプロジェクトを読み込んでいます…' : (catalog.length ? '' : '（最近使ったものだけ）'));
      listBox.textContent = '';
      matches.slice(0, PICK_MAX).forEach(function (p) {
        var b = row(p.name || ('No. ' + p.no), digits ? q : '', p);
        b.addEventListener('click', function (e) { e.preventDefault(); pick(p.no); });
        listBox.appendChild(b);
      });
      // 一覧にない番号は、そのまま欄に入れる（名前は EZCraft が入れる）
      // 「98」のように打ちかけのときは出さない（しぼった中に無いか、4けた以上打ったときだけ）
      if (matches.length > PICK_MAX) {
        var more = document.createElement('div');
        more.className = 'myapp-pick-note myapp-pick-more';
        more.textContent = 'ほかに ' + (matches.length - PICK_MAX) + ' 件あります。番号をもう少し打つと、しぼれます';
        listBox.appendChild(more);
      }
      var exact = function (p) { return p.no === q; };
      if (digits && !known.some(exact) && !catalog.some(exact) && (!matches.length || q.length >= 4)) {
        var direct = row(q + ' をそのまま入れる', '', null);
        direct.classList.add('myapp-pick-direct');
        direct.querySelector('.myapp-pick-meta').textContent = '番号が分かっているとき';
        direct.addEventListener('click', function (e) { e.preventDefault(); pick(q); });
        listBox.appendChild(direct);
      }
      all.textContent = 'プロジェクト選択を開く';
      listBox.appendChild(all);
      listBox.scrollTop = 0;
    };
    field.addEventListener('input', function (e) { if (!e.isComposing) render(); });
    field.addEventListener('compositionend', render);
    // 確定（キーボードの「完了」）: しぼれて1つなら、それを選ぶ
    field.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (matches.length === 1 && field.value.trim()) pick(matches[0].no);
      else field.blur();
    });
    document.body.appendChild(back);
    document.body.appendChild(sheet);
    fitToKeyboard(sheet);
    // すべてのプロジェクトの控えがない・古いときは、裏で読む。読めたら一覧を出し直す
    loading = preloadCatalog(input, function () {
      loading = false;
      catalog = (readCatalog() || {}).list || catalog;
      if (sheet.isConnected) render();
    });
    render();
  }
  // シートの行を押しているあいだだけ色を付ける。指が動いたら（スクロール・横にずらした）色を消す
  var press = null;
  document.addEventListener('touchstart', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.myapp-pick button');
    var t = e.touches && e.touches[0];
    if (!b || !t) return;
    press = { el: b, x: t.clientX, y: t.clientY };
    b.classList.add('myapp-press');
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function (e) {
    var t = e.touches && e.touches[0];
    if (!press || !t) return;
    if (Math.abs(t.clientX - press.x) + Math.abs(t.clientY - press.y) > 8) {
      press.el.classList.remove('myapp-press');
      press = null;
    }
  }, { capture: true, passive: true });
  ['touchend', 'touchcancel'].forEach(function (type) {
    document.addEventListener(type, function () {
      if (!press) return;
      var el = press.el;
      press = null;
      setTimeout(function () { el.classList.remove('myapp-press'); }, 120);
    }, { capture: true, passive: true });
  });
  var pickStart = null;
  document.addEventListener('touchstart', function (e) {
    var t = e.touches && e.touches[0];
    pickStart = t ? { x: t.clientX, y: t.clientY } : null;
  }, true);
  document.addEventListener('touchend', function (e) {
    var input = e.target && e.target.closest && e.target.closest('[id^="frmAttendanceDtl_txtPrj"] input');
    if (!input || input.__myappManual || input.disabled || input.readOnly || document.activeElement === input) return;
    var t = e.changedTouches && e.changedTouches[0];
    if (pickStart && t && Math.abs(t.clientX - pickStart.x) + Math.abs(t.clientY - pickStart.y) > 10) return; // スクロールだった
    e.preventDefault(); // キーボードを出さずに、シートを出す
    openPicker(input);
  }, true);

  // 時刻・時間の欄を押したら、キーボードではなく、時と分を回して選ぶダイヤルのシートを出す（iOS の時刻の選び方と同じ）。
  // 真ん中の帯に来たものが選ばれる。回すたびにアプリに知らせて、指に小さな手ごたえを返す（EzcraftWebView の tick）
  var DIALS = ${JSON.stringify(TIME_DIALS)};
  var DIAL_ROW = 40; // 1行の高さ。見えるのは5行（上下2行ずつ）
  var DIAL_R = DIAL_ROW / (20 * Math.PI / 180); // 1行で 20 度まわる筒の半径
  var DIAL_LAST = 'myapp.timeDial.'; // この欄で前に選んだ時刻（空の欄を開いたときの始めの値）
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dialKey(id) { return DIAL_LAST + id.replace(/\\d+$/, ''); }
  // 空の欄を開いたときに、最初に真ん中に出す値（分）
  function dialStart(input, id) {
    var cur = minutesOf(input.value);
    if (cur != null) return cur;
    // 作業の時間: 勤務時間から、ほかのプロジェクトに入れた時間を引いた残り
    if (/_txtTime\\d$/.test(id)) {
      var work = minutesOf(textOf('frmAttendanceDtl_work_tm'));
      if (work == null) return 0;
      var used = 0;
      document.querySelectorAll('[id^="frmAttendanceDtl_txtTime"] input').forEach(function (el) {
        if (el !== input) used += minutesOf(el.value) || 0;
      });
      return Math.max(0, Math.min(23 * 60 + 59, work - used));
    }
    // 終わりの時刻: 始まりが入っていれば、その1時間後
    if (/_to\\d*$/.test(id)) {
      var from = document.querySelector('#' + id.replace(/_to(\\d*)$/, '_from$1') + ' input');
      var f = from && minutesOf(from.value);
      if (f != null) return Math.min(23 * 60 + 59, f + 60);
    }
    var last = null;
    try { last = minutesOf(localStorage.getItem(dialKey(id))); } catch (e) {}
    if (last != null) return last;
    var d = new Date();
    return Math.min(23 * 60 + 55, d.getHours() * 60 + Math.round(d.getMinutes() / 5) * 5);
  }
  // 回す列を1つ作る。values は [{ label, value }]。真ん中に来た値が変わるたびに onPick を呼ぶ
  function dialWheel(values, start, name, onPick) {
    var wheel = document.createElement('div');
    wheel.className = 'myapp-dial-wheel';
    wheel.setAttribute('aria-label', name);
    // VoiceOver では「調整可能」な部品として読む（上下にスワイプすると 1 つずつ変わる）。キーボードでは ↑ ↓
    wheel.setAttribute('role', 'slider');
    wheel.setAttribute('tabindex', '0');
    wheel.setAttribute('aria-valuemin', String(values[0].value));
    wheel.setAttribute('aria-valuemax', String(values[values.length - 1].value));
    var list = document.createElement('div');
    list.className = 'myapp-dial-list';
    values.forEach(function (v, i) {
      // 止まる位置は行（div）で決め、筒の形に見せる変形は中の文字（span）にだけかける（行を変形すると、止まる位置がずれる）
      var item = document.createElement('div');
      item.className = 'myapp-dial-item';
      item.setAttribute('aria-hidden', 'true'); // 読み上げは、回している列（slider）の値で
      var face = document.createElement('span');
      face.textContent = v.label;
      item.appendChild(face);
      // 上下の値を押したら、それを真ん中まで回す
      item.addEventListener('click', function () { wheel.scrollTo({ top: i * DIAL_ROW, behavior: 'smooth' }); });
      list.appendChild(item);
    });
    wheel.appendChild(list);
    var index = -1;
    var queued = false;
    var lastTick = 0;
    function paint() {
      queued = false;
      var center = wheel.scrollTop / DIAL_ROW;
      var items = list.children;
      // 真ん中から離れた行ほど、筒の奥へ回りこむように縮めて寄せる
      for (var i = Math.max(0, Math.floor(center) - 4); i < Math.min(items.length, Math.ceil(center) + 5); i++) {
        var d = i - center;
        var th = Math.max(-80, Math.min(80, d * 20)) * Math.PI / 180;
        var y = DIAL_R * Math.sin(th) - d * DIAL_ROW;
        items[i].firstChild.style.transform = 'translateY(' + y.toFixed(1) + 'px) scaleY(' + Math.cos(th).toFixed(3) + ')';
      }
      var now = Math.max(0, Math.min(values.length - 1, Math.round(center)));
      if (now === index) return;
      if (index >= 0 && Date.now() - lastTick > 35) {
        lastTick = Date.now();
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tick' })); } catch (e) {}
      }
      if (index >= 0) items[index].classList.remove('myapp-dial-on');
      items[now].classList.add('myapp-dial-on');
      index = now;
      wheel.setAttribute('aria-valuenow', String(values[now].value));
      wheel.setAttribute('aria-valuetext', values[now].label + name);
      onPick(values[now].value);
    }
    // 1 つずつ動かす（VoiceOver の上下のスワイプ・キーボードの ↑ ↓）
    function nudge(step) {
      var next = Math.max(0, Math.min(values.length - 1, (index < 0 ? 0 : index) + step));
      wheel.scrollTop = next * DIAL_ROW;
      paint();
    }
    wheel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
    });
    wheel.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    // シートを画面に置いてから、始めの値を真ん中に
    wheel.__start = function () {
      var i = 0;
      values.forEach(function (v, k) { if (v.value === start) i = k; });
      wheel.scrollTop = i * DIAL_ROW;
      paint();
    };
    return wheel;
  }
  function openDial(input, id) {
    closePicker();
    var duration = /_txtTime\\d$/.test(id);
    var start = dialStart(input, id);
    var h = Math.floor(start / 60);
    var m = start % 60;
    var back = document.createElement('div');
    back.className = 'myapp-pick-back';
    back.setAttribute('data-myapp-nodark', '');
    back.addEventListener('click', closePicker);
    var sheet = document.createElement('div');
    sheet.className = 'myapp-pick myapp-dial-sheet';
    sheet.setAttribute('data-myapp-nodark', '');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', DIALS[id]);
    var title = document.createElement('div');
    title.className = 'myapp-pick-title';
    title.textContent = DIALS[id];
    title.appendChild(pickClose());
    sheet.appendChild(title);
    // 時（0〜23。退勤・終了の時刻は、日をまたいだ 29 時（翌朝 5 時）まで。いま入っている時刻がそれを越えていれば、そこまで）と、分（0〜59）
    var lastHour = !duration && /(work_end_tm|zangyo_tm_to|kyuzitu_tm_to)$/.test(id) ? 29 : 23;
    var hours = [];
    for (var i = 0; i <= Math.max(lastHour, h); i++) hours.push({ label: duration ? String(i) : pad2(i), value: i });
    var minutes = [];
    for (var k = 0; k < 60; k++) minutes.push({ label: pad2(k), value: k });
    var dial = document.createElement('div');
    dial.className = 'myapp-dial' + (duration ? ' myapp-dial-duration' : '');
    // 時の列はシートの左半分、分の列は右半分を、まるごと回せる範囲にする（数字は真ん中寄りに並べる。CSS）。
    // 列を数字の幅だけにすると、左右の広い所を触っても回らず、回しづらかった
    var hw = dialWheel(hours, h, duration ? '時間' : '時', function (v) { h = v; });
    var mw = dialWheel(minutes, m, '分', function (v) { m = v; });
    hw.classList.add('myapp-dial-hours');
    mw.classList.add('myapp-dial-minutes');
    dial.appendChild(hw);
    var sep = document.createElement('span');
    sep.className = duration ? 'myapp-dial-unit myapp-dial-unit-h' : 'myapp-dial-sep';
    sep.textContent = duration ? '時間' : ':';
    dial.appendChild(sep);
    dial.appendChild(mw);
    if (duration) {
      var unit = document.createElement('span');
      unit.className = 'myapp-dial-unit myapp-dial-unit-m';
      unit.textContent = '分';
      dial.appendChild(unit);
    }
    sheet.appendChild(dial);
    var foot = document.createElement('div');
    foot.className = 'myapp-pick-foot';
    var go = document.createElement('button');
    go.type = 'button';
    go.className = 'myapp-pick-go';
    go.textContent = '決定';
    go.addEventListener('click', function (e) {
      e.preventDefault();
      var value = pad2(h) + ':' + pad2(m);
      closePicker();
      if (!duration) { try { localStorage.setItem(dialKey(id), value); } catch (err) {} }
      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      // 人が選んだ値として入れる（勤怠実績登録の残業: 時刻を直して登録したら、残業申請を自動で開く。overtimeCard）
      input.__myappDialEdit = input.value !== value;
      typeInto(input, value);
      input.__myappDialEdit = false;
    });
    foot.appendChild(go);
    // 消す（入っているときだけ）
    var more = document.createElement('div');
    more.className = 'myapp-dial-more';
    if (input.value) {
      var clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'myapp-pick-manual';
      clear.textContent = duration ? '時間を消す' : '時刻を消す';
      clear.addEventListener('click', function (e) {
        e.preventDefault();
        closePicker();
        input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        input.__myappDialEdit = true;
        typeInto(input, '');
        input.__myappDialEdit = false;
      });
      more.appendChild(clear);
    }
    if (more.firstChild) foot.appendChild(more);
    sheet.appendChild(foot);
    document.body.appendChild(back);
    document.body.appendChild(sheet);
    hw.__start();
    mw.__start();
  }
  document.addEventListener('touchend', function (e) {
    var input = e.target && e.target.closest && e.target.closest('input');
    var comp = input && input.closest('.tcc-component');
    if (!comp || !DIALS[comp.id]) return;
    if (input.__myappManual || input.disabled || input.readOnly || document.activeElement === input) return;
    var t = e.changedTouches && e.changedTouches[0];
    if (pickStart && t && Math.abs(t.clientX - pickStart.x) + Math.abs(t.clientY - pickStart.y) > 10) return; // スクロールだった
    e.preventDefault(); // キーボードを出さずに、ダイヤルを出す
    openDial(input, comp.id);
  }, true);

  // メニュー: お知らせのカードの高さを、見えている行の高さの合計にする（多いときは 3 行ぶんまでにして、カードの中でスクロール）
  function topAnnouncement() {
    var form = document.getElementById('frmLTiMSTop');
    var grid = document.getElementById('frmLTiMSTop_grdAnnouncement');
    if (!form || !grid) return;
    var rows = Array.prototype.filter.call(grid.querySelectorAll('.TccGridBodyScroll tbody tr'), function (tr) {
      return !tr.querySelector('th') && getComputedStyle(tr).display !== 'none';
    });
    var h = 0;
    rows.forEach(function (tr, i) {
      if (i < 3) h += tr.offsetHeight;
      var last = i === rows.length - 1;
      if (last !== tr.hasAttribute('data-myapp-last')) tr.toggleAttribute('data-myapp-last', last);
    });
    var px = (rows.length ? Math.max(h + 2, 72) : 72) + 'px';
    if (form.style.getPropertyValue('--myapp-ann') !== px) form.style.setProperty('--myapp-ann', px);
  }

  // 有給の日数（「27日＋6:00」「0日+00:00」）は、日と時間が読みにくい。「27日 6時間」「0日」と書き直す（表示だけ。データはそのまま）。
  // 有給休暇申請の付与数・使用数・残数と、休暇照会の表（ここは「27日 6:00」と空白で区切ってある）
  function dayTime(text, plusOnly) {
    var re = plusOnly ? /(\\d+)日\\s*[+＋]\\s*(\\d{1,2}):(\\d{2})/g : /(\\d+)日\\s*[+＋]?\\s*(\\d{1,2}):(\\d{2})/g;
    return text.replace(re, function (all, d, h, m) {
      h = +h;
      m = +m;
      return d + '日' + (h ? ' ' + h + '時間' : '') + (m ? (h ? '' : ' ') + m + '分' : '');
    });
  }
  function dayTimes() {
    var targets = [
      ['.tcc-component.lbl .tcc-label-text', true],
      ['#frmApply_grdLeave .TccGridBodyScroll td', false],
    ];
    targets.forEach(function (t) {
      document.querySelectorAll(t[0]).forEach(function (el) {
        // 前に見たときから文字が変わっていなければ、見直さない（ページのどこかが変わるたびに、全部のラベルを調べ直さない）
        var text = el.textContent || '';
        if (el.__myappDayText === text) return;
        if (/\\d日/.test(text)) {
          var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          var node;
          while ((node = w.nextNode())) {
            if (!/\\d日/.test(node.nodeValue)) continue;
            var v = dayTime(node.nodeValue, t[1]);
            if (v !== node.nodeValue) node.nodeValue = v;
          }
        }
        el.__myappDayText = el.textContent || '';
      });
    });
  }

  // 勤務表: 上のヘッダーの名前を、開いているタブの名前にする（アプリに知らせる。EzcraftWebView の title）
  var lastHeading = null;
  function tabHeading(list, pane) {
    // 勤怠申請: 新規申請のタブはアプリの名前（勤怠申請）のまま。ほかのタブは、そのタブの名前（承認待ちなど）
    if (document.getElementById('frmApply')) {
      var applyPane = document.querySelector('#frmApply_tabApply > .tcc-tab-content > .tcc-tab-pane.active');
      var applyIdx = applyPane ? Array.prototype.indexOf.call(applyPane.parentElement.children, applyPane) : 0;
      var applyHead = document.querySelectorAll('#frmApply_tabApply > ul.tcc-tab-head > li')[applyIdx];
      var applyName = applyIdx > 0 && applyHead ? (applyHead.textContent || '').trim() : '';
      if (applyName === lastHeading) return;
      lastHeading = applyName;
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'title', text: applyName })); } catch (e) {}
      return;
    }
    if (!document.getElementById('frmAttendance')) return;
    var name = '勤務表';
    if (!list && pane) {
      var idx = Array.prototype.indexOf.call(pane.parentElement.children, pane);
      var head = document.querySelectorAll('#frmAttendance_tabAttd > ul.tcc-tab-head > li')[idx];
      var t = head ? (head.textContent || '').trim() : '';
      name = /集計/.test(t) ? '集計' : /申請状況/.test(t) ? '申請状況' : /出力/.test(t) ? '日別の記録' : /工数/.test(t) ? '工数' : '勤務表';
    }
    if (name === lastHeading) return;
    lastHeading = name;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'title', text: name === '勤務表' ? '' : name })); } catch (e) {}
  }

  window.__myappAppUpdate = function () {
    topAnnouncement();
    dayTimes();
    // 勤務表: 「勤務表」のタブを開いているときだけ、スマホ向けの一覧にする
    var list = !!document.querySelector('#frmAttendance_tabAttd_tabs_0.active');
    document.documentElement.classList.toggle('myapp-att-list', list);
    if (list) { markDays(); kenkoCard(); summary(); autoMonth(); monthNav(); preloadKosu(); otBulkButton(); dayBadges(); }
    harvestKosu();
    // ほかのタブ: 検索の条件を並べ直し、自分の分を出す
    var otherTab = list ? null : document.querySelector('#frmAttendance_tabAttd > .tcc-tab-content > .tcc-tab-pane.active');
    document.documentElement.classList.toggle('myapp-att-tab', !!otherTab);
    if (otherTab) {
      kenkoCard(); reflowSearch(otherTab); showTab(otherTab); autoSearch(otherTab, true);
      // 時刻の書き方を、勤務表のタブ（残業 0:30）にそろえる（00:30 → 0:30）。出力の日付は「11/01(日)」に
      otherTab.querySelectorAll('.tcc-component.grid .TccGridBodyScroll').forEach(fixTimes);
      outputDates();
      kosuView(otherTab);
    }
    else lastPane = null;
    tabHeading(list, otherTab);
    // 勤怠申請: 「新規申請」のタブは申請の種類のカード、ほかのタブは検索の条件と結果のカード（開いたら一度だけ検索して、自分の分を出す）
    document.documentElement.classList.toggle('myapp-apply-new', !!document.querySelector('#frmApply_tabApply_tabs_0.active'));
    var applyTab = document.querySelector('#frmApply_tabApply > .tcc-tab-content > .tcc-tab-pane.active:not(#frmApply_tabApply_tabs_0)');
    document.documentElement.classList.toggle('myapp-apply-tab', !!applyTab);
    if (applyTab) { reflowSearch(applyTab); showTab(applyTab); autoSearch(applyTab, false); applyTitles(); leaveCards(); }
    var dtl = document.getElementById('frmAttendanceDtl');
    if (dtl) { markProjects(dtl); markBreaks(dtl); dtlCards(); overtimeCard(dtl); dtlLayout(dtl); harvestDtl(); showTimes(['frmAttendanceDtl_lblTotal', 'frmAttendanceDtl_work_tm']); }
    recentChips();
    harvestCatalog();
    var yk = document.getElementById('frmApply_yukyu');
    if (yk) yukyu(yk);
    ${JSON.stringify(APPLY_FORMS)}.forEach(function (id) {
      var f = document.getElementById(id);
      if (f) applyForm(f);
    });
  };
})();
`;

/* 勤怠実績登録: 番号の欄を押すと出る「今月のプロジェクト」のシート（JS の openPicker）。下から出るガラスのシート */
const PICK_CSS = `
.myapp-pick-back {
  position: fixed; inset: 0; z-index: 100000;
  background: rgba(0, 0, 0, 0.28);
  animation: myapp-pick-fade 0.18s ease-out;
}
.myapp-pick {
  /* 画面の下の端までつけて出す（下にすきまを空けると、後ろの一覧がのぞいて、作りかけに見える）。下はホームに戻るバーのぶん空ける */
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 100001;
  max-height: 80vh; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
  box-sizing: border-box; padding: 6px 8px 8px;
  /* 透けると、後ろの一覧（休日・残業・下のタブ）が行の後ろにのぞくので、透けない地に */
  background: var(--myapp-surface);
  border: 1px solid var(--myapp-glass-border);
  border-bottom: none;
  border-radius: 30px 30px 0 0;
  box-shadow: var(--myapp-glass-shadow);
  animation: myapp-pick-up 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
}
/* 下に固定した帯（.myapp-pick-foot）のないシートは、いちばん下にホームに戻るバーのぶんのすきまを空ける */
.myapp-pick:not(:has(> .myapp-pick-foot))::after { content: ''; display: block; height: var(--myapp-safe-bottom, 0px); }
/* 上のつまみ（下から出たシートだと分かるように）と、題名・閉じる（×） */
.myapp-pick::before { content: ''; display: block; width: 36px; height: 5px; margin: 0 auto 2px; border-radius: 3px; background: var(--myapp-border); }
.myapp-pick-title { display: flex; align-items: center; min-height: 40px; padding: 6px 8px 6px 14px; font-size: 17px; font-weight: 600; color: var(--myapp-text); }
.myapp-pick button.myapp-pick-close {
  /* ダイアログの × と同じ形 */
  flex: none; width: 36px; height: 36px; margin: 0 0 0 auto; padding: 0;
  border-radius: 18px; background: var(--myapp-segment); color: var(--myapp-text);
  font-size: 16px; font-weight: 600; line-height: 36px; text-align: center;
}
.myapp-pick button {
  display: block; width: 100%; box-sizing: border-box;
  margin: 0; padding: 11px 14px; border: 0; border-radius: 18px;
  background: transparent; color: var(--myapp-text); text-align: left; font: inherit;
}
/* 押しているあいだの色は、JS が .myapp-press で付ける（:active だと、横に指をずらしただけでも押したように見えるため） */
.myapp-pick button.myapp-press { background: var(--myapp-pressed-bg); }
.myapp-pick-name { display: block; font-size: 16px; font-weight: 600; line-height: 1.3; }
.myapp-pick-meta { display: block; margin-top: 2px; font-size: 13px; color: var(--myapp-text2); }
/* 2つ目の操作（番号を入力する・やめる）は、青いカプセルと同じ形の灰色。白いシートの上でも、ボタンだと分かる */
.myapp-pick button.myapp-pick-manual {
  margin-top: 10px; height: 50px; padding: 0; border-radius: 999px;
  text-align: center; font-size: 17px; font-weight: 600; color: var(--myapp-accent-text);
  background: var(--myapp-segment);
}
@keyframes myapp-pick-up { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes myapp-pick-fade { from { opacity: 0; } to { opacity: 1; } }

/* 勤務表: 「残業をまとめて申請」のボタン（一覧のいちばん上。JS の otBulkButton）と、日を選ぶシート（openOtBulk） */
.myapp-ot-bulk {
  order: -1; display: block; width: 100%; box-sizing: border-box; height: 48px; margin: 0 0 14px;
  border: 0; border-radius: 24px; background: var(--myapp-segment); color: var(--myapp-accent-text);
  font: inherit; font-size: 16px; font-weight: 600;
}
.myapp-ot-bulk:active { background: var(--myapp-pressed-bg); }
.myapp-ot-bulk[data-loading] { opacity: 0.55; }
.myapp-pick-note { padding: 0 14px 10px; font-size: 13px; line-height: 1.5; color: var(--myapp-text2); text-wrap: balance; }
.myapp-pick button.myapp-ot-day { position: relative; padding-left: 50px; }
/* 日付の幅をそろえる（「11/10(火)」も「11/9(日)」も同じ幅）。数字は同じ幅の字に */
.myapp-ot-day-name { font-variant-numeric: tabular-nums; }
.myapp-ot-day-date { display: inline-block; min-width: 92px; }
.myapp-ot-day::before {
  content: ''; position: absolute; left: 14px; top: 50%; width: 24px; height: 24px; margin-top: -12px;
  box-sizing: border-box; border-radius: 50%; border: 2px solid var(--myapp-field-border);
}
.myapp-ot-day[aria-pressed="true"]::before {
  border-color: var(--myapp-accent);
  background: var(--myapp-accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4L18 8' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 16px no-repeat;
}
.myapp-pick-foot {
  /* ボタンの左右は、ほかの画面のカードと同じ 16px 空ける */
  position: sticky; bottom: -8px; margin: 4px -8px -8px; padding: 6px 16px calc(8px + var(--myapp-safe-bottom, 0px));
  background: var(--myapp-surface); /* 透けると、後ろにスクロールした行がのぞく */
  border-top: 1px solid var(--myapp-border);
}
.myapp-pick button.myapp-pick-go {
  /* 主な操作は、どの画面でも同じ青いカプセル（登録・検索・開く と同じ） */
  margin-top: 8px; height: 50px; padding: 0; text-align: center; font-size: 17px; font-weight: 600; color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 999px;
  background: var(--myapp-tint); box-shadow: var(--myapp-tint-shadow);
}
.myapp-pick button.myapp-pick-go:active { background: var(--myapp-tint); transform: scale(0.97); }
.myapp-pick button.myapp-pick-go:disabled { box-shadow: none; }
.myapp-pick button.myapp-pick-go:disabled { opacity: 0.4; }

/* プロジェクトのシート（JS の openPicker）: 上に番号の検索欄、まん中に一覧（ここだけスクロール）、下に「すべてのプロジェクトから探す」 */
.myapp-pick.myapp-prj-pick { display: flex; flex-direction: column; overflow: hidden; }
.myapp-prj-pick > * { flex: none; }
.myapp-prj-pick .myapp-pick-list {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
}
.myapp-prj-pick .myapp-pick-note { padding-top: 2px; }
.myapp-pick-search { position: relative; margin: 2px 8px 10px; }
.myapp-pick-search::before {
  content: ''; position: absolute; left: 13px; top: 50%; width: 17px; height: 17px; margin-top: -8.5px; pointer-events: none;
  background: var(--myapp-text2);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='M15.5 15.5 21 21'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='M15.5 15.5 21 21'/%3E%3C/svg%3E") center / contain no-repeat;
}
.myapp-pick-search input {
  display: block; width: 100%; box-sizing: border-box; height: 44px; margin: 0; padding: 0 14px 0 40px;
  border: 0; border-radius: 12px; outline: none; -webkit-appearance: none; appearance: none;
  background: var(--myapp-segment); color: var(--myapp-text); font: inherit; font-size: 17px;
}
.myapp-pick-search input::placeholder { color: var(--myapp-text2); }
/* 打った番号のぶん（98414 の 98）を太く */
.myapp-pick-meta b { font-weight: 700; color: var(--myapp-accent-text); }
.myapp-pick button.myapp-pick-direct .myapp-pick-name { color: var(--myapp-accent-text); }
.myapp-prj-pick .myapp-pick-more { padding: 10px 14px 4px; }
/* すべてのプロジェクトを裏で読むあいだ、開いたプロジェクト選択と後ろの暗い面は見せない（JS の preloadCatalog） */
html.myapp-quiet-prj #frmSelProj, html.myapp-quiet-prj .tcc-modal-back { visibility: hidden !important; }
/* キーボードが出ているあいだは、ホームに戻るバーのぶんのすきまは要らない */
.myapp-pick.myapp-kb::after { height: 0 !important; }
/* 左右は、ほかの画面のボタンと同じ 16px 空ける */
.myapp-pick button.myapp-pick-all { width: calc(100% - 16px); margin: 10px 8px 2px; }

/* 時刻を選ぶダイヤル（JS の openDial）: 時と分の列を回す。真ん中の帯に来たものが選ばれる。上下は薄く消えていく。
   時の列はシートの左半分、分の列は右半分をまるごと使い、どこを触っても回せる。数字は真ん中の「:」の近くに寄せる */
.myapp-dial { position: relative; display: flex; justify-content: center; align-items: center; height: 200px; margin: 6px 0 2px; }
.myapp-dial::before {
  content: ''; position: absolute; left: 8px; right: 8px; top: 80px; height: 40px;
  border-radius: 12px; background: var(--myapp-segment); pointer-events: none;
}
.myapp-dial-wheel {
  position: relative; z-index: 1; flex: 1 1 0; min-width: 0; height: 200px;
  overflow-y: scroll; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
  scroll-snap-type: y mandatory; scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 38%, #000 62%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 38%, #000 62%, transparent 100%);
}
.myapp-dial-wheel::-webkit-scrollbar { display: none; }
.myapp-dial-list { padding: 80px 0; }
.myapp-dial-item {
  height: 40px; line-height: 40px; text-align: center; scroll-snap-align: center;
  font-size: 22px; color: var(--myapp-text2); font-variant-numeric: tabular-nums;
}
.myapp-dial-item > span { display: block; }
.myapp-dial-item.myapp-dial-on { color: var(--myapp-text); font-weight: 600; }
.myapp-dial-hours .myapp-dial-item { text-align: right; padding-right: 30px; }
.myapp-dial-minutes .myapp-dial-item { text-align: left; padding-left: 30px; }
.myapp-dial-sep { position: relative; z-index: 1; flex: none; width: 16px; text-align: center; font-size: 22px; font-weight: 600; color: var(--myapp-text); }
/* 作業の時間（「8 時間 30 分」）: 単位は真ん中の帯に重ねて置く（触っても下の列が回るように、押せないものにする） */
.myapp-dial-unit {
  position: absolute; z-index: 2; top: 80px; height: 40px; line-height: 40px; width: 44px;
  font-size: 17px; color: var(--myapp-text); pointer-events: none;
}
.myapp-dial-unit-h { right: 50%; text-align: center; }
.myapp-dial-unit-m { left: calc(50% + 64px); }
.myapp-dial-duration .myapp-dial-hours .myapp-dial-item { padding-right: 52px; }
.myapp-dial-duration .myapp-dial-minutes .myapp-dial-item { padding-left: 28px; }
/* 消す（入っているときだけ出す） */
.myapp-dial-more { display: flex; gap: 10px; }
.myapp-dial-more button.myapp-pick-manual { flex: 1 1 0; width: auto; }

/* 勤務表を開いたときに、裏で「工数」を読むあいだは、読み込み中の印を出さない（preloadKosu） */
html.myapp-quiet #loadingIcon { display: none !important; }
`;

/* 代休申請の注意書き（給与控除が発生します）は、申請者の下に1行で */
const DAIKYU_CSS = `
/* 注意書きは、ほかの値と同じ右の列（104px）から。文言はかっこを外して1文に（relabel） */
#frmApply_daikyu_lbl30 { left: 104px !important; top: 140px !important; width: calc(100% - 120px) !important; height: 24px !important; }
${text('frmApply_daikyu_lbl30', 13, { muted: true })}
:is(#frmApply_daikyu_R1, #frmApply_daikyu_R1 > *, #frmApply_daikyu_blank1) { height: 172px !important; }
#frmApply_daikyu[data-myapp-new] #frmApply_daikyu_lbl30 { top: 84px !important; }
#frmApply_daikyu[data-myapp-new] :is(#frmApply_daikyu_R1, #frmApply_daikyu_R1 > *, #frmApply_daikyu_blank1) { height: 116px !important; }
`;

export const TIMS_SKIN: AppSkin = {
  mobileForms: ['frmLTiMSTop', 'frmAttendance', 'frmAttendanceDtl', 'frmSelProj', 'frmSelEmp', 'frmApply', 'frmApply_yukyu', ...APPLY_FORMS],
  titles: {
    frmAttendance: '勤務表',
    frmAttendanceDtl: '勤怠実績登録',
    frmApply: '勤怠申請',
    frmApply_yukyu: '有給休暇申請',
    frmApply_tokkyu: '特別休暇申請',
    frmApply_hurikyu: '振休申請',
    frmApply_daikyu: '代休申請',
    frmApply_zangyo: '残業申請',
    frmApply_kyuzitu: '休日出勤申請',
    frmApply_chikokuSotai: '遅刻早退申請',
  },
  tabBars: {
    [A('tabAttd')]: [
      // 「勤務表」は、ほかのタブの名前（勤務表出力）にも含まれるので最後に置く（下のタブに並ぶ順は、元のタブの順）
      { match: '集計', label: '集計', icon: 'M5 20v-8 M12 20V5 M19 20v-11 M3 20h18' },
      { match: '申請状況', label: '申請状況', icon: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M9 12l2 2 4-4' },
      // 「出力」は、日ごとの出勤・退勤の一覧（CSV にも書き出せる）。どのタブにも CSV 出力があるので、中身で呼ぶ
      { match: '出力', label: '日別', icon: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01' },
      { match: '工数', label: '工数', icon: 'M5 8h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 8z M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8 M3.5 13h17' },
      { match: '勤務表', label: '勤務表', icon: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M4 10h16 M8 3v4 M16 3v4' },
    ],
    // 勤怠申請: 新規申請・承認待ち・申請検索・休暇照会（承認する人でなければ、承認待ちは出ない）
    [AP('tabApply')]: [
      { match: '新規申請', label: '新規申請', icon: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M12 8v8 M8 12h8' },
      { match: '承認待ち', label: '承認待ち', icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 7v5l3 2' },
      { match: '申請検索', label: '申請検索', icon: 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0z M20 20l-4-4' },
      // 休暇の残りの日数（有給休暇申請の近道と同じ、太陽の絵）
      { match: '休暇照会', label: '休暇照会', icon: 'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6l1.4 1.4 M17 17l1.4 1.4 M5.6 18.4L7 17 M17 7l1.4-1.4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z' },
    ],
  },
  bottomBars: {
    frmAttendanceDtl: [D('btnIns')],
    frmApply_yukyu: [Y('btnCancel'), Y('btnDone')],
    ...Object.fromEntries(APPLY_FORMS.map((f) => [f, [`${f}_btnCancel`, `${f}_btnDone`]])),
  },
  danger: [D('btnDel'), ...[1, 2, 3, 4, 5, 6].map((n) => D(`btnDel${n}`))],
  // 時刻の欄はダイヤルで選ぶ。ダイヤルを出さずに欄に入ったとき（外付けのキーボードなど）だけ、数字のキーボードにする
  numeric: Object.keys(TIME_DIALS),
  pickers: [
    { dialog: 'frmSelProj', ok: 'frmSelProj_btnOK' },
    { dialog: 'frmSelEmp', ok: 'frmSelEmp_btnOK' },
  ],
  liveSearch: [
    { input: 'frmSelProj_txtQuery', button: 'frmSelProj_btnQuery' },
    { input: 'frmSelEmp_txtEmp', button: 'frmSelEmp_btnQry' },
  ],
  relabel: {
    ...Object.fromEntries(APPLY_KINDS.map(({ note, text: label }) => [AP(note), label])),
    // 代休の注意書き: 全角のかっこで囲んだ文を、ふつうの1文に
    frmApply_daikyu_lbl30: '代休を取ると、給与から控除されます。',
  },
  // 検索欄の、パソコン向けの並べただけの言葉（「タイトル名　申請書名」「Prj-No プロジェクト名 顧客名 チーム」）を、ふつうの文に
  placeholders: {
    frmApply_approve_search_text: '申請書名・タイトルで探す',
    frmSelProj_txtQuery: '番号・名前・顧客・チームで探す',
  },
  emptyGrids: {
    frmApply_grdApprove: '承認を待っている申請はありません',
    frmApply_grdSearch: '申請は見つかりませんでした',
    frmApply_grdLeave: 'データはありません',
    frmLTiMSTop_grdApply: '申請中のものはありません',
    frmLTiMSTop_grdAnnouncement: 'お知らせはありません',
    // 有給休暇申請の「ステータス」: 申請する前は、承認の流れがまだないので、空の白い面にせずそう書く
    frmApply_yukyu_grdStatus: '申請すると、ここに承認の状況が出ます',
    frmSelProj_grdPrj1: '見つかりませんでした',
    frmSelProj_grdPrj2: '見つかりませんでした',
    frmSelEmp_grdEmp: '見つかりませんでした',
    frmAttendance_grdTotal: 'データはありません',
    frmAttendance_grdApplyStat: 'データはありません',
    frmAttendance_grdAttd: 'データはありません',
    frmAttendance_grdPrj: 'データはありません',
  },
  cards: [
    { button: 'frmLTiMSTop_btnAttendance' },
    { button: 'frmLTiMSTop_btnApply' },
  ],
  sections: ['frmLTiMSTop_lbl_announcement_title', 'frmLTiMSTop_lbl12'],
  // カードの説明（lbl1・lbl5）は出さない。見出しだけで分かる
  hidden: ['frmLTiMSTop_R1_C1', 'frmLTiMSTop_lbl1', 'frmLTiMSTop_lbl5', 'frmLTiMSTop_lblQuit', 'frmLTiMSTop_lblYser', 'frmLTiMSTop_btnSettings'],
  script: SCRIPT,
  layout: [TOP_CSS, scoped(':root.myapp-att-list', ATT_FRAME_CSS + LIST_CSS), scoped(':root.myapp-att-tab', ATT_FRAME_CSS + ATT_TABS_CSS), DTL_CSS, scoped(':root.myapp-apply-new', APPLY_FRAME_CSS + APPLY_CSS), scoped(':root.myapp-apply-tab', APPLY_FRAME_CSS + APPLY_TABS_CSS), YUKYU_CSS, ...APPLY_FORMS.map(applyFormCss), DAIKYU_CSS, REFLOW_CSS, PROJECT_SELECT_CSS, EMPLOYEE_SELECT_CSS, PICK_CSS].join('\n'),
};
