// 知っているアプリ（アプリケーション ID で決める）の、見せ方。
//
// Web 版の名前は正式名で長く（「情報処理試験資格取得者検索」）、説明は名前の繰り返しや英語のことが多い。
// スマホの一覧では、短い名前と「何ができるか」の一言にする。検索は正式名でも当たる（マイアプリの画面）。
// アイコンも、Web 版では多くが同じ（青い四角にパソコン）で見分けがつかないので、中身に合ったものと色にする。
import type { MyApp } from '../models/myApp';
import type { IconName } from '../platform/icons';

export type KnownApp = {
  /** 一覧に出す名前と、その一言（一言は画面には出さず、読み上げのヒントに使う） */
  name: string;
  subtitle: string;
  icon: IconName;
  /** 一覧に並べる順（小さいほど上。よく使うものを上に） */
  order: number;
};

export const KNOWN_APPS: Record<string, KnownApp> = {
  L_Tims: {
    name: '勤怠 TiMS',
    subtitle: '勤務表・各種申請',
    icon: 'clock-person',
    order: 1,
  },
  L_Payslip: {
    name: '給与・賞与明細',
    subtitle: '毎月の明細を見る',
    icon: 'yen',
    order: 2,
  },
  L_Payslip_Juminzei: {
    name: '住民税の通知書',
    subtitle: '特別徴収税額の通知書を取得',
    icon: 'bank',
    order: 4,
  },
  L_HealthCare: {
    name: '健康診断',
    subtitle: '予約と結果',
    icon: 'heart',
    order: 3,
  },
  L_ITEE: {
    name: '資格取得者の検索',
    subtitle: '情報処理技術者試験',
    icon: 'graduation',
    order: 5,
  },
  YIF_walk_the_talk: {
    name: 'Walk the Talk',
    subtitle: '歩数とポイント',
    icon: 'walk',
    order: 6,
  },
};

/** 知っているアプリ。アプリケーション ID はサーバーが決めるので、object の継承のもの（constructor など）は引かない */
export function knownApp(appId: string | undefined): KnownApp | undefined {
  return appId !== undefined && Object.hasOwn(KNOWN_APPS, appId) ? KNOWN_APPS[appId] : undefined;
}

/** 一覧に並べる順（知っているアプリはよく使う順。知らないアプリは、そのあとに Web 版の順で） */
export function appOrder(app: MyApp): number {
  return knownApp(app.logicName)?.order ?? 99;
}

/** 一覧に出す名前と一言。知らないアプリは Web 版のまま（説明が名前と同じなら一言は出さない） */
export function displayName(app: MyApp): { name: string; subtitle: string } {
  const known = knownApp(app.logicName);
  if (known) return { name: known.name, subtitle: known.subtitle };
  return { name: app.name, subtitle: app.description.trim() === app.name.trim() ? '' : app.description };
}
