// ページが、ほかのサイトを開こうとした（リンク・window.open）。アプリの外（ブラウザ）で開く前に、開いてよいか聞く。
// ページは、押されなくても（読み込んだだけで）ほかのサイトへ移ろうとすることがあり、聞かずに開くと、
// 使う人が知らないうちにアプリの外へ出される（偽のログイン画面などへ連れて行かれる）おそれがあるため。
// 開くのは https のページだけ（電話・ほかのアプリなどのリンクは開かない。src/webview/origin.ts の mayOpenOutside）。
import { Alert, Linking } from 'react-native';

import { mayOpenOutside } from '../../webview/origin';

/** 聞いているあいだに続けて頼まれても、聞くのは1つずつ（ダイアログを重ねない） */
let asking = false;
/** 聞いたまま答えが来なくても、これだけたったら、次は聞けるようにする */
const ASK_TIMEOUT_MS = 30_000;

export function confirmOpenOutside(url: string): void {
  if (asking || !mayOpenOutside(url)) return;
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    // mayOpenOutside が通ったので読めるはず。読めなければ URL のまま見せる
  }
  asking = true;
  // どのボタンも押されず、閉じた知らせも来ない（Android の戻るボタンなど）ときでも、少しすれば次を聞けるようにする
  const unstick = setTimeout(() => {
    asking = false;
  }, ASK_TIMEOUT_MS);
  const done = () => {
    clearTimeout(unstick);
    asking = false;
  };
  Alert.alert(
    'ほかのサイトを開きます',
    `${host} を、アプリの外（ブラウザ）で開きます。`,
    [
      { text: 'やめる', style: 'cancel', onPress: done },
      {
        text: '開く',
        onPress: () => {
          done();
          Linking.openURL(url).catch(() => {});
        },
      },
    ],
    { cancelable: true, onDismiss: done },
  );
}
