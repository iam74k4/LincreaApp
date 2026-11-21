// アイコンの置き場。画面や一覧のデータは「close」「share」のような意味の名前だけを持ち、端末ごとの名前はここにだけ書く。
//
// iPhone は SF Symbols、Android・Web は Material Symbols で、同じ意味でも名前が違う（expo-symbols がそれぞれの端末で描く）。
// 名前の対応を、使う場所ごとに { ios, android, web } と書き散らすと、端末の数だけ直す場所が増えて、
// 片方だけ直し忘れる（Android の名前を綴り違いのまま出す、など）。ここ1か所なら、型が両方の名前の正しさを見張る。
import { SymbolView, type AndroidSymbol, type SFSymbol, type SymbolViewProps } from 'expo-symbols';

type Glyph = { ios: SFSymbol; android: AndroidSymbol };

const GLYPHS = {
  // 操作
  close: { ios: 'xmark', android: 'close' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  'sign-out': { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  back: { ios: 'chevron.backward', android: 'arrow_back' },
  'chevron-forward': { ios: 'chevron.right', android: 'chevron_right' },
  eye: { ios: 'eye', android: 'visibility' },
  'eye-off': { ios: 'eye.slash', android: 'visibility_off' },
  // 生体認証（Face ID と顔認証、Touch ID と指紋認証は、端末の名前が違うだけで同じ意味）
  face: { ios: 'faceid', android: 'face' },
  fingerprint: { ios: 'touchid', android: 'fingerprint' },
  // 状態
  'error-filled': { ios: 'exclamationmark.circle.fill', android: 'error' },
  'check-filled': { ios: 'checkmark.circle.fill', android: 'check_circle' },
  offline: { ios: 'wifi.slash', android: 'wifi_off' },
  'server-error': { ios: 'exclamationmark.icloud', android: 'cloud_off' },
  // アプリ（Web 版が FontAwesome の名前で指定してくるもの。src/components/AppIcon.tsx）
  app: { ios: 'app.fill', android: 'apps' },
  desktop: { ios: 'desktopcomputer', android: 'desktop_windows' },
  walk: { ios: 'figure.walk', android: 'directions_walk' },
  // 知っているアプリ（src/myApps/knownApps.ts）と近道（src/shortcuts/shortcuts.ts）
  'clock-person': { ios: 'person.badge.clock.fill', android: 'schedule' },
  yen: { ios: 'yensign.circle.fill', android: 'currency_yen' },
  bank: { ios: 'building.columns.fill', android: 'description' },
  heart: { ios: 'heart.fill', android: 'favorite' },
  graduation: { ios: 'graduationcap.fill', android: 'school' },
  'calendar-clock': { ios: 'calendar.badge.clock', android: 'calendar_month' },
  timer: { ios: 'timer', android: 'more_time' },
  'sun-beach': { ios: 'sun.max.fill', android: 'beach_access' },
  'document-add': { ios: 'doc.text.fill', android: 'post_add' },
} as const satisfies Record<string, Glyph>;

/** アイコンの名前（意味の名前。端末ごとの名前ではない） */
export type IconName = keyof typeof GLYPHS;

/** 名前の一覧（テストで、全部の対応を確かめるため） */
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

/** その端末で描くときの名前（Web は Android と同じ Material Symbols） */
export function symbolName(name: IconName): SymbolViewProps['name'] {
  const glyph: Glyph = GLYPHS[name];
  return { ios: glyph.ios, android: glyph.android, web: glyph.android };
}

type IconProps = Omit<SymbolViewProps, 'name'> & { name: IconName };

/** アイコン。大きさ・太さ・色は SymbolView と同じ */
export function Icon({ name, ...rest }: IconProps) {
  return <SymbolView name={symbolName(name)} {...rest} />;
}
