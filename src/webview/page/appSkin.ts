// アプリごとの見た目の調整の形（中身は appStyles.ts の APP_SKINS と、勤怠 TiMS の timsSkin.ts）。
// 形だけを別にしておくのは、appStyles.ts が timsSkin.ts を読み込み、timsSkin.ts もこの形を使うため
// （同じファイルに置くと、2つのファイルが互いを読み込み合う）。役割（primary・cards など）の意味は appStyles.ts の先頭に書いた。

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
