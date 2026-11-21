// マイアプリの一覧の控え（端末に置く）。起動したときに、サーバーに聞き終わるのを待たずに、前回の一覧をすぐ出すため。
//
// ログインが確かめられたあと（マイアプリの画面が出たあと）にだけ使う。出した一覧は、サーバーの返事が来たら入れ替える。
// 聞けなかったとき（電波がないなど）は、控えの一覧を引っ込めて「つながっていません」を出す（古い一覧のまま使わせない）。
// 人ごとに置き（ほかの人の一覧は出さない）、ログアウトで消す。中身はアプリの名前・アイコン・説明だけ（個人のデータはない）。
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MyApp } from './myApps';

const KEY = 'myApps.cache';
/** これより古い控えは使わない（長く使っていなかったときは、古い一覧を一瞬でも見せない） */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = { username: string; savedAt: number; apps: unknown[] };

function isApp(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const icon = v.icon as Record<string, unknown> | null;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.logicName === 'string' &&
    typeof v.formName === 'string' &&
    typeof v.description === 'string' &&
    typeof v.isAvailable === 'boolean' &&
    typeof v.isDeveloping === 'boolean' &&
    typeof v.releaseId === 'string' &&
    typeof v.releaseNotes === 'string' &&
    (v.releasedAt === null || typeof v.releasedAt === 'string') &&
    !!icon &&
    typeof icon.name === 'string' &&
    typeof icon.color === 'string' &&
    typeof icon.background === 'string'
  );
}

/** その人の、前回の一覧（なければ・古すぎれば・壊れていれば null） */
export async function loadCachedApps(username: string, now: number = Date.now()): Promise<MyApp[] | null> {
  if (!username) return null;
  try {
    const stored = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') as Stored | null;
    if (!stored || stored.username !== username || typeof stored.savedAt !== 'number' || now - stored.savedAt > MAX_AGE_MS) return null;
    if (!Array.isArray(stored.apps) || !stored.apps.every(isApp)) return null;
    return stored.apps.map((a) => {
      const app = a as unknown as Omit<MyApp, 'releasedAt'> & { releasedAt: string | null };
      return { ...app, releasedAt: app.releasedAt ? new Date(app.releasedAt) : null };
    });
  } catch {
    return null;
  }
}

/** サーバーから読んだ一覧を控える（失敗しても何もしない） */
export function saveCachedApps(username: string, apps: MyApp[], now: number = Date.now()): void {
  if (!username) return;
  const stored: Stored = { username, savedAt: now, apps };
  AsyncStorage.setItem(KEY, JSON.stringify(stored)).catch(() => {});
}

/** ログアウトしたとき */
export function forgetCachedApps(): void {
  AsyncStorage.removeItem(KEY).catch(() => {});
}
