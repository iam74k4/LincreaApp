// 端末ごとの部品の入口（src/platform/）。部品がない端末（Expo Go・Android）では、何もしない（落ちない）。
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

import { holdBackgroundTime } from '../platform/backgroundTime';
import { hideFromAppSwitcher } from '../platform/privacyScreen';
import { shortValues } from '../core/shortValues';

jest.mock('expo-screen-capture', () => ({
  enableAppSwitcherProtectionAsync: jest.fn(async () => {}),
  disableAppSwitcherProtectionAsync: jest.fn(async () => {}),
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));
const capture = ScreenCapture as jest.Mocked<typeof ScreenCapture>;

afterEach(() => {
  Platform.OS = 'ios';
  jest.clearAllMocks();
});

describe('holdBackgroundTime（保存のあいだ、裏に回っても少し動き続ける）', () => {
  it('部品がない（テスト・Expo Go・Android）ときは何もしない。返した関数は何度呼んでもよい', () => {
    const release = holdBackgroundTime('route-1');
    expect(() => {
      release();
      release();
    }).not.toThrow();
  });
});

describe('hideFromAppSwitcher（切り替え画面に中身を写さない）', () => {
  it('iPhone: 切り替え画面のぼかしを入れ、戻すと外す（スクリーンショットは止めない）', () => {
    Platform.OS = 'ios';
    const restore = hideFromAppSwitcher('route-1');
    expect(capture.enableAppSwitcherProtectionAsync).toHaveBeenCalled();
    expect(capture.preventScreenCaptureAsync).not.toHaveBeenCalled();
    restore();
    expect(capture.disableAppSwitcherProtectionAsync).toHaveBeenCalled();
  });

  it('iPhone: 見せたくない画面から見せたくない画面へ移るとき、外す・付けるの順が逆でも、ぼかしは外れない', () => {
    Platform.OS = 'ios';
    const first = hideFromAppSwitcher('payslip');
    const second = hideFromAppSwitcher('pdf'); // 次の画面が先に付ける
    first(); // 前の画面があとから外す
    expect(capture.disableAppSwitcherProtectionAsync).not.toHaveBeenCalled();
    expect(capture.enableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
    second();
    second(); // 何度呼んでも、数え過ぎない
    expect(capture.disableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
  });

  it('Android: その画面のあいだだけ、画面の記録を止める（切り替え画面が白くなる）', () => {
    Platform.OS = 'android';
    const restore = hideFromAppSwitcher('route-2');
    expect(capture.preventScreenCaptureAsync).toHaveBeenCalledWith('route-2');
    expect(capture.enableAppSwitcherProtectionAsync).not.toHaveBeenCalled();
    restore();
    expect(capture.allowScreenCaptureAsync).toHaveBeenCalledWith('route-2');
  });
});

describe('shortValues（入れておく値は、短い文字だけ）', () => {
  it('40 文字までの文字だけ残し、長いもの・文字でないものは捨てる', () => {
    expect(shortValues({ a: '09:00', b: 'x'.repeat(41), c: 3, d: null, e: 'x'.repeat(40) })).toEqual({ a: '09:00', e: 'x'.repeat(40) });
    expect(shortValues(null)).toEqual({});
    expect(shortValues('text')).toEqual({});
  });
});
