// 審査用のデモ（App Store の TestFlight 外部テストの審査で、Apple の人に中を見てもらうため）。
//
// 会社の EZCraft には、審査用のアカウントを作れない（作れても、保存が本物の勤怠のデータに書き込む）。
// そこで、決まったユーザー名とパスワード（App Store Connect の「ベータ版 App Review 情報」に書く）でログインしたら、
// サーバーには一切つながずに、見本のデータで画面を見せる（src/demo/）。
//
// リポジトリは公開なので、このパスワードは誰でも分かる。入れるのは見本のデータだけで、会社のサーバーにもトークンにも触れない
// （デモのあいだは、ログイン・一覧・ページの読み込みのどれも、サーバーに問い合わせない）。
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Session } from '../auth/login';

/** 審査の人に渡すユーザー名とパスワード（docs/distribution.md の「外部テストの審査」） */
export const DEMO_USERNAME = 'appreview';
export const DEMO_PASSWORD = 'LincreaDemo2026';

/** デモで出す名前（ページの「ログインしている人」） */
export const DEMO_PERSON = 'デモ 太郎';

export const DEMO_SESSION: Session = { username: DEMO_USERNAME, demo: true };

/** ログイン画面で入れたものが、デモのユーザー名とパスワードか（ユーザー名の大文字・小文字と前後の空白は問わない） */
export function isDemoCredentials(username: string, password: string): boolean {
  return username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD;
}

export function isDemoSession(session: Session | null | undefined): boolean {
  return session?.demo === true;
}

const KEY = 'demo.active';

/** デモでログインしたことを覚える / 忘れる（次の起動でも、サーバーに確かめずにデモのまま始めるため） */
export async function rememberDemo(active: boolean): Promise<void> {
  try {
    if (active) await AsyncStorage.setItem(KEY, '1');
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // 覚えられなくても、次の起動でログインし直すだけ
  }
}

/** 前の起動で、デモのままだったか */
export async function wasDemo(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}
