import { StyleSheet, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import type { AppIconSpec } from '../api/myApps';
import { KNOWN_APPS } from '../knownApps';
import { useColors } from '../theme';

// Web 版は FontAwesome のアイコン名で指定してくる。端末のアイコン（SF Symbols / Material Symbols）に置き換える。
// 知らない名前は、四角が並んだ「アプリ」のアイコンにする。
// 知っているアプリは、中身に合ったアイコンにする（src/knownApps.ts）。
// 色は、どのアプリも同じ「薄い青の地に青い線」でそろえる（アプリごとに色を変えると、並べたときにまとまりがない。src/theme.ts）。
const SYMBOLS: Record<string, SymbolViewProps['name']> = {
  desktop: { ios: 'desktopcomputer', android: 'desktop_windows', web: 'desktop_windows' },
  'street-view': { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
};
const FALLBACK: SymbolViewProps['name'] = { ios: 'app.fill', android: 'apps', web: 'apps' };

/** 薄い青の四角に、青い線のアイコンをのせる（知らないアプリは Web 版のアイコン） */
export function AppIcon({ icon, appId, size = 30 }: { icon: AppIconSpec; appId?: string; size?: number }) {
  const c = useColors();
  const known = appId ? KNOWN_APPS[appId] : undefined;
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.27), backgroundColor: c.iconTile }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <SymbolView
        name={known?.symbol ?? SYMBOLS[icon.name] ?? FALLBACK}
        size={size * 0.6}
        tintColor={c.iconGlyph}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
