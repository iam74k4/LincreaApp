// 給与・賞与明細を開くときのパスワード（イントラと同じもの）を、Face ID（Touch ID）で入れる。
//
// 明細のパスワードは、ログインの「更新用の鍵」と違って、パスワードそのものしか使えない。
// そこで、パスワードを iPhone のキーチェーンに Face ID 付きで入れておく（expo-secure-store の requireAuthentication。
// ログインの Face ID と同じしくみ。src/auth/faceId.ts）:
//   - 読むときだけ、iOS が Face ID を求める（顔が合わなければ、アプリはパスワードを読めない）
//   - この端末だけ（バックアップや機種変更で、ほかの端末に移らない）
//   - Face ID に顔を登録し直すと、iOS がこのパスワードを使えなくする（読むと null）。そのときは手で入れてもらう
// 入れるのは、手で入れたパスワードで明細が開けたとき（正しいと分かったものだけ）。そのとき、使うかどうかを聞く。
// 誰のパスワードかも覚えておき、ほかの人がログインしているときは使わない。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { biometry, type Biometry } from './faceId';

/** パスワードを入れる場所（ログインの鍵とは分ける） */
const STORE = { keychainService: 'myapp.payslip' };
const PASSWORD_KEY = 'password';
/** 誰のパスワードか（ユーザー名は秘密ではないので、ふつうの保存先に） */
const USER_KEY = 'payslip.username';
/** 「使わない」を選んだ人（もう聞かない） */
const DECLINED_KEY = 'payslip.declined';
/** パスワードの長さの上限（ページから来たものなので、長すぎるものは入れない） */
export const PAYSLIP_PASSWORD_MAX = 128;

async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/** この人が Face ID で明細を開けるなら、その名前（Face ID・Touch ID など）。開けなければ null */
export async function payslipBiometry(username: string): Promise<Biometry | null> {
  if (!username || (await getItem(USER_KEY)) !== username) return null;
  return biometry();
}

/** 手で入れて明細が開けたあとに、Face ID を使うか聞いてよいなら、その名前。聞かないなら null */
export async function payslipBiometryToOffer(username: string): Promise<Biometry | null> {
  if (!username || (await getItem(USER_KEY)) === username || (await getItem(DECLINED_KEY)) === username) return null;
  return biometry();
}

/**
 * 次から Face ID で明細を開けるようにする（手で入れたパスワードで明細が開けた直後に呼ぶ）。
 * 一度 Face ID で本人か確かめてから（初めてなら、iOS の許可の画面も出る）パスワードを入れる。できたら true
 */
export async function enablePayslipFaceId(username: string, password: string, kind: Biometry): Promise<boolean> {
  if (!username || !password || password.length > PAYSLIP_PASSWORD_MAX) return false;
  const check = await LocalAuthentication.authenticateAsync({
    promptMessage: `次から ${kind} で明細を開きます`,
    cancelLabel: 'やめる',
    disableDeviceFallback: true, // パスワードも Face ID でしか読めないので、ここもパスコードでは通さない
  });
  if (!check.success) return false;
  try {
    await savePassword(password);
    await AsyncStorage.setItem(USER_KEY, username);
    await AsyncStorage.removeItem(DECLINED_KEY);
    return true;
  } catch (e) {
    console.log(`[payslip] NG 保存できませんでした: ${e instanceof Error ? e.message : String(e)}`);
    await forgetPayslipPassword();
    return false;
  }
}

/** 「使わない」を選んだ。この人には、もう聞かない */
export async function declinePayslipFaceId(username: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DECLINED_KEY, username);
  } catch {
    // 覚えられなければ、次にまた聞くだけ
  }
}

/**
 * 手で入れたパスワードで明細が開けた。Face ID を使っている同じ人なら、覚えているパスワードを入れ替える
 * （イントラのパスワードを変えたとき。Face ID は求めない）
 */
export async function renewPayslipPassword(username: string, password: string): Promise<void> {
  if (!username || !password || password.length > PAYSLIP_PASSWORD_MAX || (await getItem(USER_KEY)) !== username) return;
  try {
    await savePassword(password);
  } catch {
    await forgetPayslipPassword();
  }
}

export type PayslipPasswordRead =
  | { ok: true; password: string }
  /** cancel: やめた・顔が合わなかった / reset: 顔の登録が変わって使えない（覚えていたものは消した） / off: 使っていない */
  | { ok: false; reason: 'cancel' | 'reset' | 'off' };

/** Face ID で本人か確かめて、覚えておいたパスワードを読む */
export async function readPayslipPassword(username: string): Promise<PayslipPasswordRead> {
  if (!(await payslipBiometry(username))) return { ok: false, reason: 'off' };
  let password: string | null;
  try {
    password = await SecureStore.getItemAsync(PASSWORD_KEY, { ...STORE, requireAuthentication: true, authenticationPrompt: '明細を開きます' });
  } catch {
    return { ok: false, reason: 'cancel' }; // やめた・何度も合わなかった（iOS が Face ID を止めている）
  }
  if (!password) {
    await forgetPayslipPassword();
    return { ok: false, reason: 'reset' };
  }
  return { ok: true, password };
}

/** 覚えているパスワードを消す（Face ID で明細を開くのをやめる） */
export async function forgetPayslipPassword(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PASSWORD_KEY, STORE);
  } catch {
    // 消せなくても、誰のものかの印を消せば使われない
  }
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch {
    // 次に読んだとき、なければ印も消す（readPayslipPassword）
  }
}

/** パスワードを Face ID 付きで入れる。上書きだと iOS が Face ID を求めるので、先に消してから新しく入れる */
async function savePassword(password: string): Promise<void> {
  await SecureStore.deleteItemAsync(PASSWORD_KEY, STORE);
  await SecureStore.setItemAsync(PASSWORD_KEY, password, {
    ...STORE,
    requireAuthentication: true,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
