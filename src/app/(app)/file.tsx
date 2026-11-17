// ページから受け取った PDF（給与明細・住民税の通知書など）を、アプリの画面として見せる。
// 左上の戻るボタンで戻る（ほかの画面と同じ）。右上のボタンから、「ファイル」に保存・プリント・共有ができる。
//
// 前は iPhone の標準のプレビュー（Quick Look）で見せていた。iOS 26 では閉じるボタンが右上にあり、
// Expo Go の歯車のボタンに隠れて、閉じられない（戻れない）ことがあったので、アプリの画面にそろえた。
// ファイルはアプリの一時的な場所にある（src/files.ts。古いものは消し、ログアウトでもすべて消す）。
import { Pressable, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { WebView } from 'react-native-webview';

import { isReceivedFile, shareFile } from '../../files';
import { useColors } from '../../theme';

export default function FileScreen() {
  const { uri, title, mime } = useLocalSearchParams<{ uri: string; title?: string; mime?: string }>();
  const c = useColors();
  // ページから受け取って置いたファイルだけを開く（アプリの中のほかのファイルは開かない）
  const local = isReceivedFile(uri);
  const type = mime || 'application/pdf';
  return (
    <>
      <Stack.Screen
        options={{
          title: title ?? '',
          headerRight: () =>
            local ? (
              <Pressable onPress={() => shareFile(uri, type)} accessibilityRole="button" accessibilityLabel="保存・共有" hitSlop={8}>
                <SymbolView name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} size={19} weight="semibold" tintColor={c.text} />
              </Pressable>
            ) : null,
        }}
      />
      {local && (
        <WebView
          source={{ uri }}
          originWhitelist={['file://*']}
          javaScriptEnabled={false}
          style={[styles.web, { backgroundColor: c.background }]}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  web: {
    flex: 1,
  },
});
