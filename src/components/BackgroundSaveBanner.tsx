// 裏で続けている保存の知らせ。画面の上（ヘッダーのすぐ下）に、小さく出す（src/webview/backgroundSaves.ts）。
//   保存中:  くるくる ＋「勤怠実績登録を保存しています（3/9）」（小さなカプセル）
//   終わり:  ✓ ＋「勤怠実績登録を保存しました」（同じカプセル。少しして消える）。ページが申請を開こうとしていたら「残業申請を開く」
//   失敗:    同じ見た目のカード。！＋「保存できませんでした」と、何が起きて、どうすればよいか（src/webview/saveErrors.ts）。
//            右上の × で閉じる。「開き直す」で同じ画面をもう一度開く（保存は取り消されているので、入力し直してもらう）
// どの画面の上にも出るので、押せるのはボタンだけにする（ほかの所は、下の画面を押せるようにしておく）。
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openApplication } from '../openShortcut';
import { SHORTCUTS } from '../shortcuts';
import { useColors } from '../theme';
import { dismissBanner, useSaves } from '../webview/backgroundSaves';
import { describeSaveFailure } from '../webview/saveErrors';

/** ヘッダー（戻るボタンと名前の行）の高さ。知らせはその下に出す */
const HEADER_HEIGHT = 54;

export function BackgroundSaveBanner() {
  const c = useColors();
  const { banner } = useSaves();
  if (!banner) return null;

  // 失敗: 理由とボタンが入るので、カプセルを横いっぱいのカードに広げる（形・色・影は同じ）
  if (banner.state === 'failed') {
    const title = `${banner.title}を保存できませんでした`;
    const failure = describeSaveFailure(banner.error);
    const reopen = banner.reopen;
    return (
      <Shell card label={`${title}。${failure.reason}${failure.next}`}>
        <View style={styles.head}>
          <SymbolView name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }} size={20} tintColor={c.danger} />
          <Text style={[styles.text, styles.grow, { color: c.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Pressable onPress={dismissBanner} accessibilityRole="button" accessibilityLabel="閉じる" hitSlop={12} style={styles.close}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={13} weight="semibold" tintColor={c.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={[styles.detail, { color: c.text }]}>{failure.reason}</Text>
          <Text style={[styles.detail, { color: c.textSecondary }]}>{failure.next}</Text>
        </View>
        {reopen && (
          <BannerButton
            title="開き直す"
            trailing
            onPress={() => {
              dismissBanner();
              router.push({ pathname: reopen.pathname, params: reopen.params } as Href);
            }}
          />
        )}
      </Shell>
    );
  }

  const apply = banner.state === 'done' ? banner.apply : null;
  const applyTitle = apply ? (SHORTCUTS.find((s) => s.direct.form === apply.form)?.title ?? '申請') : null;
  const text = banner.state === 'saving' ? `${banner.title}を${banner.text}` : `${banner.title}を保存しました`;

  return (
    <Shell label={text}>
      {banner.state === 'saving' ? (
        <ActivityIndicator size="small" color={c.textSecondary} />
      ) : (
        <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={20} tintColor={c.available.text} />
      )}
      <Text style={[styles.text, styles.shrink, { color: c.text }]} numberOfLines={2}>
        {text}
      </Text>
      {apply && applyTitle && (
        <BannerButton
          title={`${applyTitle}を開く`}
          onPress={() => {
            dismissBanner();
            openApplication(apply.form, apply.prefill);
          }}
        />
      )}
    </Shell>
  );
}

/** 知らせの外側（ヘッダーのすぐ下に浮かぶ、カプセル。card なら横いっぱいのカード）。押せるのは中のボタンだけ */
function Shell({ card = false, label, children }: { card?: boolean; label: string; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { top: insets.top + HEADER_HEIGHT }]} pointerEvents="box-none">
      <View
        style={[styles.pill, card && styles.card, { backgroundColor: c.card, borderColor: c.separator }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={label}
      >
        {children}
      </View>
    </View>
  );
}

/** 知らせの中の小さなボタン（「開き直す」「残業申請を開く」）。trailing なら、カードの右下に置く */
function BannerButton({ title, onPress, trailing = false }: { title: string; onPress: () => void; trailing?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.button, trailing && styles.trailing, { backgroundColor: pressed ? c.pressed : c.fill }]}
    >
      <Text style={[styles.buttonText, { color: c.accent }]}>{title}</Text>
    </Pressable>
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
    paddingHorizontal: 14,
    borderRadius: 22,
    // ダークでは影が見えず、後ろのカードと同じ色で境目が分からないので、細い縁も付ける
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.14)',
  },
  // 失敗のカード: カプセルと同じ形のまま、縦に並べて横いっぱいに広げる（はみ出して端が切れないように）
  card: {
    flexDirection: 'column',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 6,
    paddingTop: 12,
    paddingBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  body: {
    // 題名の文字の頭にそろえる（！の幅 20 ＋ すき間 10）
    paddingLeft: 30,
    paddingRight: 4,
    gap: 2,
  },
  grow: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  close: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    marginLeft: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  trailing: {
    alignSelf: 'flex-end',
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
