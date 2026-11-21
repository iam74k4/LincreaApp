// 「ログインしたまま」にするための控え。
//
// ログインの実体はサーバーのセッション Cookie で、端末の通信の仕組みが覚えている（期限はサーバーが決める）。
// アプリがここで覚えるのは「誰でログインしたか」（ユーザー名）だけ。パスワードは保存しない。
// トークンも端末には残さない（Cognito の部品の保存場所は src/auth/cognitoStorage.ts。Face ID の鍵だけは src/auth/faceId.ts が Face ID 付きで持つ）。
// 次の起動では、サーバーのログインがまだ有効か確かめてから、この控えで画面を戻す。
import AsyncStorage from '@react-native-async-storage/async-storage';

import { landedOnLogin, NetworkError, rememberCsrf, serverFetch } from '../api/http';
import { SERVER_URL } from '../config';
import { cognitoPoolOf, type CognitoPool, type Session } from './api';

const KEY = 'session.username';
/** 起動のときに待つ長さ（電波が弱いときに、くるくるのまま長く待たせない） */
const RESTORE_TIMEOUT_MS = 10_000;

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

/** 前にログインしていた人（ログアウトしていなければ）。いなければ null */
async function savedSession(): Promise<Session | null> {
  try {
    const username = await AsyncStorage.getItem(KEY);
    return username === null ? null : { username };
  } catch {
    return null;
  }
}

/**
 * 起動したときの、前のログインの様子:
 *   valid   … サーバーのログインがまだ有効（session で画面を戻す）
 *   expired … 切れている（Face ID で入り直すか、ログイン画面へ）
 *   offline … サーバーにつながらない。前にログインしていた人がいれば saved（その人の画面を出しておき、つながったら確かめる）
 */
export type Restored =
  | { status: 'valid'; session: Session }
  // pool: 確かめたときにログイン画面へ戻され、その画面から読めた Cognito の設定（Face ID で入り直すときに使う。読めなければ null）
  | { status: 'expired'; pool: CognitoPool | null }
  | { status: 'offline'; saved: Session | null };

export async function restoreSession(): Promise<Restored> {
  try {
    const res = await serverFetch(`${SERVER_URL}/main/`, { credentials: 'include' }, RESTORE_TIMEOUT_MS);
    const html = await res.text();
    if (!res.ok || landedOnLogin(res)) return { status: 'expired', pool: res.ok ? cognitoPoolOf(html) : null };
    rememberCsrf(html); // マイアプリの一覧を聞くときに使う（/main/ をもう一度読まない）
    return { status: 'valid', session: (await savedSession()) ?? { username: '' } };
  } catch (e) {
    if (e instanceof NetworkError) return { status: 'offline', saved: await savedSession() };
    return { status: 'expired', pool: null };
  }
}
