import type { MyApp } from '../models/myApp';
import { appOrder, displayName, knownApp } from '../myApps/knownApps';

/** サーバーが決める、アプリケーション ID（logicName）だけが違う、作り物のアプリ */
function app(logicName: string): MyApp {
  return { logicName, name: '元の名前', description: '元の説明' } as MyApp;
}

describe('knownApp: 知っているアプリ', () => {
  it('知っているアプリケーション ID は引ける', () => {
    expect(knownApp('L_Tims')).toMatchObject({ name: '勤怠 TiMS', icon: 'clock-person' });
  });

  it('知らない・ない ID は引かない', () => {
    expect(knownApp('L_Unknown')).toBeUndefined();
    expect(knownApp(undefined)).toBeUndefined();
  });

  it('object の継承のもの（constructor・toString・__proto__）は、知っているアプリにしない', () => {
    for (const id of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(knownApp(id)).toBeUndefined();
      expect(displayName(app(id))).toEqual({ name: '元の名前', subtitle: '元の説明' });
      expect(appOrder(app(id))).toBe(99);
    }
  });
});
