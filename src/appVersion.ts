// 画面に出す版の名前。問い合わせのときに、どの版（どの直し）で動いているかを見分けるため。
//
//   v1.0.0 · preview · 11/19 14:05 更新（a1b2c3d4）   … EAS で送った直し（eas update）で動いている
//   v1.0.0 · preview · 組み込み                       … 配った版に入っていた中身のまま（まだ直しを受け取っていない）
//   v1.0.0 · 開発                                     … Expo Go・開発ビルド（Metro から読み込んでいる）
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export function versionLabel(): string {
  const parts = [`v${Constants.expoConfig?.version ?? '?'}`];
  if (!Updates.isEnabled) return [...parts, '開発'].join(' · ');
  if (Updates.channel) parts.push(Updates.channel);
  if (Updates.isEmbeddedLaunch || !Updates.updateId) {
    parts.push('組み込み');
  } else {
    const at = Updates.createdAt;
    const two = (n: number) => String(n).padStart(2, '0');
    const when = at ? `${at.getMonth() + 1}/${at.getDate()} ${two(at.getHours())}:${two(at.getMinutes())} ` : '';
    parts.push(`${when}更新（${Updates.updateId.slice(0, 8)}）`);
  }
  // 起動のときに直しが読めず、組み込みの中身で動いている（まずい直しを送ったときなど）
  if (Updates.isEmergencyLaunch) parts.push('非常時の起動');
  return parts.join(' · ');
}
