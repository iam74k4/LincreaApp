// マイアプリの上に出す近道。よく使う画面へ、アプリのメニューを飛ばして直接行く。
//
// EZCraft の画面は「開いた元の画面」からデータ（App.data。ログインした人など）を受け取って動く。
//   - メニューの App.data の控えがあれば（src/webview/appDataCache.ts）、行き先の画面を直接開く（速い）
//   - なければ、メニューの画面を裏で開き、準備ができたらメニューのボタンを順に押して、
//     開いた画面をメニューと入れ替えて出す（src/components/EzcraftWebView.tsx）。このとき控えができる
// マイアプリを開いたときに、裏でメニューを読んで控えを作っておく（src/components/AppDataPrefetch.tsx）。
// 使えるアプリ（マイアプリにあって稼働中のもの）の近道だけを出す。
import type { SymbolViewProps } from 'expo-symbols';

export type Shortcut = {
  key: string;
  /** 近道の名前と、その説明（説明は画面には出さず、読み上げのヒントに使う） */
  title: string;
  /** 「よく使う」のアイコンの下に出す短い名前（なければ title） */
  short?: string;
  subtitle: string;
  symbol: SymbolViewProps['name'];
  /** メニューの画面（アプリケーション ID とフォーム ID） */
  app: string;
  form: string;
  /** 準備ができたしるし。メニューの画面が App.data にこのデータ（ログインした人など）を読み込んだら、押し始める */
  ready: string;
  /** 順に押すボタンの部品 ID（押すたびに次の画面が開く。最後に開いた画面を出す） */
  steps: string[];
  /** 直接開くときの行き先の画面と、メニューが渡すのと同じ引数（steps の最後で開く画面） */
  direct: { form: string; params: Record<string, unknown> };
};

const TIMS = { app: 'L_Tims', form: 'frmLTiMSTop', ready: 'LOGIN_USER' };

export const SHORTCUTS: Shortcut[] = [
  {
    key: 'tims-attendance',
    title: '勤務表',
    subtitle: '毎日の登録',
    symbol: { ios: 'calendar.badge.clock', android: 'calendar_month', web: 'calendar_month' },
    ...TIMS,
    steps: ['frmLTiMSTop_btnAttendance'],
    direct: { form: 'frmAttendance', params: {} },
  },
  {
    key: 'tims-overtime',
    title: '残業申請',
    subtitle: '今日の残業を申請',
    // 勤怠 TiMS（時計と人）と見分けがつくよう、残業はタイマー
    symbol: { ios: 'timer', android: 'more_time', web: 'more_time' },
    ...TIMS,
    steps: ['frmLTiMSTop_btnApply', 'frmApply_zangyo'],
    direct: { form: 'frmApply_zangyo', params: { mode: 'new' } },
  },
  {
    key: 'tims-paid-leave',
    title: '有給休暇申請',
    short: '有給休暇',
    subtitle: '申請と残り日数',
    symbol: { ios: 'sun.max.fill', android: 'beach_access', web: 'beach_access' },
    ...TIMS,
    steps: ['frmLTiMSTop_btnApply', 'frmApply_yukyu'],
    direct: { form: 'frmApply_yukyu', params: { mode: 'new' } },
  },
  {
    key: 'tims-apply',
    title: '勤怠申請',
    subtitle: 'ほかの申請・状況',
    symbol: { ios: 'doc.text.fill', android: 'post_add', web: 'post_add' },
    ...TIMS,
    steps: ['frmLTiMSTop_btnApply'],
    direct: { form: 'frmApply', params: {} },
  },
];
