// アプリ全体の入口。
//
// ① 色: 端末のライト / ダークに合わせて、ヘッダーや背景の色（ナビゲーションのテーマ）を切り替える。
// ② 画面の組: ログインしているかどうかで、見せる画面の組を切り替える。
//
//   ログインしていない → login だけ
//   ログインしている   → (app) の中（マイアプリ一覧、アプリの起動）だけ
//
// 起動したときは、前回のログインがサーバーでまだ有効なら、ログイン画面を飛ばす（SessionContext）。
// 切り替えは Stack.Protected（守り役）がやる。ログインできて session が入った瞬間に
// login は見られなくなり、自動で (app) の最初の画面（マイアプリ）へ移る。ログアウトはその逆。
// 各画面は「次にどこへ行くか」を自分で決めなくてよい。
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, AppState, StyleSheet, useColorScheme, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { setStatusBarStyle, StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '../session/SessionContext';
import { useColors } from '../theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();
  // ライト / ダークを、アプリを開いたまま切り替えたとき（コントロールセンターや、夜になって自動で）、
  // iOS が時刻などの文字の色を元に戻してしまうことがある（黒い地に黒い文字になって見えない）。
  // 切り替わったあとと、アプリに戻ってきたときに、もう一度その色にする
  useEffect(() => {
    const apply = () => setStatusBarStyle(c.statusBar, false);
    const timers = [150, 600, 1500].map((ms) => setTimeout(apply, ms));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') timers.push(setTimeout(apply, 150));
    });
    return () => {
      timers.forEach(clearTimeout);
      sub.remove();
    };
  }, [c.statusBar]);
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.accent,
        background: c.background,
        card: c.background,
        text: c.text,
        border: c.separator,
      },
    };
  }, [scheme, c]);

  return (
    <ThemeProvider value={navigationTheme}>
      {/* 上の時刻などの色。"auto" は、アプリを開いたあとにライト / ダークを切り替えると追いつかないことがあるので、はっきり決める */}
      <StatusBar style={c.statusBar} />
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, restoring } = useSession();
  const c = useColors();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={session !== null}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={session === null}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
      {/* 起動直後、前回のログインがまだ有効か確かめている間は、画面をかぶせて待つ */}
      {restoring && (
        <View style={[StyleSheet.absoluteFill, styles.restoring, { backgroundColor: c.background }]}>
          <ActivityIndicator color={c.textSecondary} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  restoring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
