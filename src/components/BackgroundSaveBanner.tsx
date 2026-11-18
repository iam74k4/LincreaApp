// 裏で続けている保存の知らせ。画面の上（ヘッダーのすぐ下）に、小さく出す（src/webview/backgroundSaves.ts）。
//   保存中:  くるくる ＋「勤怠実績登録を保存しています（3/9）」
//   終わり:  ✓ ＋「勤怠実績登録を保存しました」（少しして消える）。ページが申請を開こうとしていたら「残業申請を開く」
//   失敗:    ！＋「保存できませんでした」と、ページが出したエラーの文。「開き直す」で同じ画面をもう一度開く
//            （保存は取り消されているので、入力し直してもらう）
// どの画面の上にも出るので、押せるのはボタンだけにする（ほかの所は、下の画面を押せるようにしておく）。
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openApplication } from '../openShortcut';
import { SHORTCUTS } from '../shortcuts';
import { useColors } from '../theme';
import { dismissBanner, useSaves } from '../webview/backgroundSaves';

/** ヘッダー（戻るボタンと名前の行）の高さ。知らせはその下に出す */
const HEADER_HEIGHT = 54;

export function BackgroundSaveBanner() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { banner } = useSaves();
  if (!banner) return null;

  const applyTitle = banner.apply ? (SHORTCUTS.find((s) => s.direct.form === banner.apply?.form)?.title ?? '申請') : null;
  const text =
    banner.state === 'saving'
      ? `${banner.title}を${banner.text}`
      : banner.state === 'done'
        ? `${banner.title}を保存しました`
        : `${banner.title}を保存できませんでした`;

  return (
    <View style={[styles.wrap, { top: insets.top + HEADER_HEIGHT }]} pointerEvents="box-none">
      <View
        style={[styles.pill, { backgroundColor: c.card }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={text}
      >
        {banner.state === 'saving' ? (
          <ActivityIndicator size="small" color={c.textSecondary} />
        ) : (
          <SymbolView
            name={
              banner.state === 'done'
                ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
                : { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }
            }
            size={20}
            tintColor={banner.state === 'done' ? c.available.text : c.danger}
          />
        )}
        <View style={styles.texts}>
          <Text style={[styles.text, { color: c.text }]} numberOfLines={2}>
            {text}
          </Text>
          {banner.state === 'failed' && (
            <Text style={[styles.detail, { color: c.textSecondary }]} numberOfLines={3}>
              {banner.error ? `${banner.error}\n` : ''}もう一度開いて、入力し直してください
            </Text>
          )}
        </View>
        {banner.state === 'failed' && banner.reopen && (
          <Pressable
            onPress={() => {
              const next = banner.reopen;
              dismissBanner();
              if (next) router.push({ pathname: next.pathname, params: next.params } as Href);
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.button, { backgroundColor: pressed ? c.pressed : c.fill }]}
          >
            <Text style={[styles.buttonText, { color: c.accent }]}>開き直す</Text>
          </Pressable>
        )}
        {banner.state === 'failed' && (
          <Pressable onPress={dismissBanner} accessibilityRole="button" accessibilityLabel="閉じる" hitSlop={10}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} weight="semibold" tintColor={c.textSecondary} />
          </Pressable>
        )}
        {banner.state === 'done' && banner.apply && applyTitle && (
          <Pressable
            onPress={() => {
              const next = banner.apply;
              dismissBanner();
              if (next) openApplication(next.form, next.prefill);
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.button, { backgroundColor: pressed ? c.pressed : c.fill }]}
          >
            <Text style={[styles.buttonText, { color: c.accent }]}>{`${applyTitle}を開く`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 480,
    minHeight: 44,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 22,
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.14)',
  },
  texts: {
    flexShrink: 1,
    gap: 2,
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  button: {
    marginLeft: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
