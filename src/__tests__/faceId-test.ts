// Face ID（Touch ID）でのログイン（src/auth/faceId.ts）。
// 鍵（Cognito の更新用の鍵）は、Face ID 付きでしか入れない・読めないこと、
// 使えなくなった鍵は消すこと、鍵を画面やログに出さないことを確かめる。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { NetworkError } from '../api/http';
import { loginWithRefreshToken, RefreshExpiredError } from '../auth/login';
import { biometry, disableFaceId, enableFaceId, faceIdUser, loginWithFaceId, renewFaceIdToken } from '../auth/faceId';

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
jest.mock('../auth/login', () => {
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
  auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
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
  test('Android は「顔認証」「指紋認証」。両方あるときは、どちらを登録したか分からないので「生体認証」', async () => {
    Platform.OS = 'android';
    expect(await biometry()).toBe('顔認証');
    auth.supportedAuthenticationTypesAsync.mockResolvedValue([LocalAuthentication.AuthenticationType.FINGERPRINT]);
    expect(await biometry()).toBe('指紋認証');
    auth.supportedAuthenticationTypesAsync.mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    expect(await biometry()).toBe('生体認証');
  });
  test('iPhone で顔と指紋の両方が返っても、Face ID（今までどおり）', async () => {
    auth.supportedAuthenticationTypesAsync.mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    expect(await biometry()).toBe('Face ID');
  });
  test('顔も指紋も登録していなければ使えない', async () => {
    auth.isEnrolledAsync.mockResolvedValue(false);
    expect(await biometry()).toBeNull();
  });
  test('Android: 弱い生体認証（カメラの2D の顔認証など）だけなら使えない（鍵を入れる側が、強いものしか受け付けないため）', async () => {
    Platform.OS = 'android';
    auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK);
    expect(await biometry()).toBeNull();
  });
  test('iPhone: 試行を重ねてロックされている間（レベルが下がる）でも、Face ID は使える端末のまま', async () => {
    auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.SECRET);
    expect(await biometry()).toBe('Face ID');
    expect(auth.getEnrolledLevelAsync).not.toHaveBeenCalled();
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

    // パスコードでは通さない（鍵も Face ID でしか読めないので）。合わなかったときの「パスワードを入力」のボタンも出さない
    expect(auth.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: true, fallbackLabel: '' }));
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

  test('Touch ID の iPhone: 確かめの画面は Touch ID の名前で出す。指が合わなくても「パスワードを入力」は出さない', async () => {
    auth.supportedAuthenticationTypesAsync.mockResolvedValue([LocalAuthentication.AuthenticationType.FINGERPRINT]);
    const kind = await biometry();
    expect(kind).toBe('Touch ID');
    auth.authenticateAsync.mockResolvedValue({ success: true });
    expect(await enableFaceId('taro', TOKEN, kind!)).toBe(true);
    expect(auth.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: '次から Touch ID でログインします',
      cancelLabel: 'やめる',
      disableDeviceFallback: true,
      fallbackLabel: '',
    });
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

  test('iPhone: 入れるときの確かめの説明は渡さない（iOS は入れるときに Face ID を求めない）', async () => {
    auth.authenticateAsync.mockResolvedValue({ success: true });
    await enableFaceId('taro', TOKEN, 'Face ID');
    expect(store.setItemAsync.mock.calls[0][2]).not.toHaveProperty('authenticationPrompt');
  });

  test('Android: 入れるときに端末が確かめるので、前もっては確かめない（確かめの画面は1回）。消さずに上書きする', async () => {
    Platform.OS = 'android';
    expect(await enableFaceId('taro', TOKEN, '顔認証')).toBe(true);
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(store.setItemAsync).toHaveBeenCalledWith(
      'refreshToken',
      TOKEN,
      expect.objectContaining({ requireAuthentication: true, authenticationPrompt: '次から 顔認証 でログインします' }),
    );
    expect(await faceIdUser()).toBe('taro');
  });

  test('Android: 入れるときの確かめでやめたら、使えないままにする', async () => {
    Platform.OS = 'android';
    store.setItemAsync.mockRejectedValue(new Error('User canceled the authentication'));
    expect(await enableFaceId('taro', TOKEN, '顔認証')).toBe(false);
    expect(await faceIdUser()).toBeNull();
  });

  test('Android: 別の人が使えるようにしかけてやめても、前の人の鍵は消さない（何も入れていないため）', async () => {
    Platform.OS = 'android';
    await AsyncStorage.setItem('faceid.username', 'taro');
    store.setItemAsync.mockRejectedValue(new Error('User canceled the authentication'));
    expect(await enableFaceId('hanako', NEW_TOKEN, '顔認証')).toBe(false);
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(await faceIdUser()).toBe('taro');
  });

  test('Android: 鍵は入れたのに誰の鍵かを書けなかったら、食い違わないように消す', async () => {
    Platform.OS = 'android';
    await AsyncStorage.setItem('faceid.username', 'taro');
    // テスト用の AsyncStorage はモック関数なので、次の1回だけ失敗させる（元に戻す必要はない）
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    expect(await enableFaceId('hanako', NEW_TOKEN, '顔認証')).toBe(false);
    expect(store.deleteItemAsync).toHaveBeenCalledWith('refreshToken', expect.anything());
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

  test('iPhone: 入れ替えられなかったら（前の鍵は消してある）、Face ID のログインをやめる', async () => {
    await AsyncStorage.setItem('faceid.username', 'taro');
    store.setItemAsync.mockRejectedValue(new Error('keychain error'));
    await renewFaceIdToken('taro', NEW_TOKEN);
    expect(await faceIdUser()).toBeNull();
  });

  test('Android: 確かめの画面でやめても、前の鍵は残っているので、そのまま使える（消さない）', async () => {
    Platform.OS = 'android';
    await AsyncStorage.setItem('faceid.username', 'taro');
    store.setItemAsync.mockRejectedValue(new Error('User canceled the authentication'));
    await renewFaceIdToken('taro', NEW_TOKEN);
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(await faceIdUser()).toBe('taro');
    expect(store.setItemAsync).toHaveBeenCalledWith('refreshToken', NEW_TOKEN, expect.objectContaining({ authenticationPrompt: 'ログインの鍵を新しくします' }));
  });
});

describe('loginWithFaceId: Face ID でログインし直す', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('faceid.username', 'taro');
  });

  test('入り直す人が決まっていて（画面に出ている人）、鍵がほかの人のものなら、Face ID を出さずに使わない', async () => {
    expect(await loginWithFaceId(null, 'hanako')).toEqual({ ok: false, reason: 'off' });
    expect(store.getItemAsync).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    // 同じ人なら入る
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockResolvedValue({ session: { username: 'taro' }, refreshToken: TOKEN });
    expect(await loginWithFaceId(null, 'taro')).toEqual({ ok: true, session: { username: 'taro' } });
  });

  test('鍵を Face ID 付きで読み、その鍵でログインする', async () => {
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockResolvedValue({ session: { username: 'taro' }, refreshToken: TOKEN });
    expect(await loginWithFaceId()).toEqual({ ok: true, session: { username: 'taro' } });
    expect(store.getItemAsync).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ requireAuthentication: true }));
    expect(refresh).toHaveBeenCalledWith('taro', TOKEN, true, null);
    // 鍵が変わっていなければ、入れ直さない（入れ直すと、もう一度 Face ID が要る）
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  test('起動したときの確かめで読めた Cognito の設定を渡されたら、それでログインする（ログイン画面を読み直さない）', async () => {
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockResolvedValue({ session: { username: 'taro' }, refreshToken: TOKEN });
    const pool = { userPoolId: 'ap-northeast-1_abc', clientId: 'client1' };
    expect((await loginWithFaceId(pool)).ok).toBe(true);
    expect(refresh).toHaveBeenCalledWith('taro', TOKEN, true, pool);
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

  test('登録が変わった知らせは、その端末の呼び名で出す（iPhone は Face ID か Touch ID、Android は顔認証）', async () => {
    store.getItemAsync.mockResolvedValue(null);
    expect(await loginWithFaceId()).toMatchObject({ reason: 'reset', message: expect.stringContaining('Face ID の登録') });

    await AsyncStorage.setItem('faceid.username', 'taro');
    auth.supportedAuthenticationTypesAsync.mockResolvedValue([LocalAuthentication.AuthenticationType.FINGERPRINT]);
    expect(await loginWithFaceId()).toMatchObject({ reason: 'reset', message: expect.stringContaining('Touch ID の登録') });
    faceIdDevice();

    await AsyncStorage.setItem('faceid.username', 'taro'); // 前の実行で消えているので、また使っていることにする
    Platform.OS = 'android';
    expect(await loginWithFaceId()).toMatchObject({ reason: 'reset', message: expect.stringContaining('顔認証 の登録') });
  });

  test('鍵の期限が切れていたら、鍵を消してパスワードに戻す', async () => {
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockRejectedValue(new RefreshExpiredError('期限切れ'));
    // 知らせは、その端末の呼び名で出す（iPhone は Face ID）
    expect(await loginWithFaceId()).toMatchObject({ ok: false, reason: 'expired', message: expect.stringContaining('Face ID でのログインの期限') });

    // Android は顔認証（「Face ID」と決め打ちしていないこと）
    await AsyncStorage.setItem('faceid.username', 'taro');
    Platform.OS = 'android';
    expect(await loginWithFaceId()).toMatchObject({ reason: 'expired', message: expect.stringContaining('顔認証 でのログインの期限') });
    expect(await faceIdUser()).toBeNull();
  });

  test('通信できないだけなら offline。鍵は消さない', async () => {
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockRejectedValue(new NetworkError());
    expect(await loginWithFaceId()).toMatchObject({ ok: false, reason: 'offline' });
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(await faceIdUser()).toBe('taro');
  });

  test('サーバーが断った・ログイン画面が読めないなど、つながらない以外の失敗は failed（つながらないことにしない）。鍵は消さない', async () => {
    store.getItemAsync.mockResolvedValue(TOKEN);
    refresh.mockRejectedValue(new Error('サーバーがトークンを受け付けませんでした（HTTP 302、行き先 /login）'));
    expect(await loginWithFaceId()).toMatchObject({ ok: false, reason: 'failed' });
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
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
