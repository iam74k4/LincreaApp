// 給与明細などを見ているとき、アプリの切り替え画面（最近使ったアプリの一覧）に、画面の中身を写さない。
//
// iPhone: 切り替え画面のときだけ、画面にぼかしをかける（expo-screen-capture の enableAppSwitcherProtectionAsync。
//         ふだんの画面やスクリーンショットは変わらない）。ぼかしはアプリ全体で1つなので、使っている画面の数を数え、
//         最後の1つが外れたときにだけ外す（見せたくない画面から、見せたくない画面へ移るとき、外す・付けるの順は決まっていない）。
// Android: 切り替え画面を白くする仕組み（FLAG_SECURE。preventScreenCaptureAsync）は、スクリーンショットも止める。
//          こちらは名前（key）ごとに数えてくれる。
// どちらも、見せたくない画面にいるあいだだけ使う（src/components/usePrivacyScreen.ts）。
import { Platform } from 'react-native';
import {
  allowScreenCaptureAsync,
  disableAppSwitcherProtectionAsync,
  enableAppSwitcherProtectionAsync,
  preventScreenCaptureAsync,
} from 'expo-screen-capture';

/** iPhone のぼかしの強さ（0〜1）。文字が読めない強さ */
const BLUR = 0.9;

/** iPhone: いまぼかしを使っている画面の数 */
let blurUsers = 0;

/** 写さないようにする。返した関数を呼ぶと戻す（何度呼んでもよい）。key は、使っている画面の名前 */
export function hideFromAppSwitcher(key: string): () => void {
  let restored = false;
  if (Platform.OS === 'ios') {
    blurUsers += 1;
    if (blurUsers === 1) enableAppSwitcherProtectionAsync(BLUR).catch(() => {});
    return () => {
      if (restored) return;
      restored = true;
      blurUsers = Math.max(0, blurUsers - 1);
      if (blurUsers === 0) disableAppSwitcherProtectionAsync().catch(() => {});
    };
  }
  preventScreenCaptureAsync(key).catch(() => {});
  return () => {
    if (restored) return;
    restored = true;
    allowScreenCaptureAsync(key).catch(() => {});
  };
}
