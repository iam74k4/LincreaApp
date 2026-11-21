// 見せたくない画面（給与明細・住民税の通知書・健康診断・受け取った PDF）が前に出ているあいだ、
// アプリの切り替え画面に中身を写さない（src/platform/privacyScreen.ts）。前から外れたら（ほかの画面を重ねた・戻った）、戻す。
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { hideFromAppSwitcher } from '../platform/privacyScreen';

/** 個人の情報（給与・税・健康）を出すアプリ（アプリケーション ID） */
const SENSITIVE_APPS = new Set(['L_Payslip', 'L_Payslip_Juminzei', 'L_HealthCare']);

/** アプリケーション ID から、見せたくない画面か */
export function isSensitiveApp(appId: string): boolean {
  return SENSITIVE_APPS.has(appId);
}

/** sensitive のあいだ、この画面が前に出ていたら、切り替え画面に写さない。key は画面の名前（ルートの key） */
export function usePrivacyScreen(sensitive: boolean, key: string): void {
  useFocusEffect(
    useCallback(() => {
      if (!sensitive) return;
      return hideFromAppSwitcher(key);
    }, [sensitive, key]),
  );
}
