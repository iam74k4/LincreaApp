// 直しを早く届ける仕組み（src/autoUpdate.ts）を、expo-updates と画面につなぐ。アプリ全体の入口（src/app/_layout.tsx）で使う。
//
// 切り替えてよいのは、マイアプリにいて、保存の途中でも、保存の知らせを出している途中でもないときだけ。
//   - ログイン画面では切り替えない（起動したときに出る Face ID を、途中で消してしまうため）
//   - 保存を裏で続けている画面は、マイアプリの下に隠れている（src/webview/backgroundSaves.ts）ので、保存の受付も見る
// 開発ビルド・Expo Go では、expo-updates が動かないので、何もしない。
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import * as Updates from 'expo-updates';

import { createAutoUpdater, type AutoUpdater } from './autoUpdate';
import { savesSnapshot } from './webview/backgroundSaves';

/** 切り替えてよい画面（マイアプリ） */
const SAFE_PATHNAME = '/';

/** backgroundColor: 切り替えのあいだに出す地の色（いまのテーマの地の色） */
export function useAutoUpdate(backgroundColor: string): void {
  const { isUpdatePending, isStartupProcedureRunning } = Updates.useUpdates();
  const pathname = usePathname();
  // 切り替えてよいかなどは、聞かれたときの値で答える（AppState の知らせは、画面を描き直さずに来るため）
  const state = useRef({ isUpdatePending, isStartupProcedureRunning, pathname, backgroundColor });
  useEffect(() => {
    state.current = { isUpdatePending, isStartupProcedureRunning, pathname, backgroundColor };
  }, [isUpdatePending, isStartupProcedureRunning, pathname, backgroundColor]);

  // 仕組みは、描くときではなく、画面ができたあとに作る（中で上の state を読むため）
  const updater = useRef<AutoUpdater | null>(null);
  useEffect(() => {
    const u = createAutoUpdater({
      enabled: Updates.isEnabled && !__DEV__,
      check: () => Updates.checkForUpdateAsync(),
      fetch: () => Updates.fetchUpdateAsync(),
      reload: () => Updates.reloadAsync({ reloadScreenOptions: { backgroundColor: state.current.backgroundColor, fade: true } }),
      isPending: () => state.current.isUpdatePending,
      isStartupRunning: () => state.current.isStartupProcedureRunning,
      isSafe: () => {
        const saves = savesSnapshot();
        return state.current.pathname === SAFE_PATHNAME && saves.current === null && saves.banner === null;
      },
      now: () => Date.now(),
    });
    updater.current = u;
    u.onActive();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') u.onActive();
    });
    return () => {
      subscription.remove();
      updater.current = null;
    };
  }, []);

  // 起動のときに expo-updates が受け取り終えたとき（開いてすぐなら、その場で切り替える）。
  // 上の state の更新と、仕組みを作るのより後に動くように、ここも useEffect で、後に書く
  useEffect(() => {
    if (isUpdatePending) updater.current?.onPending();
  }, [isUpdatePending]);
}
