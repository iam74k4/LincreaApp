// 画面を開くときの「指示」（近道で順に押すボタン・入力欄に入れておく値）を、アプリの中だけで受け渡す預かり所。
//
// 指示を画面の引数（URL）に書くと、外からのリンクでも同じ指示が書けてしまい、
// リンク1つでボタンを押させたり、入力させたりできる（src/app/+native-intent.tsx でも止めている）。
// そこで、指示はここ（メモリの中）に置いて、推測できない番号だけを渡す。番号のない・知らない指示は使わない。
import { randomUUID } from 'expo-crypto';

import { shortValues } from '../core/shortValues';

export type Launch = {
  /** 近道: 順に押すボタンの部品 ID */
  steps?: string[];
  /** 押し始める前に、App.data に入るのを待つデータの名前 */
  ready?: string;
  /** 待つあいだに出す名前 */
  label?: string;
  /** 入力欄に入れておく値（ページの側で window.__myappPrefill として受け取る） */
  prefill?: Record<string, string>;
};

const store = new Map<string, Launch>();
const KEEP = 8; // 持っておく数（画面を重ねる深さより多く）

/** 指示を預けて、渡す番号を返す */
export function depositLaunch(launch: Launch): string {
  const id = randomUUID();
  store.set(id, launch);
  while (store.size > KEEP) store.delete(store.keys().next().value as string);
  return id;
}

/** ログアウトしたとき: すべて捨てる（入れておく値に、前の人の入力が入っている） */
export function forgetAllLaunches(): void {
  store.clear();
}

/**
 * 番号から指示を取り出す（知らない番号なら null）。
 * 取り出しても消さない（開発中の再読み込みなどで画面が作り直されたときに、もう一度取り出せるように）
 */
export function takeLaunch(id: string | undefined): Launch | null {
  if (!id) return null;
  const launch = store.get(id);
  if (!launch) return null;
  return {
    steps: launch.steps?.filter((s) => /^[A-Za-z0-9_]{1,120}$/.test(s)),
    ready: launch.ready,
    label: launch.label,
    prefill: prefillOf(launch.prefill),
  };
}

/** 入れておく値: 短い文字だけ（src/core/shortValues.ts）。なければ undefined */
function prefillOf(values: Record<string, string> | undefined): Record<string, string> | undefined {
  const out = shortValues(values);
  return Object.keys(out).length > 0 ? out : undefined;
}

