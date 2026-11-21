// 画面に出す版の名前。問い合わせのときに、どの版で動いているかを見分けるため。
//
//   v1.0.0（261121.1830・1a2b3c4）… 配った版（かっこの中は、ビルド番号と、作ったコミット。どちらも GitHub Actions が入れる。docs/distribution.md）
//   v1.0.0 · 開発                  … Expo Go・開発ビルド（Metro から読み込んでいる）
// ビルド番号は、iPhone は ios.buildNumber、Android は android.versionCode（どちらも、作るときに app.json に入れる）。
// どちらの番号を出すかは、動いている端末で決める（両方入っていても、その端末の番号を出す）
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function versionLabel(): string {
  const config = Constants.expoConfig;
  const version = `v${config?.version ?? '?'}`;
  if (__DEV__) return `${version} · 開発`;
  const build =
    Platform.OS === 'android'
      ? config?.android?.versionCode
        ? String(config.android.versionCode)
        : ''
      : (config?.ios?.buildNumber ?? '');
  const sha = typeof config?.extra?.gitSha === 'string' ? config.extra.gitSha.slice(0, 7) : '';
  const parts = [build, sha].filter(Boolean).join('・');
  return parts ? `${version}（${parts}）` : version;
}
