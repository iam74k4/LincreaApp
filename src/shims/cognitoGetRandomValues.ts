// amazon-cognito-identity-js の utils/getRandomValues.native.js の代わり（metro.config.js で差し替える）。
// 元のファイルは、Expo Go（新しいアーキテクチャ）では開発中は Math.random を使い、本番ではエラーになる。
// ログインの安全さは乱数に頼っているので、端末の安全な乱数（expo-crypto）を使う。
import { getRandomValues } from 'expo-crypto';

type IntArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Uint8ClampedArray;

export default function cognitoGetRandomValues<T extends IntArray>(array: T): T {
  return getRandomValues(array);
}
