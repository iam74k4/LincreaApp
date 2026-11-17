// 「ログインしたまま」にするための控え。
//
// ログインの実体はサーバーのセッション Cookie で、端末の通信の仕組みが覚えている（期限はサーバーが決める）。
// アプリがここで覚えるのは「誰でログインしたか」（ユーザー名）だけ。パスワードは保存しない。
// トークンも端末には残さない（Cognito の部品の保存場所は src/auth/cognitoStorage.ts。Face ID の鍵だけは src/auth/faceId.ts が Face ID 付きで持つ）。
// 次の起動では、サーバーのログインがまだ有効か確かめてから、この控えで画面を戻す。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch } from 'expo/fetch';

import { landedOnLogin } from '../api/http';
import { SERVER_URL } from '../config';
import type { Session } from './api';

const KEY = 'session.username';

export async function saveSession(session: Session): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, session.username);
  } catch {
    // 保存できなくても、次の起動でログインし直すだけ
  }
}

export async function clearSavedSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // 消せなくても、サーバー側のログインが切れていれば戻されない
  }
}

/** サーバーのログインがまだ有効なら、そのセッションを返す。切れていれば null */
export async function restoreSession(): Promise<Session | null> {
  try {
    const res = await fetch(`${SERVER_URL}/main/`, { credentials: 'include' });
    await res.text();
    if (!res.ok || landedOnLogin(res)) return null;
    const username = (await AsyncStorage.getItem(KEY)) ?? '';
    return { username };
  } catch {
    return null; // 通信できないときは、ログイン画面から
  }
}
