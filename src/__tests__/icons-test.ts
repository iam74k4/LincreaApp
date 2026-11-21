import { readFileSync } from 'fs';
import { join } from 'path';

import { ICON_NAMES, symbolName } from '../platform/icons';
import { KNOWN_APPS } from '../myApps/knownApps';
import { SHORTCUTS } from '../shortcuts/shortcuts';

/** 端末ごとの名前を、使う人が見分けられる形で固定する（入れ替え・綴り違いに気づくため） */
const EXPECTED: Record<string, { ios: string; android: string }> = {
  close: { ios: 'xmark', android: 'close' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  'sign-out': { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  back: { ios: 'chevron.backward', android: 'arrow_back' },
  'chevron-forward': { ios: 'chevron.right', android: 'chevron_right' },
  eye: { ios: 'eye', android: 'visibility' },
  'eye-off': { ios: 'eye.slash', android: 'visibility_off' },
  face: { ios: 'faceid', android: 'face' },
  fingerprint: { ios: 'touchid', android: 'fingerprint' },
  'error-filled': { ios: 'exclamationmark.circle.fill', android: 'error' },
  'check-filled': { ios: 'checkmark.circle.fill', android: 'check_circle' },
  offline: { ios: 'wifi.slash', android: 'wifi_off' },
  'server-error': { ios: 'exclamationmark.icloud', android: 'cloud_off' },
  app: { ios: 'app.fill', android: 'apps' },
  desktop: { ios: 'desktopcomputer', android: 'desktop_windows' },
  walk: { ios: 'figure.walk', android: 'directions_walk' },
  'clock-person': { ios: 'person.badge.clock.fill', android: 'schedule' },
  yen: { ios: 'yensign.circle.fill', android: 'currency_yen' },
  bank: { ios: 'building.columns.fill', android: 'description' },
  heart: { ios: 'heart.fill', android: 'favorite' },
  graduation: { ios: 'graduationcap.fill', android: 'school' },
  'calendar-clock': { ios: 'calendar.badge.clock', android: 'calendar_month' },
  timer: { ios: 'timer', android: 'more_time' },
  'sun-beach': { ios: 'sun.max.fill', android: 'beach_access' },
  'document-add': { ios: 'doc.text.fill', android: 'post_add' },
};

describe('アイコンの名前（src/platform/icons.tsx）', () => {
  it('どのアイコンも、iPhone と Android の名前が決めたとおり。Web は Android と同じ', () => {
    expect([...ICON_NAMES].sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const name of ICON_NAMES) {
      const { ios, android } = EXPECTED[name];
      expect(symbolName(name)).toEqual({ ios, android, web: android });
    }
  });

  it('Android の名前は、どれも Material Symbols にある（綴り違いだと、Android だけ何も出ない）', () => {
    // expo-symbols は中のファイルを外から import させない（exports）ので、ファイルとして読む
    const file = join(process.cwd(), 'node_modules/expo-symbols/build/android/symbols.json');
    const known = new Set(Object.keys(JSON.parse(readFileSync(file, 'utf8')) as Record<string, number>));
    for (const name of ICON_NAMES) {
      expect(known.has(EXPECTED[name].android)).toBe(true);
    }
  });

  it('知っているアプリと近道が使うアイコンは、どれも表にある', () => {
    const used = [...Object.values(KNOWN_APPS).map((a) => a.icon), ...SHORTCUTS.map((s) => s.icon)];
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) expect(ICON_NAMES).toContain(name);
  });
});
