// Face ID（Touch ID）でログインする。
//
// パスワードは保存しない。最初にパスワードでログインしたとき Cognito がくれる「更新用の鍵」（リフレッシュトークン）を、
// iPhone のキーチェーンに Face ID 付きで入れておく（expo-secure-store の requireAuthentication）。
//   - 読むときだけ、iOS が Face ID を求める（顔が合わなければ、アプリは鍵を読めない）
//   - Face ID に顔を登録し直すと、iOS がこの鍵を使えなくする（読むと null）。そのときはパスワードでログインし直す
//   - 鍵の期限は会社の Cognito の設定で決まる（期限が切れたら、パスワードで1回ログインすると新しい鍵になる）
// ログインし直す流れは、パスワードの代わりに鍵を使うだけで、あとは同じ（src/auth/login.ts の loginWithRefreshToken）。
//
// Expo Go には Face ID の許可の文（NSFaceIDUsageDescription）がないので、Expo Go では使わない（出さない）。
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { NetworkError } from '../api/http';
import { loginWithRefreshToken, RefreshExpiredError, type CognitoPool, type LoginResult, type Session } from './login';
import { loadRememberedUsername } from './rememberedUsername';

/** 鍵を入れる場所。Face ID なしの値とは分ける（同じ場所だと Face ID 付きがうまく動かない） */
const STORE = { keychainService: 'myapp.faceid' };
const TOKEN_KEY = 'refreshToken';
/** 誰の鍵か（ユーザー名は秘密ではないので、ふつうの保存先に） */
const USER_KEY = 'faceid.username';

/**
 * 画面に出す生体認証の名前（iPhone は Face ID か Touch ID。Android は顔認証か指紋認証。
 * Android で顔と指紋の両方があるときは「生体認証」: Android は登録の有無を種類ごとには教えず、
 * 鍵を入れる側は強いものだけを受け付けるので、どちらが使えるかを言い切れない）
 */
export type Biometry = 'Face ID' | 'Touch ID' | '顔認証' | '指紋認証' | '生体認証';

/**
 * この端末で使える生体認証の名前（使えない・登録していない・Expo Go なら null）。
 * 顔でも指紋でも、しくみは同じ（鍵は、登録してある顔か指紋でしか読めない）
 */
export async function biometry(): Promise<Biometry | null> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return null;
    // Android: 強い生体認証（指紋・3D の顔）が登録してあること。鍵を入れる expo-secure-store は、強いものでないと鍵を作れない。
    // 弱い顔認証（カメラの2D）だけの端末に、使えないスイッチを出さないため。
    // iPhone では確かめない（Face ID・Touch ID は強い生体認証だが、試行を重ねてロックされている間は、登録してあっても
    // getEnrolledLevelAsync の値が下がり、使えるのに隠れてしまう）
    if (Platform.OS === 'android' && (await LocalAuthentication.getEnrolledLevelAsync()) < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
      return null;
    }
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    if (Platform.OS === 'ios') return face ? 'Face ID' : finger ? 'Touch ID' : null;
    // Android は、部品（ハードウェア）があるかを教えるだけで、どちらを登録しているかは教えない
    if (face && finger) return '生体認証';
    return face ? '顔認証' : finger ? '指紋認証' : null;
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
  const prompt = `次から ${kind} でログインします`;
  // 入れるときに端末が確かめる（Android）なら、その確かめだけにする（同じ確かめを2回続けて出さない）
  if (!saveAsksBiometrics()) {
    const check = await LocalAuthentication.authenticateAsync(biometricCheckOptions(prompt));
    if (!check.success) return false;
  }
  let saved = false;
  try {
    await saveToken(refreshToken, prompt);
    saved = true;
    await AsyncStorage.setItem(USER_KEY, username);
    return true;
  } catch (e) {
    console.log(`[faceid] NG 保存できませんでした: ${e instanceof Error ? e.message : String(e)}`);
    // iPhone は前の鍵を消してから入れるので、どこで失敗しても使えなくする。
    // Android は、確かめの画面でやめると何も入れずに終わり、前の人の鍵がそのまま残っている（消すと、その人が使えなくなる）。
    // 鍵は入れたのに誰の鍵かを書けなかったときだけ、食い違わないように消す
    if (saved || !saveAsksBiometrics()) await disableFaceId();
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

/**
 * パスワードでログインし直したとき、Face ID を使っている同じ人なら、鍵だけ新しくする
 * （iPhone は Face ID を求めない。Android は入れるときに確かめの画面が出る。saveAsksBiometrics）
 */
export async function renewFaceIdToken(username: string, refreshToken: string): Promise<void> {
  if ((await faceIdUser()) !== username) return;
  try {
    await saveToken(refreshToken, RENEW_PROMPT);
  } catch {
    // iPhone は前の鍵を消してから入れるので、入れられなければ使えない。
    // Android は上書きなので、確かめの画面でやめても前の鍵が残っている（期限まで、そのまま使える）
    if (!saveAsksBiometrics()) await disableFaceId();
  }
}

export type FaceIdLogin =
  | { ok: true; session: Session }
  /**
   * off: Face ID を使っていない（・別の人の鍵） / cancel: やめた・顔が合わなかった /
   * reset: 顔の登録が変わって鍵が使えない / expired: 鍵の期限切れ / offline: つながらない・返事がない /
   * failed: それ以外の失敗（サーバーが断った・ログイン画面が読めないなど）
   */
  | { ok: false; reason: 'off' | 'cancel' | 'reset' | 'expired' | 'offline' | 'failed'; message?: string };

/** Face ID で本人か確かめて、保存しておいた鍵でログインし直す */
export async function loginWithFaceId(knownPool: CognitoPool | null = null, expectedUser: string | null = null): Promise<FaceIdLogin> {
  const username = await faceIdUser();
  // expectedUser（画面に出ている人・前にログインしていた人）があれば、その人の鍵でだけ入る。
  // 別の人の鍵で入ると、画面の人とサーバーにログインした人が食い違う（ほかの人のデータを、その人として扱ってしまう）
  if (expectedUser !== null && username !== expectedUser) return { ok: false, reason: 'off' };
  const kind = username ? await biometry() : null;
  if (!username || !kind) return { ok: false, reason: 'off' };

  let token: string | null;
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY, { ...STORE, requireAuthentication: true, authenticationPrompt: 'ログインします' });
  } catch {
    return { ok: false, reason: 'cancel' }; // やめた・何度も合わなかった（iOS が Face ID を止めている）
  }
  if (!token) {
    await disableFaceId();
    return { ok: false, reason: 'reset', message: `${kind} の登録が変わったので、パスワードでログインしてください。` };
  }

  let result: LoginResult;
  try {
    const remember = (await loadRememberedUsername()) !== null;
    result = await loginWithRefreshToken(username, token, remember, knownPool);
  } catch (e) {
    if (e instanceof RefreshExpiredError) {
      await disableFaceId();
      return { ok: false, reason: 'expired', message: `${kind} でのログインの期限が切れました。パスワードでログインしてください。` };
    }
    console.log(`[faceid] NG ${e instanceof Error ? e.message : String(e)}`);
    // つながらなかった・返事がなかっただけ（ログインのまま、あとでもう一度）と、それ以外（サーバーが断った・ログイン画面が読めない
    // など。使えなくなった人を、つながらないことにしてログインのまま残さない）を分ける
    if (e instanceof NetworkError) {
      return { ok: false, reason: 'offline', message: '通信できませんでした。電波のよい所でもう一度お試しください。' };
    }
    return { ok: false, reason: 'failed', message: 'ログインし直せませんでした。パスワードでログインしてください。' };
  }
  // 鍵が新しくなっていたら（Cognito の設定による）、新しいほうに入れ替える
  if (result.refreshToken && result.refreshToken !== token) {
    try {
      await saveToken(result.refreshToken, RENEW_PROMPT);
    } catch {
      // 入れ替えられなくても、古い鍵が期限まで使える
    }
  }
  return { ok: true, session: result.session };
}

/** 鍵を入れ替えるときの、確かめの画面の説明（入れるときに確かめる端末だけ。saveAsksBiometrics） */
const RENEW_PROMPT = 'ログインの鍵を新しくします';

/**
 * 生体認証付きの値を「入れる」ときにも、端末が生体認証を求めるか。
 * Android の expo-secure-store は、入れるたびに確かめの画面を出す（iPhone は読むときだけで、入れるときは求めない）
 */
export function saveAsksBiometrics(): boolean {
  return Platform.OS === 'android';
}

/**
 * 生体認証付きで入れる前に、本人か確かめるときの決まり（鍵・明細のパスワードで同じ）。prompt は、確かめの画面に出す説明。
 *   - 入れたものも生体認証でしか読めないので、ここもパスコードでは通さない（disableDeviceFallback）
 *   - 合わなかったときに iOS が出す「パスワードを入力」のボタンも出さない（fallbackLabel を空に）。
 *     Touch ID は指が1回合わないとこのボタンを出すが、パスコードでは通さないので、押しても何も起きずに終わってしまう
 */
export function biometricCheckOptions(prompt: string): LocalAuthentication.LocalAuthenticationOptions {
  return { promptMessage: prompt, cancelLabel: 'やめる', disableDeviceFallback: true, fallbackLabel: '' };
}

/** 生体認証付きで入れる値の決まり（鍵・明細のパスワードで同じ）。prompt は、入れるときに確かめる端末で出す説明 */
export function biometricStoreOptions(prompt: string): SecureStore.SecureStoreOptions {
  return {
    requireAuthentication: true,
    // この端末だけ（バックアップや機種変更で、ほかの端末に移らない）。
    // Face ID の登録を消す・パスコードを外すと、Face ID 付きの鍵は iOS が使えなくする
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    ...(saveAsksBiometrics() ? { authenticationPrompt: prompt } : {}),
  };
}

/**
 * 鍵を Face ID 付きで入れる。
 * iPhone: 上書きだと iOS が Face ID を求めるので、先に消してから新しく入れる。
 * Android: 入れるときに確かめの画面が出る。先に消すと、そこでやめたときに前の鍵までなくなるので、消さずに上書きする
 */
async function saveToken(token: string, prompt: string): Promise<void> {
  if (!saveAsksBiometrics()) await SecureStore.deleteItemAsync(TOKEN_KEY, STORE);
  await SecureStore.setItemAsync(TOKEN_KEY, token, { ...STORE, ...biometricStoreOptions(prompt) });
}
