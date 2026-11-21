// 画面に出す版の名前（src/core/appVersion.ts）。配った版は、ビルド番号と作ったコミットを出す（問い合わせで、どのコードかをたどるため）。
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { versionLabel } from '../core/appVersion';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));
const constants = Constants as unknown as { expoConfig: Record<string, unknown> | null };
const global_ = globalThis as unknown as { __DEV__: boolean };

let dev: boolean;
beforeEach(() => {
  dev = global_.__DEV__;
  global_.__DEV__ = false;
});
afterEach(() => {
  global_.__DEV__ = dev;
  Platform.OS = 'ios';
});

it('開発中は「開発」', () => {
  global_.__DEV__ = true;
  constants.expoConfig = { version: '1.0.0', ios: { buildNumber: '261121.1830' } };
  expect(versionLabel()).toBe('v1.0.0 · 開発');
});

it('iPhone の配った版: ビルド番号と、作ったコミット（7 文字）', () => {
  constants.expoConfig = { version: '1.0.0', ios: { buildNumber: '261121.1830' }, extra: { gitSha: '1a2b3c4d5e6f7a8b9c0d' } };
  expect(versionLabel()).toBe('v1.0.0（261121.1830・1a2b3c4）');
});

it('Android の配った版: versionCode をビルド番号として出す（iOS の番号が入っていても、端末の番号を出す）', () => {
  Platform.OS = 'android';
  constants.expoConfig = { version: '1.0.0', ios: { buildNumber: '261121.1830' }, android: { versionCode: 29351234 }, extra: { gitSha: 'abcdef0123' } };
  expect(versionLabel()).toBe('v1.0.0（29351234・abcdef0）');
});

it('ビルド番号もコミットもなければ、版だけ', () => {
  constants.expoConfig = { version: '1.0.0' };
  expect(versionLabel()).toBe('v1.0.0');
});
