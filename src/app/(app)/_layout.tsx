// ログイン後の画面の組。マイアプリ一覧 → アプリ と重ねていく。
// ヘッダーの色は、_layout.tsx のテーマ（ライト / ダーク）に任せる。
import { Pressable, StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { BackgroundSaveBanner } from '../../components/BackgroundSaveBanner';
import { stopApplyQueue } from '../../openShortcut';
import { useColors } from '../../theme';

export default function AppLayout() {
  const c = useColors();
  // アプリの画面（WebView）は、ヘッダーを地の色で塗る。
  // iOS 26 のヘッダーは透けていて、スクロールした中身がぼかされずに時刻や戻るボタンと重なって見えるため
  // （ぼかしは画面の ScrollView にしか効かず、WebView の中のスクロールには効かない）
  const webScreen = { title: '', headerTransparent: false, headerStyle: { backgroundColor: c.background }, headerShadowVisible: false };
  return (
    <View style={styles.fill}>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        {/* 大きな見出し。下に引っぱると縮んで、上のバーに収まる（iOS 標準の動き）。
            いちばん下の画面なので、戻る操作はない。保存を裏で続けている画面は、この下に置く（src/webview/backgroundSaves.ts）。
            そのあいだも ‹ やスワイプで、その画面が出てこないようにする */}
        <Stack.Screen name="index" options={{ title: 'マイアプリ', headerLargeTitle: true, headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="run/[app]/[form]" options={webScreen} />
        <Stack.Screen name="page" options={webScreen} />
        {/* ページから受け取った PDF（左上で戻る・右上で保存・共有） */}
        <Stack.Screen name="file" options={webScreen} />
        {/* その場で開く申請などは、シートで重ねる（iOS 26 ではガラスの縁のシート）。左上の × で閉じる
            （まとめて申請の途中なら、残りもやめる。src/openShortcut.ts） */}
        <Stack.Screen
          name="sheet/[app]/[form]"
          options={{
            ...webScreen,
            presentation: 'modal',
            headerLeft: () => (
              <Pressable
                onPress={() => {
                  stopApplyQueue();
                  router.back();
                }}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
                hitSlop={8}
              >
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={17} weight="semibold" tintColor={c.text} />
              </Pressable>
            ),
          }}
        />
      </Stack>
      {/* 裏で続けている保存の知らせ（どの画面の上にも出す） */}
      <BackgroundSaveBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
