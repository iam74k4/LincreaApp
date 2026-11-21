// アプリの中から開いた、/runapp/ 以外のページ（ファイルの表示など）を開く。
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { EzcraftWebView } from '../../components/EzcraftWebView/EzcraftWebView';
import { SERVER_URL } from '../../core/config';
import { takeHandoff } from '../../webview/handoff';

export default function PageScreen() {
  const { path, app, data } = useLocalSearchParams<{ path: string; app?: string; data?: string }>();
  const [handoff] = useState(() => takeHandoff(data));
  const uri = `${SERVER_URL}${path.startsWith('/') ? path : `/${path}`}`;
  return <EzcraftWebView uri={uri} appId={app ?? ''} handoff={handoff} />;
}
