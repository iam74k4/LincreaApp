import { StyleSheet, View } from 'react-native';

import type { AppIconSpec } from '../models/myApp';
import { Icon, type IconName } from '../platform/icons';
import { knownApp } from '../myApps/knownApps';
import { useColors } from '../core/theme';

// Web 版は FontAwesome のアイコン名で指定してくる。アプリのアイコン（src/platform/icons.tsx）に置き換える。
// 知らない名前は、四角が並んだ「アプリ」のアイコンにする。
// 知っているアプリは、中身に合ったアイコンにする（src/myApps/knownApps.ts）。
// 色は、どのアプリも同じ「薄い青の地に青い線」でそろえる（アプリごとに色を変えると、並べたときにまとまりがない。src/core/theme.ts）。
const ICONS: Record<string, IconName> = {
  desktop: 'desktop',
  'street-view': 'walk',
};
const FALLBACK: IconName = 'app';

/** Web 版のアイコン名から引く。名前はサーバーが決めるので、object の継承のもの（constructor など）は引かない */
function iconOf(name: string): IconName {
  return Object.hasOwn(ICONS, name) ? ICONS[name] : FALLBACK;
}

/** 薄い青の四角に、青い線のアイコンをのせる（知らないアプリは Web 版のアイコン） */
export function AppIcon({ icon, appId, size = 30 }: { icon: AppIconSpec; appId?: string; size?: number }) {
  const c = useColors();
  const known = knownApp(appId);
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.27), backgroundColor: c.iconTile }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name={known?.icon ?? iconOf(icon.name)} size={size * 0.6} tintColor={c.iconGlyph} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
