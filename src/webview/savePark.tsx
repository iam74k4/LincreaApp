// 保存中のページの置き場（画面の後ろ）。保存の途中で戻っても、保存を裏で最後まで続けるために使う（src/webview/backgroundSaves.ts）。
//
// iPhone の実機では、ウインドウから外れた WebView のページを iOS が止める。画面を移ると、前の画面のページは
// ウインドウから外れるので、保存の途中で戻ったページは止まって、保存が切れていた（2026-11-18）。
// 一方、画面の組（Stack）の後ろに置いたページは、ほかの画面を見ているあいだも止まらなかった
// （2026-11-18 の実機の試し: 約 70 秒、時計も通信も止まらずに進んだ。同じとき、画面の中に置いたページは止まった）。
//
// そこで、保存の途中で戻ったら、そのページを読み込み直さずに、画面の後ろの置き場へ移す（react-native-teleport）。
//   - 置き場（SavePark）は、画面の組より前に置く（あとに置いた画面の組が、上に重なって隠す）。押せず、読み上げもしない
//   - ページ（Parkable の中身）は、parked のあいだ置き場へ移る。移っても読み込み直さず、保存の通信はそのまま続く
//
// ページを移す部品はネイティブのコードなので、Expo Go には入っていない。Expo Go では置き場を使わず、
// 今までどおり、保存が終わってから戻る（CAN_PARK）。Android は確かめていないので、まだ使わない。
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { Portal, PortalHost, PortalProvider } from 'react-native-teleport';

/** 保存中のページを、置き場へ移せるか（ページを移す部品が入っている iOS のアプリだけ） */
export const CAN_PARK = Platform.OS === 'ios' && !isRunningInExpoGo();

const HOST = 'myapp-save-park';

/** 置き場とページをつなぐ。置き場とページを両方含むところ（ログイン後の画面の組の外側）に置く */
export function SaveParkProvider({ children }: { children: ReactNode }) {
  return CAN_PARK ? <PortalProvider>{children}</PortalProvider> : children;
}

/** 置き場。画面の組（Stack）より前に置く */
export function SavePark() {
  if (!CAN_PARK) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <PortalHost name={HOST} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** 中身（ページ）を、parked のあいだ置き場へ移す。置き場を使えないときは、中身をそのまま出す */
export function Parkable({ parked, style, children }: { parked: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (!CAN_PARK) return children;
  return (
    <Portal hostName={parked ? HOST : undefined} style={style}>
      {children}
    </Portal>
  );
}
