// Cognito の部品の保存場所（src/auth/cognitoStorage.ts）。
// ログインのトークンは端末に残さず（メモリだけ）、端末の登録（deviceKey など）だけをキーチェーンに残すこと、
// 前の版が AsyncStorage に書いたトークンは消すことを確かめる。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    __items: items,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      items.set(key, value);
    }),
  };
});

const keychain = (jest.requireMock('expo-secure-store') as { __items: Map<string, string> }).__items;
const P = 'CognitoIdentityServiceProvider.client1';
const KEYS = {
  last: `${P}.LastAuthUser`,
  device: `${P}.taro.deviceKey`,
  group: `${P}.taro.deviceGroupKey`,
  random: `${P}.taro.randomPasswordKey`,
  id: `${P}.taro.idToken`,
  access: `${P}.taro.accessToken`,
  refresh: `${P}.taro.refreshToken`,
};

/** モジュールの中の控え（メモリ）を毎回まっさらにして読み込む */
function freshModule(): typeof import('../auth/cognitoStorage') {
  let mod!: typeof import('../auth/cognitoStorage');
  jest.isolateModules(() => {
    // まっさらな読み込みは require でしかできない（テストの中の import() は使えない）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../auth/cognitoStorage');
  });
  return mod;
}

/** キーチェーンに残っているもの */
function kept(): Record<string, string> {
  const saved = keychain.get('cognitoDevice');
  return saved ? JSON.parse(saved) : {};
}

beforeEach(async () => {
  jest.clearAllMocks();
  keychain.clear();
  await AsyncStorage.clear();
});

test('トークンはメモリにだけ置き、端末には書かない', async () => {
  const { cognitoStorage } = freshModule();
  cognitoStorage.setItem(KEYS.id, 'id-token');
  cognitoStorage.setItem(KEYS.access, 'access-token');
  cognitoStorage.setItem(KEYS.refresh, 'refresh-token');
  expect(cognitoStorage.getItem(KEYS.refresh)).toBe('refresh-token');
  await Promise.resolve();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});

test('端末の登録と最後にログインした人だけを、キーチェーンに残す', async () => {
  const { cognitoStorage } = freshModule();
  cognitoStorage.setItem(KEYS.refresh, 'refresh-token');
  cognitoStorage.setItem(KEYS.last, 'taro');
  cognitoStorage.setItem(KEYS.device, 'device-1');
  await Promise.resolve();
  expect(kept()).toEqual({ [KEYS.last]: 'taro', [KEYS.device]: 'device-1' });
  expect(keychain.get('cognitoDevice')).not.toContain('refresh-token');
  // この端末だけに置く（バックアップや機種変更で、ほかの端末に移らない）
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(
    'cognitoDevice',
    expect.any(String),
    expect.objectContaining({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' }),
  );
});

test('前の版が AsyncStorage に書いたものは、端末の登録だけ引き継いで、トークンごと消す', async () => {
  await AsyncStorage.multiSet([
    [`@MemoryStorage:${KEYS.device}`, 'device-1'],
    [`@MemoryStorage:${KEYS.group}`, 'group-1'],
    [`@MemoryStorage:${KEYS.refresh}`, 'old-refresh-token'],
    [`@MemoryStorage:${KEYS.id}`, 'old-id-token'],
    ['login.rememberedUsername', 'taro'],
  ]);
  const { cognitoStorage, loadCognitoStorage } = freshModule();
  await loadCognitoStorage();

  expect(cognitoStorage.getItem(KEYS.device)).toBe('device-1');
  expect(cognitoStorage.getItem(KEYS.group)).toBe('group-1');
  // 古いトークンは、メモリにも入れない
  expect(cognitoStorage.getItem(KEYS.refresh)).toBeNull();
  expect(cognitoStorage.getItem(KEYS.id)).toBeNull();
  // AsyncStorage からは全部消え、ほかのアプリの保存（ユーザー名）は残る
  expect(await AsyncStorage.getAllKeys()).toEqual(['login.rememberedUsername']);
  expect(kept()).toEqual({ [KEYS.device]: 'device-1', [KEYS.group]: 'group-1' });
});

test('次の起動では、キーチェーンから端末の登録を読み戻す（トークンが混ざっていても読まない）', async () => {
  keychain.set('cognitoDevice', JSON.stringify({ [KEYS.device]: 'device-1', [KEYS.refresh]: 'should-not-load' }));
  const { cognitoStorage, loadCognitoStorage } = freshModule();
  await loadCognitoStorage();
  expect(cognitoStorage.getItem(KEYS.device)).toBe('device-1');
  expect(cognitoStorage.getItem(KEYS.refresh)).toBeNull();
});

test('読み込みは1回だけ（何度呼んでも同じ）', async () => {
  const { loadCognitoStorage } = freshModule();
  await Promise.all([loadCognitoStorage(), loadCognitoStorage(), loadCognitoStorage()]);
  expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
});

test('ログアウトでトークンを消し、端末の登録は残す', async () => {
  const { cognitoStorage, forgetCognitoTokens } = freshModule();
  cognitoStorage.setItem(KEYS.device, 'device-1');
  cognitoStorage.setItem(KEYS.refresh, 'refresh-token');
  cognitoStorage.setItem(KEYS.access, 'access-token');
  forgetCognitoTokens();
  expect(cognitoStorage.getItem(KEYS.refresh)).toBeNull();
  expect(cognitoStorage.getItem(KEYS.access)).toBeNull();
  expect(cognitoStorage.getItem(KEYS.device)).toBe('device-1');
});
