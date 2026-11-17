// Face ID（Touch ID）でログインする。
//
// パスワードは保存しない。最初にパスワードでログインしたとき Cognito がくれる「更新用の鍵」（リフレッシュトークン）を、
// iPhone のキーチェーンに Face ID 付きで入れておく（expo-secure-store の requireAuthentication）。
//   - 読むときだけ、iOS が Face ID を求める（顔が合わなければ、アプリは鍵を読めない）
//   - Face ID に顔を登録し直すと、iOS がこの鍵を使えなくする（読むと null）。そのときはパスワードでログインし直す
//   - 鍵の期限は会社の Cognito の設定で決まる（期限が切れたら、パスワードで1回ログインすると新しい鍵になる）
// ログインし直す流れは、パスワードの代わりに鍵を使うだけで、あとは同じ（src/auth/api.ts の loginWithRefreshToken）。
//
// Expo Go には Face ID の許可の文（NSFaceIDUsageDescription）がないので、Expo Go では使わない（出さない）。
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { loginWithRefreshToken, RefreshExpiredError, type LoginResult, type Session } from './api';
import { loadRememberedUsername } from './rememberedUsername';

/** 鍵を入れる場所。Face ID なしの値とは分ける（同じ場所だと Face ID 付きがうまく動かない） */
const STORE = { keychainService: 'myapp.faceid' };
const TOKEN_KEY = 'refreshToken';
/** 誰の鍵か（ユーザー名は秘密ではないので、ふつうの保存先に） */
const USER_KEY = 'faceid.username';

/** 画面に出す生体認証の名前（iPhone は Face ID か Touch ID。Android は顔認証か指紋認証） */
export type Biometry = 'Face ID' | 'Touch ID' | '顔認証' | '指紋認証';

/**
 * この端末で使える生体認証の名前（使えない・登録していない・Expo Go なら null）。
 * 顔でも指紋でも、しくみは同じ（鍵は、登録してある顔か指紋でしか読めない）
 */
export async function biometry(): Promise<Biometry | null> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return null;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const ios = Platform.OS === 'ios';
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return ios ? 'Face ID' : '顔認証';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return ios ? 'Touch ID' : '指紋認証';
    return null;
  } catch {
    return null;
  }
}

/** Face ID でログインできるようにしてある人（していなければ null） */
export async function faceIdUser(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

/**
 * Face ID でログインできるようにする（パスワードでログインできた直後に呼ぶ）。
 * 一度 Face ID で本人か確かめてから（初めてなら、iOS の許可の画面も出る）鍵を入れる。できたら true
 */
export async function enableFaceId(username: string, refreshToken: string, kind: Biometry): Promise<boolean> {
  const check = await LocalAuthentication.authenticateAsync({
    promptMessage: `次から ${kind} でログインします`,
    cancelLabel: 'やめる',
    disableDeviceFallback: true, // 鍵も Face ID でしか読めないので、ここもパスコードでは通さない
  });
  if (!check.success) return false;
  try {
    await saveToken(refreshToken);
    await AsyncStorage.setItem(USER_KEY, username);
    return true;
  } catch (e) {
    console.log(`[faceid] NG 保存できませんでした: ${e instanceof Error ? e.message : String(e)}`);
    await disableFaceId();
    return false;
  }
}

/** Face ID でのログインをやめる（鍵を消す） */
export async function disableFaceId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY, STORE);
  } catch {
    // 消せなくても、誰の鍵かの印を消せば使われない
  }
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch {
    // 次に開いたとき、鍵がなければ印も消す（loginWithFaceId）
  }
}

/** パスワードでログインし直したとき、Face ID を使っている同じ人なら、鍵だけ新しくする（Face ID は求めない） */
export async function renewFaceIdToken(username: string, refreshToken: string): Promise<void> {
  if ((await faceIdUser()) !== username) return;
  try {
    await saveToken(refreshToken);
  } catch {
    await disableFaceId();
  }
}

export type FaceIdLogin =
  | { ok: true; session: Session }
  /**
   * off: Face ID を使っていない / cancel: やめた・顔が合わなかった /
   * reset: 顔の登録が変わって鍵が使えない / expired: 鍵の期限切れ / failed: 通信などの失敗
   */
  | { ok: false; reason: 'off' | 'cancel' | 'reset' | 'expired' | 'failed'; message?: string };

/** Face ID で本人か確かめて、保存しておいた鍵でログインし直す */
export async function loginWithFaceId(): Promise<FaceIdLogin> {
  const username = await faceIdUser();
  if (!username || !(await biometry())) return { ok: false, reason: 'off' };

  let token: string | null;
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY, { ...STORE, requireAuthentication: true, authenticationPrompt: 'ログインします' });
  } catch {
    return { ok: false, reason: 'cancel' }; // やめた・何度も合わなかった（iOS が Face ID を止めている）
  }
  if (!token) {
    await disableFaceId();
    return { ok: false, reason: 'reset', message: 'Face ID の登録が変わったので、パスワードでログインしてください。' };
  }

  let result: LoginResult;
  try {
    const remember = (await loadRememberedUsername()) !== null;
    result = await loginWithRefreshToken(username, token, remember);
  } catch (e) {
    if (e instanceof RefreshExpiredError) {
      await disableFaceId();
      return { ok: false, reason: 'expired', message: e.message };
    }
    console.log(`[faceid] NG ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, reason: 'failed', message: '通信できませんでした。電波のよい所でもう一度お試しください。' };
  }
  // 鍵が新しくなっていたら（Cognito の設定による）、新しいほうに入れ替える
  if (result.refreshToken && result.refreshToken !== token) {
    try {
      await saveToken(result.refreshToken);
    } catch {
      // 入れ替えられなくても、古い鍵が期限まで使える
    }
  }
  return { ok: true, session: result.session };
}

/** 鍵を Face ID 付きで入れる。上書きだと iOS が Face ID を求めるので、先に消してから新しく入れる */
async function saveToken(token: string): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY, STORE);
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    ...STORE,
    requireAuthentication: true,
    // この端末だけ（バックアップや機種変更で、ほかの端末に移らない）。
    // Face ID の登録を消す・パスコードを外すと、Face ID 付きの鍵は iOS が使えなくする
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
