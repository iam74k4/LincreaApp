// EZCraft の画面の部品を、スマホの幅で置き直すための小さな道具。
// EZCraft は部品を座標で置くので、部品の ID ごとに位置と大きさを決め直す（appStyles.ts・timsSkin.ts で使う）。

/** フォームを画面の幅いっぱいにする（中の入れ物も含めて）。枠線は消す */
export function fullWidth(formId: string): string {
  return `
#${formId},
#${formId} > *,
#${formId} .tcc-modal-body,
#${formId} .tcc-tile,
#${formId} .tcc-panel,
#${formId} .tcc-panel-body,
#${formId} .tcc-tab,
#${formId} .tcc-tab-content,
#${formId} .tcc-tab-pane {
  width: 100% !important;
  max-width: 100% !important;
  left: 0 !important;
  box-sizing: border-box !important;
  border: none !important;
}
/* 入力欄の文字は 16px 以上に（iOS は、それより小さいと入力のときに画面を勝手に拡大する） */
#${formId} input,
#${formId} textarea,
#${formId} select { font-size: 16px !important; }
`;
}

/** ダイアログを、画面の左右に余白をとった幅で、上のほうに出す */
export function mobileDialog(formId: string, height: number): string {
  return `
${fullWidth(formId)}
#${formId} {
  position: fixed !important;
  left: 16px !important;
  top: 96px !important;
  width: calc(100% - 32px) !important;
  margin: 0 !important; /* 元のページの余白（5px）が残ると、右に寄って左右の余白がそろわない */
  height: ${height}px !important;
}
`;
}

/** 部品を置く（左・上・幅・高さ。幅には calc() も使える） */
export function place(id: string, left: string, top: number, width: string, height: number): string {
  return `#${id} { left: ${left} !important; top: ${top}px !important; width: ${width} !important; height: ${height}px !important; }`;
}

/** 左右16pxの余白で、横いっぱいに置く */
export function row(id: string, top: number, height: number): string {
  return place(id, '16px', top, 'calc(100% - 32px)', height);
}

/** 入力欄（テキスト・選択）の中身を、置き場所の大きさいっぱいに広げる。選択欄の ▼ は右端に */
export function fillInput(inputId: string): string {
  return `
#${inputId} .text-box,
#${inputId} .num-box,
#${inputId} input {
  box-sizing: border-box !important;
  width: 100% !important;
  height: 100% !important;
}
#${inputId} input.icon-rt { padding-right: 28px !important; }
#${inputId} > div.icon-rt {
  left: auto !important;
  right: 4px !important;
  top: 0 !important;
  width: 24px !important;
  height: 100% !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
}
`;
}

/** ラベルを、置き場所の大きさいっぱいに（文字は上下の真ん中） */
export function fillLabel(labelId: string): string {
  return `
#${labelId} .tcc-label { height: 100% !important; width: 100% !important; }
`;
}

/** ラベルの文字の大きさ・太さ・色・寄せを決める（色は text か text2） */
export function text(id: string, size: number, opts: { bold?: boolean; muted?: boolean; align?: 'left' | 'center' | 'right' } = {}): string {
  return `
#${id} .tcc-label { width: 100% !important; height: 100% !important; }
#${id} .tcc-label-text { width: 100% !important; max-width: 100% !important; }
#${id} .tcc-label,
#${id} .tcc-label-text {
  font-size: ${size}px !important;
  font-weight: ${opts.bold ? 700 : 400} !important;
  color: var(${opts.muted ? '--myapp-text2' : '--myapp-text'}) !important;
  text-align: ${opts.align ?? 'left'} !important;
  white-space: nowrap;
}
`;
}

/** ボタンを、置き場所の大きさいっぱいに広げる（中の2段の入れ物も） */
export function fillButton(buttonId: string): string {
  return `
#${buttonId} .tcc-btn-group,
#${buttonId} .tcc-btn {
  display: flex !important;
  align-items: center;
  justify-content: center;
  width: 100% !important;
  height: 100% !important;
  font-size: 16px !important;
}
`;
}

/**
 * セレクターの並び（a, b, c）を、1つずつに分ける。( ) や [ ] の中の , では分けない
 * （:is(.a, .b) を「:is(.a」と「.b)」に分けると、条件が ( ) の中にまで入り、ルールが強くなりすぎるため）
 */
function splitSelectors(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i += 1) {
    const ch = list[i];
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(list.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(list.slice(start));
  return parts;
}

/** CSS の各ルールの前に条件（祖先のセレクター）を付けて、条件に合うときだけ効くようにする */
/**
 * 1つのセレクターに条件を付ける。:root で始まるもの（:root[data-myapp-theme="dark"] … など、ページ全体の条件）は、
 * 条件の中に置くと「:root の中の :root」になって効かないので、同じ :root に付ける
 * （条件も :root.myapp-apply-new のように :root だけなら :root.myapp-apply-new[data-myapp-theme="dark"] …）
 */
function withScope(scope: string, selector: string): string {
  const root = /^:root((?:\[[^\]]*\]|\.[\w-]+)*)(?=\s|$)\s*([\s\S]*)$/.exec(selector);
  if (!root) return `${scope} ${selector}`;
  const [, conditions, rest] = root;
  const head = /^:root\S*$/.test(scope) ? `${scope}${conditions}` : `:root${conditions} ${scope}`;
  return rest ? `${head} ${rest}` : head;
}

export function scoped(scope: string, css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((chunk) => {
      const open = chunk.indexOf('{');
      if (open < 0) return '';
      const selectors = splitSelectors(chunk.slice(0, open))
        .map((selector) => selector.trim())
        .filter(Boolean)
        .map((selector) => withScope(scope, selector))
        .join(',\n');
      return `${selectors} {${chunk.slice(open + 1)}}`;
    })
    .join('\n');
}

/**
 * 列の多い表を、1行ずつのカードにする（スマホの幅に入らない一覧に）。見出しの行は隠し、列は消さずに並べ直す。
 *   lines[0]  … 1段目（名前など）。大きな文字で、幅いっぱいに折り返す
 *   lines[1〜] … 2段目以降。小さな灰色の文字で、横に並べる（3段まで）
 *   labels    … 見出しを隠すかわりに、値の前に付ける短い名前
 * 行を押したときの選択（EZCraft の動き）はそのまま。
 */
export function cardGrid(
  gridId: string,
  lines: number[][],
  labels: Record<number, string> = {},
  opts: { pager?: boolean; auto?: boolean } = {},
): string {
  const td = (col: number) => `#${gridId} .TccGridBodyScroll td.${gridId}_tdCol${col}`;
  const listed = lines.flat();
  // 段ごとの並び順: 1段目 1 / 2段目 2 / （改行 3）/ 3段目 4 / （改行 5）/ 4段目 6
  const orders = [1, 2, 4, 6];
  const placed = lines
    .map((cols, line) =>
      cols
        .map(
          (col) => `${td(col)} {
  order: ${orders[line]} !important;
  ${line === 0 ? 'flex-basis: 100% !important; font-size: 16px !important; font-weight: 600 !important; color: var(--myapp-text) !important;' : ''}
}`,
        )
        .join('\n'),
    )
    .join('\n');
  const named = Object.entries(labels)
    .map(([col, label]) => `${td(Number(col))}::before { content: '${label}'; margin-right: 4px; color: var(--myapp-text2); font-weight: 400; }`)
    .join('\n');
  return `
#${gridId} .TccGridHeadFixed,
#${gridId} .TccGridHeadScroll,
#${gridId} .TccGridBodyFixed { display: none !important; }
/* ページ送り（« < 1 / 14p > »）がある表は、その分だけ一覧を短くする */
#${gridId} .TccScrollOuter { width: 100% !important; height: ${opts.pager ? 'calc(100% - 52px)' : '100%'} !important; }
${
  opts.pager
    ? `/* ページ送り（« < 1 / 14p > »）: 押しやすい高さ（40px）のボタンが切れないように、帯を 52px にして真ん中に並べる */
#${gridId} .tcc-pager-navi {
  position: absolute !important;
  left: 0 !important;
  top: auto !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 52px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px;
  padding: 0 12px !important;
  box-sizing: border-box !important;
  overflow: visible !important;
}`
    : ''
}
/* 値のない欄は、見出し（::before）ごと出さない。ページが1つしかなければ、ページ送りも出さない（JS がしるしを付ける） */
#${gridId} .TccGridBodyScroll tr td[data-myapp-blank] { display: none !important; } /* 下の「出す列」より強く */
#${gridId}[data-myapp-onepage] .tcc-pager-navi { display: none !important; }
#${gridId}[data-myapp-onepage] .TccScrollOuter { height: 100% !important; }
/* 一覧の中にある、幅合わせ用の見出しの行も隠す */
#${gridId} .TccGridBodyScroll thead,
#${gridId} .TccGridBodyScroll tr:has(> th) { display: none !important; }
#${gridId} .TccGridBodyScroll {
  left: 0 !important;
  top: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch;
}
#${gridId} .TccGridBodyScroll table,
#${gridId} .TccGridBodyScroll tbody { display: block !important; width: 100% !important; }
#${gridId} .TccGridBodyScroll tr {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: baseline;
  column-gap: 10px;
  row-gap: 3px;
  width: 100% !important;
  height: auto !important;
  padding: 10px 16px !important;
  box-sizing: border-box !important;
  border-bottom: 1px solid var(--myapp-border) !important;
}
/* いちばん下の行の下には線を引かない（カードの終わりに、もう1本の線が出ていた。2026-11-22） */
#${gridId} .TccGridBodyScroll tbody > tr:last-child { border-bottom: none !important; }
/* 2段目と3段目のあとで改行する */
#${gridId} .TccGridBodyScroll tr::before,
#${gridId} .TccGridBodyScroll tr::after { content: ''; flex-basis: 100%; height: 0; }
#${gridId} .TccGridBodyScroll tr::before { order: 3; }
#${gridId} .TccGridBodyScroll tr::after { order: 5; }
#${gridId} .TccGridBodyScroll td {
  display: none !important;
  width: auto !important;
  height: auto !important;
  padding: 0 !important;
  border: none !important;
  font-size: 13px !important;
  line-height: 1.35 !important;
  color: var(--myapp-text2) !important;
  white-space: normal !important;
  text-align: left !important;
  background: transparent !important;
}
/* EZCraft が最初から選んでいる行の色は出さず、押した行にだけ色を付ける（行全体に） */
#${gridId} .TccGridBodyScroll tr { background-color: transparent !important; color: inherit !important; }
#${gridId} .TccGridBodyScroll tr.myapp-tapped { background-color: var(--myapp-selected) !important; }
${listed.map((col) => td(col)).join(',\n')} { display: block !important; }
#${gridId} .TccGridBodyScroll td > * {
  display: inline !important;
  width: auto !important;
  max-width: none !important;
  height: auto !important;
  overflow: visible !important;
  white-space: normal !important;
  text-overflow: clip !important;
  font-size: inherit !important;
  color: inherit !important;
}
${placed}
${named}
${
  opts.auto
    ? `
#${gridId} .TccScrollOuter,
#${gridId} .TccGridBodyScroll {
  position: relative !important;
  height: auto !important;
  overflow: visible !important;
}`
    : ''
}
`;
}

/**
 * ダイアログ（EZCraft のモーダル）を、画面の端から少し離して浮かせたガラスのシートにする（iOS 26 のシートと同じ）。
 * 上に題名と ×、その下に中身。
 * bodyRows: 中身の行（R1, R2 …）の高さ。最後の行は残りの高さいっぱいにする（一覧を入れる行）。
 */
export function sheetDialog(
  formId: string,
  bodyRows: { id: string; height: number | 'rest' }[],
  opts: { scroll?: boolean } = {},
): string {
  const fixed = bodyRows.reduce((sum, r) => sum + (r.height === 'rest' ? 0 : r.height), 0);
  const rows = bodyRows
    .map(({ id, height }) => {
      const h = height === 'rest' ? `calc(100% - ${fixed}px)` : `${height}px`;
      return `#${formId}_${id} { height: ${h} !important; }
#${formId}_${id} > .tcc-tile,
#${formId}_${id} > .tcc-tile > .tcc-panel,
#${formId}_${id} > .tcc-tile > .tcc-panel > .tcc-panel-body { height: 100% !important; }`;
    })
    .join('\n');
  return `
${fullWidth(formId)}
/* ほかのシートと同じ、下から出るシート（上につまみ。下は画面の端まで） */
#${formId} {
  position: fixed !important;
  left: 0 !important;
  top: 12px !important;
  width: 100% !important;
  height: calc(100% - 12px) !important;
  margin: 0 !important; /* EZCraft はダイアログを 5px ずらして置く。そのぶん右と下が画面からはみ出す */
  border-radius: 30px 30px 0 0 !important;
}
#${formId} > .tcc-modal-content {
  width: 100% !important;
  height: 100% !important;
  border-radius: 30px 30px 0 0 !important;
  display: flex !important;
  flex-direction: column !important;
}
#${formId} > .tcc-modal-content::before { content: ''; flex: none; display: block; width: 36px; height: 5px; margin: 6px auto 0; border-radius: 3px; background: var(--myapp-border); }
#${formId} .tcc-modal-header { flex: none !important; width: 100% !important; height: 48px !important; box-sizing: border-box; display: flex !important; align-items: center; padding: 0 8px 0 20px; }
#${formId} .tcc-modal-title { font-size: 17px !important; font-weight: 600 !important; }
#${formId} .tcc-modal-footer { display: none !important; }
#${formId}_body {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  height: auto !important;
  /* 下は、ホームに戻るバー（画面の下の線）のぶん空ける。--myapp-safe-bottom はアプリが入れる */
  box-sizing: border-box !important;
  padding: 0 0 var(--myapp-safe-bottom, 0px) !important;
  overflow-x: hidden !important;
  overflow-y: ${opts.scroll ? 'auto' : 'hidden'} !important;
  -webkit-overflow-scrolling: touch;
}
/* 下に固定したボタンの帯（bottomBars）があるダイアログは、帯の中でホームに戻るバーのぶんを空ける */
#${formId} > .tcc-modal-content:has(> .myapp-bottom-bar.in-modal) > #${formId}_body { padding-bottom: 0 !important; }
#${formId} .myapp-bottom-bar.in-modal { padding-bottom: calc(10px + var(--myapp-safe-bottom, 0px)) !important; }
${rows}
`;
}

/**
 * シートの下まで一覧が続くダイアログ（プロジェクト選択・社員選択）: 一覧をシートの下の端まで伸ばす（iOS の一覧と同じ）。
 * シートの下には、ホームに戻るバーのぶんの余白（sheetDialog の padding）があり、一覧がその上で切れて、
 * 下にぼんやりした帯が残るため。代わりに、ページ送りの帯（ページが1つなら一覧の最後）を、そのぶん持ち上げる。
 */
export function listToBottom(formId: string, gridIds: string[]): string {
  const safe = 'var(--myapp-safe-bottom, 0px)';
  return `
#${formId}_body { padding-bottom: 0 !important; }
${gridIds
  .map(
    (g) => `#${formId} #${g} .TccScrollOuter { height: calc(100% - 52px - ${safe}) !important; }
#${formId} #${g}[data-myapp-onepage] .TccScrollOuter { height: 100% !important; }
#${formId} #${g}[data-myapp-onepage] .TccGridBodyScroll { padding-bottom: ${safe} !important; box-sizing: border-box !important; }
#${formId} #${g} .tcc-pager-navi { height: calc(52px + ${safe}) !important; padding-bottom: ${safe} !important; box-sizing: border-box !important; border-top: 1px solid var(--myapp-border) !important; }`,
  )
  .join('\n')}
`;
}

/** 検索して選ぶダイアログの検索欄（打つたびに検索するので、検索ボタン・OK・Cancel は出さない）。幅いっぱいに置く */
export function searchBox(formId: string, query: string): string {
  return `
${place(`${formId}_${query}`, '16px', 12, 'calc(100% - 32px)', 40)}
${fillInput(`${formId}_${query}`)}
${searchField(`#${formId}_${query}`)}
`;
}

/** 虫めがねの形（CSS の mask に使う） */
export const SEARCH_ICON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='M15.5 15.5 21 21'/%3E%3C/svg%3E")`;

/**
 * 検索欄の形を、どこでも同じにする: 灰色の面、左に虫めがね、枠なし（プロジェクトのシートの検索欄と同じ）。
 * selector は入力欄の部品（.tcc-component）。EZCraft の右の 🔍 は出さない
 */
export function searchField(selector: string): string {
  return `
${selector}::before {
  content: ''; position: absolute; left: 12px; top: 50%; z-index: 2; width: 17px; height: 17px; margin-top: -8.5px; pointer-events: none;
  background: var(--myapp-text2);
  -webkit-mask: ${SEARCH_ICON} center / contain no-repeat;
  mask: ${SEARCH_ICON} center / contain no-repeat;
}
${selector} input {
  padding-left: 38px !important; padding-right: 12px !important;
  border: none !important; border-radius: 12px !important; background: var(--myapp-segment) !important;
}
${selector} div.icon-rt { display: none !important; }
`;
}
