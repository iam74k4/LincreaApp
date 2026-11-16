// ログイン後の画面の組。マイアプリ一覧 → アプリ と重ねていく。
// ヘッダーの色は、_layout.tsx のテーマ（ライト / ダーク）に任せる。
import { Pressable } from 'react-native';
import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { useColors } from '../../theme';

export default function AppLayout() {
  const c = useColors();
  // アプリの画面（WebView）は、ヘッダーを地の色で塗る。
  // iOS 26 のヘッダーは透けていて、スクロールした中身がぼかされずに時刻や戻るボタンと重なって見えるため
  // （ぼかしは画面の ScrollView にしか効かず、WebView の中のスクロールには効かない）
  const webScreen = { title: '', headerTransparent: false, headerStyle: { backgroundColor: c.background }, headerShadowVisible: false };
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* 大きな見出し。下に引っぱると縮んで、上のバーに収まる（iOS 標準の動き） */}
      <Stack.Screen name="index" options={{ title: 'マイアプリ', headerLargeTitle: true }} />
      <Stack.Screen name="run/[app]/[form]" options={webScreen} />
      <Stack.Screen name="page" options={webScreen} />
      {/* その場で開く申請などは、シートで重ねる（iOS 26 ではガラスの縁のシート）。左上の × で閉じる */}
      <Stack.Screen
        name="sheet/[app]/[form]"
        options={{
          ...webScreen,
          presentation: 'modal',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="閉じる" hitSlop={8}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={17} weight="semibold" tintColor={c.text} />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
