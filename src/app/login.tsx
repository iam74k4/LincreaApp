// ログイン画面のルート。中身は src/screens/LoginScreen.tsx。
// ここは「ログインできたら session に入れる」ことと、ヘルプの開き方だけを決める。
import { Alert, Linking } from 'react-native';

import { SERVER_URL } from '../config';
import { LoginScreen } from '../screens/LoginScreen';
import { useSession } from '../session/SessionContext';

/** Web 版のログイン画面（パスワードの再設定は、ここの「パスワードをお忘れの方」から） */
const WEB_LOGIN = `${SERVER_URL}/login`;

function openWebLogin() {
  Linking.openURL(WEB_LOGIN).catch(() => {});
}

export default function LoginRoute() {
  const { signIn } = useSession();
  return (
    <LoginScreen
      onLoggedIn={signIn} // session が入ると、_layout.tsx の守り役がマイアプリへ切り替える
      // パスワードの再設定は、このアプリではまだできない。何が起きるかを先に伝えてから、Safari で Web 版を開く
      onForgotPassword={() =>
        Alert.alert(
          'パスワードの再設定',
          'Safari で Web 版のログイン画面を開きます。「パスワードをお忘れの方」から再設定して、新しいパスワードでこのアプリにログインしてください。',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: 'Safari で開く', onPress: openWebLogin },
          ],
        )
      }
      onLoginHelp={() =>
        Alert.alert(
          'ログインのしかた',
          [
            'ユーザー名とパスワードは、パソコンで LINCREA（Web 版）にログインするときと同じです。',
            '初めてのログインでパスワードの変更を求められるアカウントや、多要素認証を使うアカウントは、先に Web 版で一度ログインしてください。',
            '分からないときは、社内の LINCREA の管理者にお問い合わせください。',
          ].join('\n\n'),
          [
            { text: 'Web 版を開く', onPress: openWebLogin },
            { text: 'OK', style: 'cancel' },
          ],
        )
      }
    />
  );
}
