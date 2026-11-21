// 画面に出す版の名前。問い合わせのときに、どの版で動いているかを見分けるため。
//
//   v1.0.0（261121.1830）… TestFlight の版（かっこの中はビルド番号。作った日時。GitHub Actions が決める。docs/distribution.md）
//   v1.0.0 · 開発          … Expo Go・開発ビルド（Metro から読み込んでいる）
import Constants from 'expo-constants';

export function versionLabel(): string {
  const version = `v${Constants.expoConfig?.version ?? '?'}`;
  if (__DEV__) return `${version} · 開発`;
  const build = Constants.expoConfig?.ios?.buildNumber;
  return build ? `${version}（${build}）` : version;
}
