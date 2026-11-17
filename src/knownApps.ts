// 知っているアプリ（アプリケーション ID で決める）の、見せ方。
//
// Web 版の名前は正式名で長く（「情報処理試験資格取得者検索」）、説明は名前の繰り返しや英語のことが多い。
// スマホの一覧では、短い名前と「何ができるか」の一言にする。検索は正式名でも当たる（マイアプリの画面）。
// アイコンも、Web 版では多くが同じ（青い四角にパソコン）で見分けがつかないので、中身に合ったものと色にする。
import type { SymbolViewProps } from 'expo-symbols';

import type { MyApp } from './api/myApps';

export type KnownApp = {
  /** 一覧に出す名前と、その下の一言 */
  name: string;
  subtitle: string;
  symbol: SymbolViewProps['name'];
  /** アイコンの地の色 */
  background: string;
  /** 一覧に並べる順（小さいほど上。よく使うものを上に） */
  order: number;
};

export const KNOWN_APPS: Record<string, KnownApp> = {
  L_Tims: {
    name: '勤怠 TiMS',
    subtitle: '勤務表・各種申請',
    symbol: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
    background: '#FF9500',
    order: 1,
  },
  L_Payslip: {
    name: '給与・賞与明細',
    subtitle: '毎月の明細を見る',
    symbol: { ios: 'yensign.circle.fill', android: 'currency_yen', web: 'currency_yen' },
    background: '#34C759',
    order: 2,
  },
  L_Payslip_Juminzei: {
    name: '住民税の通知書',
    subtitle: '特別徴収税額の通知書を取得',
    symbol: { ios: 'doc.text.fill', android: 'description', web: 'description' },
    background: '#30B0C7',
    order: 4,
  },
  L_HealthCare: {
    name: '健康診断',
    subtitle: '予約と結果',
    symbol: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
    background: '#FF2D55',
    order: 3,
  },
  L_ITEE: {
    name: '資格取得者の検索',
    subtitle: '情報処理技術者試験',
    symbol: { ios: 'graduationcap.fill', android: 'school', web: 'school' },
    background: '#5856D6',
    order: 5,
  },
  YIF_walk_the_talk: {
    name: 'Walk the Talk',
    subtitle: '歩数とポイント',
    symbol: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
    background: '#A2845E',
    order: 6,
  },
};

/** 一覧に並べる順（知っているアプリはよく使う順。知らないアプリは、そのあとに Web 版の順で） */
export function appOrder(app: MyApp): number {
  return KNOWN_APPS[app.logicName]?.order ?? 99;
}

/** 一覧に出す名前と一言。知らないアプリは Web 版のまま（説明が名前と同じなら一言は出さない） */
export function displayName(app: MyApp): { name: string; subtitle: string } {
  const known = KNOWN_APPS[app.logicName];
  if (known) return { name: known.name, subtitle: known.subtitle };
  return { name: app.name, subtitle: app.description.trim() === app.name.trim() ? '' : app.description };
}
