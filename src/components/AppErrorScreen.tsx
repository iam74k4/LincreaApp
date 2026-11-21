// 画面を描く途中で思わぬエラーが起きたときに、アプリごと落ちる代わりに出す画面（src/app/_layout.tsx の ErrorBoundary）。
// 「もう一度試す」で描き直す。直らないときに問い合わせてもらえるよう、版の名前（ビルド番号・コミット）を出す。
// エラーの文は、描き方のまちがいの文（英語）で、個人の情報は入らない。長すぎるものは切る。
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { versionLabel } from '../core/appVersion';
import { sizes, useColors } from '../core/theme';

type Props = {
  error: Error;
  retry: () => Promise<void>;
};

/** 画面に出すエラーの文の長さの上限 */
const MAX_DETAIL = 200;

export function AppErrorScreen({ error, retry }: Props) {
  const c = useColors();
  const detail = (error?.message ?? String(error)).slice(0, MAX_DETAIL);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          表示できませんでした
        </Text>
        <Text style={[styles.message, { color: c.textSecondary }]}>
          もう一度試してください。直らないときは、下の版の名前と、この画面のことを管理者に伝えてください。
        </Text>
        <Pressable
          onPress={() => {
            retry().catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel="もう一度試す"
          style={({ pressed }) => [styles.button, { backgroundColor: c.accent }, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, { color: c.onAccent }]}>もう一度試す</Text>
        </Pressable>
        <Text style={[styles.detail, { color: c.textSecondary }]} selectable>
          {detail}
        </Text>
        <Text style={[styles.detail, { color: c.textSecondary }]} selectable>
          {versionLabel()}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    height: sizes.control,
    borderRadius: sizes.control / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  detail: {
    fontSize: 12,
    textAlign: 'center',
  },
});
