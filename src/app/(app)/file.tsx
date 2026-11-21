// ページから受け取った PDF を見る画面のルート。中身は src/screens/FileScreen.tsx。
import { useLocalSearchParams } from 'expo-router';

import { FileScreen } from '../../screens/FileScreen';

export default function FileRoute() {
  const { uri, title, mime } = useLocalSearchParams<{ uri: string; title?: string; mime?: string }>();
  return <FileScreen uri={uri} title={title} mime={mime} />;
}
