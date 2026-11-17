// ログイン画面のルート。中身は src/screens/LoginScreen.tsx。
// ここは「ログインできたら session に入れる」ことと、ヘルプの開き方だけを決める。
import { Alert, Linking } from 'react-native';

import { SERVER_URL } from '../config';
import { LoginScreen } from '../screens/LoginScreen';
import { useSession } from '../session/SessionContext';

export default function LoginRoute() {
  const { signIn } = useSession();
  return (
    <LoginScreen
      onLoggedIn={signIn} // session が入ると、_layout.tsx の守り役がマイアプリへ切り替える
      onForgotPassword={() => Linking.openURL(`${SERVER_URL}/login`)}
      onLoginHelp={() => Alert.alert('ログインのヘルプ', 'ここでヘルプを開く')}
    />
  );
}
