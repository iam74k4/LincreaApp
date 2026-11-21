// 色と寸法は1か所にまとめる。画面のコードには色を直接書かない。
//
// ライトとダークの2組を用意し、端末の設定（システム標準）に合わせて切り替える。
// 画面では useColors() で、いまの組を受け取る。
//
// 見た目は iOS 26（Liquid Glass）に合わせる: 灰色の地に白いカード（ダークは黒い地に濃い灰色のカード）。
// 浮かせる操作の部品（ボタン・下のバー）だけをガラスにし、一覧や入力欄はガラスにしない（読みやすさのため）。
// WebView の中の EZCraft の画面も、同じ色を使う（src/webview/page/ezcraftSkin.ts の --myapp-*）。
import { useColorScheme } from 'react-native';

export type Colors = {
  /** 画面の地（ライトは薄い灰色。その上に白いカードを置く） */
  background: string;
  /** カード（一覧・近道など、地の上に置く面） */
  card: string;
  /** 入力欄など、地から少し浮かせる面 */
  fill: string;
  /** カードの中で押しているあいだの色 */
  pressed: string;
  text: string;
  /** 補足の文字（説明・日付など） */
  textSecondary: string;
  separator: string;
  /** 上の時刻・電池などの文字の色（dark = 黒い文字） */
  statusBar: 'dark' | 'light';
  /** 押せるもの（ボタン・リンク・スイッチ）の色 */
  accent: string;
  /**
   * スイッチの「切」の地の色。undefined は端末の決まりの色。
   * ダークでは、Android の決まりの色が黒い地に溶けて見えないので、iPhone の決まりの色（#39393D）にそろえる
   */
  switchOff: string | undefined;
  onAccent: string;
  /** マイアプリのアイコン: 薄い青の地（iconTile）に、青い線の絵（iconGlyph）。どのアプリも同じ2色でそろえる */
  iconTile: string;
  iconGlyph: string;
  danger: string;
  /** 状態のしるし（文字色 / 地の色） */
  available: { text: string; background: string };
  stopped: { text: string; background: string };
  developing: { text: string; background: string };
};

const light: Colors = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  fill: '#FFFFFF',
  pressed: '#E5E5EA',
  statusBar: 'dark',
  text: '#111114',
  textSecondary: '#6E6E73',
  separator: '#E3E3E8',
  accent: '#007AFF',
  switchOff: undefined,
  onAccent: '#FFFFFF',
  iconTile: 'rgba(0, 122, 255, 0.12)',
  iconGlyph: '#007AFF',
  danger: '#D92D20',
  available: { text: '#1E7B34', background: '#E3F5E7' },
  stopped: { text: '#B42318', background: '#FDE7E5' },
  developing: { text: '#8A5A00', background: '#FFF1D6' },
};

const dark: Colors = {
  background: '#000000',
  card: '#1C1C1E',
  fill: '#1C1C1E',
  pressed: '#2C2C2E',
  statusBar: 'light',
  text: '#F5F5F7',
  textSecondary: '#98989F',
  separator: '#2C2C2E',
  accent: '#0A84FF',
  switchOff: '#39393D',
  onAccent: '#FFFFFF',
  iconTile: 'rgba(10, 132, 255, 0.18)',
  iconGlyph: '#409CFF',
  danger: '#FF6B5E',
  available: { text: '#7EE2A0', background: '#123620' },
  stopped: { text: '#FF9C94', background: '#3D1714' },
  developing: { text: '#F5C46B', background: '#3A2A09' },
};

/** 端末がダークモードならダークの色、そうでなければライトの色を返す */
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const sizes = {
  /** 入力欄・ボタンの高さ（指で押しやすい 44pt 以上） */
  control: 50,
  /** 入力欄の角 */
  radius: 14,
  /** カードの角（iOS 26 は角が大きい） */
  cardRadius: 22,
  /** ログイン画面の幅の上限（タブレットや横向きで伸びすぎないように） */
  formWidth: 360,
};
