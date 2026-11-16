import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { MyApp } from '../api/myApps';
import { displayName } from '../knownApps';
import { sizes, useColors, type Colors } from '../theme';
import { AppIcon } from './AppIcon';

/**
 * 一覧の1行。使う人に要るのは「どのアプリか」だけなので、アイコン・名前・説明だけを出す。
 * 版・リリース日・稼働中 / 開発中は出さない（作る人向けの情報で、「稼働中」と「開発中」が並ぶと矛盾して見える）。
 * 使えないアプリにだけ「停止中」を出す。名前と一言は、知っているアプリなら短いもの（src/knownApps.ts）。
 * 一覧は、角の丸い1枚のカードに行を並べる（iOS の設定アプリと同じ）。first・last で、カードの上下の角を丸める。
 */
export function MyAppRow({ app, onPress, first, last }: { app: MyApp; onPress: () => void; first: boolean; last: boolean }) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { name, subtitle: description } = displayName(app);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}を起動`}
      accessibilityHint={description || undefined}
      style={({ pressed }) => [styles.row, first && styles.first, last && styles.last, pressed && styles.rowPressed]}
    >
      <AppIcon icon={app.icon} appId={app.logicName} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {description !== '' && (
          <Text style={styles.description} numberOfLines={1}>
            {description}
          </Text>
        )}
      </View>
      {!app.isAvailable && <Text style={[styles.tag, styles.stopped]}>停止中</Text>}
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={13}
        weight="semibold"
        tintColor={c.textSecondary}
      />
    </Pressable>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 68,
      paddingVertical: 12,
      paddingLeft: 16,
      paddingRight: 16,
      marginHorizontal: 16,
      backgroundColor: c.card,
    },
    first: {
      borderTopLeftRadius: sizes.cardRadius,
      borderTopRightRadius: sizes.cardRadius,
    },
    last: {
      borderBottomLeftRadius: sizes.cardRadius,
      borderBottomRightRadius: sizes.cardRadius,
    },
    rowPressed: {
      backgroundColor: c.pressed,
    },
    body: {
      flex: 1,
      gap: 3,
    },
    name: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
    },
    description: {
      fontSize: 14,
      color: c.textSecondary,
    },
    tag: {
      fontSize: 11,
      fontWeight: '600',
      borderRadius: 6,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    stopped: {
      color: c.stopped.text,
      backgroundColor: c.stopped.background,
    },
  });
}
