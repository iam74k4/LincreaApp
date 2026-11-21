// マイアプリの一覧の控え（src/api/myAppsCache.ts）。起動してすぐ前回の一覧を出すためのもの。
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MyApp } from '../api/myApps';
import { forgetCachedApps, loadCachedApps, saveCachedApps } from '../api/myAppsCache';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const APP: MyApp = {
  id: 'a1',
  name: '勤怠 TiMS',
  logicName: 'L_Tims',
  formName: 'frmLTiMSTop',
  description: '',
  icon: { name: 'clock', color: '#fff', background: '#00f' },
  isAvailable: true,
  isDeveloping: false,
  releasedAt: new Date('2026-11-01T00:00:00Z'),
  releaseId: 'r1',
  releaseNotes: '',
};
const DAY = 24 * 60 * 60 * 1000;

/** 保存は待たずに返る（裏で書く）ので、書き終わるのを待つ */
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('控えた一覧を、日付も元の形で読み戻す', async () => {
  saveCachedApps('taro', [APP], 1000);
  await settle();
  const apps = await loadCachedApps('taro', 2000);
  expect(apps).toEqual([APP]);
  expect(apps?.[0].releasedAt).toBeInstanceOf(Date);
});

test('ほかの人の一覧は出さない・名前のない人には出さない', async () => {
  saveCachedApps('taro', [APP], 1000);
  await settle();
  expect(await loadCachedApps('hanako', 2000)).toBeNull();
  expect(await loadCachedApps('', 2000)).toBeNull();
});

test('30 日より古い控えは使わない', async () => {
  saveCachedApps('taro', [APP], 0);
  await settle();
  expect(await loadCachedApps('taro', 29 * DAY)).not.toBeNull();
  expect(await loadCachedApps('taro', 31 * DAY)).toBeNull();
});

test('壊れた控えは、なかったことにする', async () => {
  await AsyncStorage.setItem('myApps.cache', '{oops');
  expect(await loadCachedApps('taro')).toBeNull();
  await AsyncStorage.setItem('myApps.cache', JSON.stringify({ username: 'taro', savedAt: Date.now(), apps: [{ id: 'x' }] }));
  expect(await loadCachedApps('taro')).toBeNull();
});

test('ログアウトで消す', async () => {
  saveCachedApps('taro', [APP]);
  await settle();
  forgetCachedApps();
  await settle();
  expect(await loadCachedApps('taro')).toBeNull();
});
