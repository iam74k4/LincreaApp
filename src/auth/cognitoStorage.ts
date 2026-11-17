// Cognito の部品（amazon-cognito-identity-js）が使う保存場所。
//
// 部品のふつうの保存場所は、React Native では AsyncStorage（暗号化しない）で、ログインのトークン
// （ID・アクセス・更新用の鍵）まで書いてしまう。そこで、部品にはこの保存場所を渡す（src/auth/api.ts）:
//   - トークンは、メモリの中だけに置く（端末には残さない）。Face ID の鍵は src/auth/faceId.ts が Face ID 付きで別に持つ
//   - 「この端末を覚える」ための登録（deviceKey など）と、最後にログインした人の名前だけは、キーチェーンに残す
//     （会社の Cognito が端末を覚える設定なので、次のログインと、Face ID でのログインし直しに要る。これだけではログインできない）
// 部品は同期で読み書きするので、使う前に loadCognitoStorage() でキーチェーンから読み込んでおく。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { ICognitoStorage } from 'amazon-cognito-identity-js';

/** 端末に残すもの（キーの終わりで見分ける。ほかはトークンなので残さない） */
const KEEP = /\.(LastAuthUser|deviceKey|deviceGroupKey|randomPasswordKey)$/;
const STORE_KEY = 'cognitoDevice';
const STORE = { keychainService: 'myapp.cognito' };
/** 前の版で、部品のふつうの保存場所が AsyncStorage に書いたものの頭 */
const LEGACY_PREFIX = '@MemoryStorage:';

const memory = new Map<string, string>();
let loading: Promise<void> | null = null;

function persist(): void {
  const kept = Object.fromEntries([...memory].filter(([key]) => KEEP.test(key)));
  SecureStore.setItemAsync(STORE_KEY, JSON.stringify(kept), STORE).catch(() => {
    // 残せなくても、次のログインで Cognito が端末を新しく覚えるだけ
  });
}

export const cognitoStorage: ICognitoStorage = {
  setItem(key, value) {
    memory.set(key, value);
    if (KEEP.test(key)) persist();
  },
  getItem(key) {
    return memory.get(key) ?? null;
  },
  removeItem(key) {
    memory.delete(key);
    if (KEEP.test(key)) persist();
  },
  clear() {
    memory.clear();
  },
};

/**
 * キーチェーンに残した端末の登録を読み込む（1回だけ）。
 * あわせて、前の版が AsyncStorage に書いたものは、端末の登録だけ引き継いで、トークンごと消す
 */
export function loadCognitoStorage(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORE_KEY, STORE);
        if (saved) {
          for (const [key, value] of Object.entries(JSON.parse(saved) as Record<string, unknown>)) {
            if (typeof value === 'string' && KEEP.test(key) && !memory.has(key)) memory.set(key, value);
          }
        }
      } catch {
        // 読めなければ、Cognito が端末を新しく覚えるだけ
      }
      try {
        const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(LEGACY_PREFIX));
        if (keys.length > 0) {
          let moved = false;
          for (const [stored, value] of await AsyncStorage.multiGet(keys)) {
            const key = stored.slice(LEGACY_PREFIX.length);
            if (value && KEEP.test(key) && !memory.has(key)) {
              memory.set(key, value);
              moved = true;
            }
          }
          if (moved) persist();
          await AsyncStorage.multiRemove(keys);
        }
      } catch {
        // 消せなければ、次に開いたときにもう一度
        loading = null;
      }
    })();
  }
  return loading;
}

/** ログアウトしたとき: メモリのトークンを消す（端末の登録は残す） */
export function forgetCognitoTokens(): void {
  for (const key of [...memory.keys()]) {
    if (!KEEP.test(key)) memory.delete(key);
  }
}
