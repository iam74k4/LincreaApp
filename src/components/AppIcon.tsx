import { StyleSheet, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import type { AppIconSpec } from '../api/myApps';
import { KNOWN_APPS } from '../knownApps';

// Web 版は FontAwesome のアイコン名で指定してくる。端末のアイコン（SF Symbols / Material Symbols）に置き換える。
// 知らない名前は、四角が並んだ「アプリ」のアイコンにする。
// 知っているアプリは、中身に合ったアイコンと色にする（src/knownApps.ts）。
const SYMBOLS: Record<string, SymbolViewProps['name']> = {
  desktop: { ios: 'desktopcomputer', android: 'desktop_windows', web: 'desktop_windows' },
  'street-view': { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
};
const FALLBACK: SymbolViewProps['name'] = { ios: 'app.fill', android: 'apps', web: 'apps' };

/** 色の付いた四角に、アイコンをのせる（知らないアプリは Web 版と同じ色とアイコン） */
export function AppIcon({ icon, appId, size = 44 }: { icon: AppIconSpec; appId?: string; size?: number }) {
  const known = appId ? KNOWN_APPS[appId] : undefined;
  return (
    <View
      style={[styles.tile, { width: size, height: size, backgroundColor: known?.background ?? icon.background }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <SymbolView
        name={known?.symbol ?? SYMBOLS[icon.name] ?? FALLBACK}
        size={size * 0.5}
        tintColor={known ? '#FFFFFF' : icon.color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
