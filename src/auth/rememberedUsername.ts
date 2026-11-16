// 「ユーザー名を保持する」の保存先。
// ユーザー名は秘密ではないので AsyncStorage でよい。
// パスワードやトークンのような秘密は、ここではなく expo-secure-store（端末のキーチェーン）に置く。
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'login.rememberedUsername';

export async function loadRememberedUsername(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null; // 読めなくてもログインはできるので、空欄で始めるだけにする
  }
}

/** null を渡すと消す（チェックを外してログインしたとき） */
export async function saveRememberedUsername(username: string | null): Promise<void> {
  try {
    if (username) {
      await AsyncStorage.setItem(KEY, username);
    } else {
      await AsyncStorage.removeItem(KEY);
    }
  } catch {
    // 保存に失敗しても、ログインそのものは止めない
  }
}
