// ページから受け取った PDF（給与明細・住民税の通知書など）を、アプリの画面として見せる。
// 左上の戻るボタンで戻る（ほかの画面と同じ）。右上のボタンから、「ファイル」に保存・プリント・共有ができる。
//
// 前は iPhone の標準のプレビュー（Quick Look）で見せていた。iOS 26 では閉じるボタンが右上にあり、
// Expo Go の歯車のボタンに隠れて、閉じられない（戻れない）ことがあったので、アプリの画面にそろえた。
// ファイルはアプリの一時的な場所にある（src/platform/files.ts。古いものは消し、ログアウトでもすべて消す）。
// ルートは src/app/(app)/file.tsx（画面の引数を受け取って、ここに渡す）。
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Stack, useRoute } from 'expo-router';
import { WebView } from 'react-native-webview';

import { usePrivacyScreen } from '../components/usePrivacyScreen';
import { holdFile, isReceivedFile, shareFile } from '../platform/files';
import { Icon } from '../platform/icons';
import { useColors } from '../core/theme';

type Props = {
  /** 受け取って置いたファイル（file://）。置き場の外のものは開かない */
  uri: string;
  /** 上のヘッダーに出す名前 */
  title?: string;
  /** 中身の種類（なければ PDF） */
  mime?: string;
};

export function FileScreen({ uri, title, mime }: Props) {
  const c = useColors();
  // 受け取るのは給与明細・住民税の通知書などなので、アプリの切り替え画面に中身を写さない
  usePrivacyScreen(true, useRoute().key);
  // 見ているあいだは、古くなってもファイルを消さない（共有のボタンが使えるように。src/platform/files.ts）
  useEffect(() => holdFile(uri), [uri]);
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
                <Icon name="share" size={19} weight="semibold" tintColor={c.text} />
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
