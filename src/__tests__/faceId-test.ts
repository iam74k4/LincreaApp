// Face ID（Touch ID）でのログイン（src/auth/faceId.ts）。
// 鍵（Cognito の更新用の鍵）は、Face ID 付きでしか入れない・読めないこと、
// 使えなくなった鍵は消すこと、鍵を画面やログに出さないことを確かめる。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { loginWithRefreshToken, RefreshExpiredError } from '../auth/api';
import { biometry, disableFaceId, enableFaceId, faceIdUser, loginWithFaceId, renewFaceIdToken } from '../auth/faceId';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-constants', () => ({
  __esModule: true,
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
  default: { executionEnvironment: 'bare' },
}));
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../auth/api', () => {
  class LoginError extends Error {}
  class RefreshExpiredError extends LoginError {}
  return { LoginError, RefreshExpiredError, loginWithRefreshToken: jest.fn() };
});
jest.mock('../auth/rememberedUsername', () => ({ loadRememberedUsername: jest.fn(async () => 'taro') }));

const Constants = jest.requireMock('expo-constants').default as { executionEnvironment: string };
const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const store = SecureStore as jest.Mocked<typeof SecureStore>;
const refresh = loginWithRefreshToken as jest.MockedFunction<typeof loginWithRefreshToken>;

const TOKEN = 'refresh-token-secret-123';
const NEW_TOKEN = 'refresh-token-secret-456';

/** この端末は Face ID が使える */
function faceIdDevice() {
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(true);
  auth.supportedAuthenticationTypesAsync.mockResolvedValue([LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]);
}

let log: jest.SpyInstance;
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  Constants.executionEnvironment = 'bare';
  Platform.OS = 'ios';
  faceIdDevice();
  store.setItemAsync.mockResolvedValue(undefined);
  store.deleteItemAsync.mockResolvedValue(undefined);
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  // 鍵は、どんなときもログに出さない
  const logged = log.mock.calls.flat().map(String).join('\n');
  expect(logged).not.toContain(TOKEN);
  expect(logged).not.toContain(NEW_TOKEN);
  log.mockRestore();
});

describe('biometry: 端末で使える生体認証の名前', () => {
  test('顔の iPhone は Face ID', async () => {
    expect(await biometry()).toBe('Face ID');
  });
  test('指紋の iPhone・iPad は Touch ID', async () => {
    auth.supportedAuthenticationTypesAsync.mockResolvedValue([LocalAuthentication.AuthenticationType.FINGERPRINT]);
    expect(await biometry()).toBe('Touch ID');
  });
  test('Android は「顔認証」「指紋認証」', async () => {
    Platform.OS = 'android';
    expect(await biometry()).toBe('顔認証');
    auth.supportedAuthenticationTypesAsync.mockResolvedValue([LocalAuthentication.AuthenticationType.FINGERPRINT]);
    expect(await biometry()).toBe('指紋認証');
  });
  test('顔も指紋も登録していなければ使えない', async () => {
    auth.isEnrolledAsync.mockResolvedValue(false);
    expect(await biometry()).toBeNull();
  });
  test('Expo Go では使えない（Face ID の許可の文がないため）', async () => {
    Constants.executionEnvironment = 'storeClient';
    expect(await biometry()).toBeNull();
    expect(auth.hasHardwareAsync).not.toHaveBeenCalled();
  });
});

describe('enableFaceId: Face ID でログインできるようにする', () => {
  test('Face ID で確かめてから、鍵を Face ID 付きで、この端末だけに入れる', async () => {
    auth.authenticateAsync.mockResolvedValue({ success: true });
    expect(await enableFaceId('taro', TOKEN, 'Face ID')).toBe(true);

    // パスコードでは通さない（鍵も Face ID でしか読めないので）
    expect(auth.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: true }));
    // 上書きだと iOS が Face ID を求めるので、先に消してから入れる
    expect(store.deleteItemAsync.mock.invocationCallOrder[0]).toBeLessThan(store.setItemAsync.mock.invocationCallOrder[0]);
    expect(store.setItemAsync).toHaveBeenCalledWith(
      'refreshToken',
      TOKEN,
      expect.objectContaining({
        requireAuthentication: true,
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        keychainService: 'myapp.faceid',
      }),
    );
    expect(await faceIdUser()).toBe('taro');
  });

  test('Face ID をやめたら、何も入れない', async () => {
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    expect(await enableFaceId('taro', TOKEN, 'Face ID')).toBe(false);
    expect(store.setItemAsync).not.toHaveBeenCalled();
    expect(await faceIdUser()).toBeNull();
  });

  test('鍵を入れられなかったら、Face ID のログインは使えないままにする', async () => {
    auth.authenticateAsync.mockResolvedValue({ success: true });
    store.setItemAsync.mockRejectedValue(new Error('keychain error'));
    expect(await enableFaceId('taro', TOKEN, 'Face ID')).toBe(false);
    expect(await faceIdUser()).toBeNull();
  });
});

describe('renewFaceIdToken: パスワードでログインし直したとき', () => {
  test('Face ID を使っている同じ人なら、Face ID を求めずに鍵だけ新しくする', async () => {
    await AsyncStorage.setItem('faceid.username', 'taro');
    await renewFaceIdToken('taro', NEW_TOKEN);
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
    expect(store.setItemAsync).toHaveBeenCalledWith('refreshToken', NEW_TOKEN, expect.objectContaining({ requireAuthentication: true }));
  });

  test('ほかの人がログインしたときは、前の人の鍵を書き換えない', async () => {
    await AsyncStorage.setItem('faceid.username', 'taro');
    await renewFaceIdToken('hanako', NEW_TOKEN);
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('loginWithFaceId: Face ID でログインし直す', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('faceid.username', 'taro');
  });

  test('鍵を Face ID 付きで読み、その鍵でログインする', async () => {
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockResolvedValue({ session: { username: 'taro' }, refreshToken: TOKEN });
    expect(await loginWithFaceId()).toEqual({ ok: true, session: { username: 'taro' } });
    expect(store.getItemAsync).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ requireAuthentication: true }));
    expect(refresh).toHaveBeenCalledWith('taro', TOKEN, true);
    // 鍵が変わっていなければ、入れ直さない（入れ直すと、もう一度 Face ID が要る）
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  test('Cognito が新しい鍵をくれたら、入れ替える', async () => {
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockResolvedValue({ session: { username: 'taro' }, refreshToken: NEW_TOKEN });
    expect((await loginWithFaceId()).ok).toBe(true);
    expect(store.setItemAsync).toHaveBeenCalledWith('refreshToken', NEW_TOKEN, expect.objectContaining({ requireAuthentication: true }));
  });

  test('Face ID を使っていなければ、何も聞かない', async () => {
    await AsyncStorage.removeItem('faceid.username');
    expect(await loginWithFaceId()).toEqual({ ok: false, reason: 'off' });
    expect(store.getItemAsync).not.toHaveBeenCalled();
  });

  test('Face ID をやめた・顔が合わなかったときは、鍵を消さない（次にまた使える）', async () => {
    store.getItemAsync.mockRejectedValue(new Error('User canceled the operation.'));
    expect(await loginWithFaceId()).toEqual({ ok: false, reason: 'cancel' });
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(await faceIdUser()).toBe('taro');
  });

  test('顔の登録が変わって鍵が読めないときは、鍵を消してパスワードに戻す', async () => {
    store.getItemAsync.mockResolvedValue(null);
    const result = await loginWithFaceId();
    expect(result).toMatchObject({ ok: false, reason: 'reset' });
    expect(store.deleteItemAsync).toHaveBeenCalled();
    expect(await faceIdUser()).toBeNull();
  });

  test('鍵の期限が切れていたら、鍵を消してパスワードに戻す', async () => {
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockRejectedValue(new RefreshExpiredError('期限切れ'));
    expect(await loginWithFaceId()).toMatchObject({ ok: false, reason: 'expired' });
    expect(await faceIdUser()).toBeNull();
  });

  test('通信できないだけなら、鍵は消さない', async () => {
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockRejectedValue(new Error('Network request failed'));
    expect(await loginWithFaceId()).toMatchObject({ ok: false, reason: 'failed' });
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(await faceIdUser()).toBe('taro');
  });
});

describe('disableFaceId', () => {
  test('鍵と、誰の鍵かの印を消す', async () => {
    await AsyncStorage.setItem('faceid.username', 'taro');
    await disableFaceId();
    expect(store.deleteItemAsync).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ keychainService: 'myapp.faceid' }));
    expect(await faceIdUser()).toBeNull();
  });
});
