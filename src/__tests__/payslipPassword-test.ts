// 給与・賞与明細のパスワードを Face ID で入れる（src/auth/payslipPassword.ts）。
// パスワードは Face ID 付きでしか入れない・読めないこと、ほかの人のものは使わないこと、
// 使えなくなったものは消すこと、パスワードをログに出さないことを確かめる。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  declinePayslipFaceId,
  enablePayslipFaceId,
  forgetPayslipPassword,
  payslipBiometry,
  payslipBiometryToOffer,
  readPayslipPassword,
  renewPayslipPassword,
} from '../auth/payslipPassword';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-constants', () => ({
  __esModule: true,
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
  default: { executionEnvironment: 'bare' },
}));
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../auth/login', () => ({ loginWithRefreshToken: jest.fn(), RefreshExpiredError: class extends Error {} }));
jest.mock('../auth/rememberedUsername', () => ({ loadRememberedUsername: jest.fn(async () => null) }));

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const store = SecureStore as jest.Mocked<typeof SecureStore>;

const PASSWORD = 'intra-password-secret-1';
const NEW_PASSWORD = 'intra-password-secret-2';

let log: jest.SpyInstance;
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  Platform.OS = 'ios';
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(true);
  auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
  auth.supportedAuthenticationTypesAsync.mockResolvedValue([LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]);
  auth.authenticateAsync.mockResolvedValue({ success: true });
  store.setItemAsync.mockResolvedValue(undefined);
  store.deleteItemAsync.mockResolvedValue(undefined);
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  // パスワードは、どんなときもログに出さない
  const logged = log.mock.calls.flat().map(String).join('\n');
  expect(logged).not.toContain(PASSWORD);
  expect(logged).not.toContain(NEW_PASSWORD);
  log.mockRestore();
});

describe('使うか聞く・使えるようにする', () => {
  test('まだ使っていない人には聞く', async () => {
    expect(await payslipBiometryToOffer('taro')).toBe('Face ID');
    expect(await payslipBiometry('taro')).toBeNull();
  });
  test('「使う」: Face ID で確かめてから、Face ID 付き・この端末だけで入れる', async () => {
    expect(await enablePayslipFaceId('taro', PASSWORD, 'Face ID')).toBe(true);
    expect(auth.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: true }));
    expect(store.deleteItemAsync).toHaveBeenCalled(); // 上書きでは Face ID を求められるので、消してから入れる
    expect(store.setItemAsync).toHaveBeenCalledWith(
      'password',
      PASSWORD,
      expect.objectContaining({ requireAuthentication: true, keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY', keychainService: 'myapp.payslip' }),
    );
    expect(await payslipBiometry('taro')).toBe('Face ID');
    expect(await payslipBiometryToOffer('taro')).toBeNull(); // もう聞かない
  });
  test('顔が合わなければ、入れない', async () => {
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    expect(await enablePayslipFaceId('taro', PASSWORD, 'Face ID')).toBe(false);
    expect(store.setItemAsync).not.toHaveBeenCalled();
    expect(await payslipBiometry('taro')).toBeNull();
  });
  test('「使わない」を選んだ人には、もう聞かない（ほかの人には聞く）', async () => {
    await declinePayslipFaceId('taro');
    expect(await payslipBiometryToOffer('taro')).toBeNull();
    expect(await payslipBiometryToOffer('hanako')).toBe('Face ID');
  });
  test('Face ID がない端末では、聞かない', async () => {
    auth.isEnrolledAsync.mockResolvedValue(false);
    expect(await payslipBiometryToOffer('taro')).toBeNull();
  });
  test('長すぎるもの・空のものは入れない', async () => {
    expect(await enablePayslipFaceId('taro', 'x'.repeat(129), 'Face ID')).toBe(false);
    expect(await enablePayslipFaceId('taro', '', 'Face ID')).toBe(false);
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });
  test('iPhone: 入れるときの確かめの説明は渡さない（iOS は入れるときに Face ID を求めない）', async () => {
    await enablePayslipFaceId('taro', PASSWORD, 'Face ID');
    expect(store.setItemAsync.mock.calls[0][2]).not.toHaveProperty('authenticationPrompt');
  });
  test('Android: 入れるときに端末が確かめるので、前もっては確かめない（確かめの画面は1回）。消さずに上書きする', async () => {
    Platform.OS = 'android';
    expect(await enablePayslipFaceId('taro', PASSWORD, '顔認証')).toBe(true);
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(store.setItemAsync).toHaveBeenCalledWith(
      'password',
      PASSWORD,
      expect.objectContaining({ requireAuthentication: true, authenticationPrompt: '次から 顔認証 で明細を開きます' }),
    );
    expect(await payslipBiometry('taro')).toBe('顔認証');
  });
  test('Android: 別の人が使えるようにしかけてやめても、前の人のパスワードは消さない（何も入れていないため）', async () => {
    Platform.OS = 'android';
    await enablePayslipFaceId('taro', PASSWORD, '顔認証');
    jest.clearAllMocks();
    store.setItemAsync.mockRejectedValue(new Error('User canceled the authentication'));
    expect(await enablePayslipFaceId('hanako', NEW_PASSWORD, '顔認証')).toBe(false);
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(await payslipBiometry('taro')).toBe('顔認証');
  });
});

describe('読む', () => {
  beforeEach(async () => {
    await enablePayslipFaceId('taro', PASSWORD, 'Face ID');
    jest.clearAllMocks();
  });
  test('Face ID 付きで読む', async () => {
    store.getItemAsync.mockResolvedValue(PASSWORD);
    expect(await readPayslipPassword('taro')).toEqual({ ok: true, password: PASSWORD });
    expect(store.getItemAsync).toHaveBeenCalledWith('password', expect.objectContaining({ requireAuthentication: true, keychainService: 'myapp.payslip' }));
  });
  test('ほかの人がログインしているときは、読まない', async () => {
    expect(await readPayslipPassword('hanako')).toEqual({ ok: false, reason: 'off' });
    expect(store.getItemAsync).not.toHaveBeenCalled();
  });
  test('やめた・顔が合わなかったら、cancel（覚えているものは消さない）', async () => {
    store.getItemAsync.mockRejectedValue(new Error('User canceled'));
    expect(await readPayslipPassword('taro')).toEqual({ ok: false, reason: 'cancel' });
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });
  test('顔の登録が変わって読めない（null）なら、消して reset', async () => {
    store.getItemAsync.mockResolvedValue(null);
    expect(await readPayslipPassword('taro')).toEqual({ ok: false, reason: 'reset' });
    expect(store.deleteItemAsync).toHaveBeenCalled();
    expect(await payslipBiometry('taro')).toBeNull();
    expect(await payslipBiometryToOffer('taro')).toBe('Face ID'); // 手で開けたら、また聞く
  });
});

describe('入れ替える・消す', () => {
  test('使っている同じ人なら、Face ID を求めずに入れ替える', async () => {
    await enablePayslipFaceId('taro', PASSWORD, 'Face ID');
    jest.clearAllMocks();
    await renewPayslipPassword('taro', NEW_PASSWORD);
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
    expect(store.setItemAsync).toHaveBeenCalledWith('password', NEW_PASSWORD, expect.objectContaining({ requireAuthentication: true }));
  });
  test('使っていない人・ほかの人のときは、入れない', async () => {
    await renewPayslipPassword('taro', NEW_PASSWORD);
    await enablePayslipFaceId('taro', PASSWORD, 'Face ID');
    jest.clearAllMocks();
    await renewPayslipPassword('hanako', NEW_PASSWORD);
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });
  test('iPhone: 入れ替えられなかったら（前のものは消してある）、使っていないことにする', async () => {
    await enablePayslipFaceId('taro', PASSWORD, 'Face ID');
    store.setItemAsync.mockRejectedValue(new Error('keychain error'));
    await renewPayslipPassword('taro', NEW_PASSWORD);
    expect(await payslipBiometry('taro')).toBeNull();
  });
  test('Android: 確かめの画面でやめても、前のものが残っているので、そのまま使える（消さない）', async () => {
    Platform.OS = 'android';
    await enablePayslipFaceId('taro', PASSWORD, '顔認証');
    jest.clearAllMocks();
    store.setItemAsync.mockRejectedValue(new Error('User canceled the authentication'));
    await renewPayslipPassword('taro', NEW_PASSWORD);
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(await payslipBiometry('taro')).toBe('顔認証');
  });
  test('消すと、使っていないことになる', async () => {
    await enablePayslipFaceId('taro', PASSWORD, 'Face ID');
    await forgetPayslipPassword();
    expect(store.deleteItemAsync).toHaveBeenCalledWith('password', expect.objectContaining({ keychainService: 'myapp.payslip' }));
    expect(await payslipBiometry('taro')).toBeNull();
  });
});
