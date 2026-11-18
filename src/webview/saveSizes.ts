// 保存（登録・削除など）が何段の書き込みでできているかを、画面とボタンごとに覚える。
// 次に同じ保存をするとき「保存しています（3/9）」の 9 と、進み具合の棒の長さに使う（src/components/SaveProgress.tsx）。
//
// 覚えるのは数だけ（書き込みの段の数・通信の数）。データの中身は置かない。
// 段の数は、入力によって少し変わる（プロジェクトの行が多いと増える）。最後に保存できたときの数を使う。
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SaveSize = {
  /** 書き込みの段の数（トランザクションの始め・書き込み・確定）。「保存しています（3/9）」の 9 */
  writes: number;
  /** 読み込みも含めた、通信の数（進み具合の棒に使う） */
  steps: number;
};

const STORAGE_KEY = 'myapp.saveSizes.v1';
const KEEP = 60; // 覚えておく数（画面とボタンの組）

// 測ったもの（2026-11-18、勤怠実績登録）。初めての保存でも数を出せるように
const MEASURED: Record<string, SaveSize> = {
  'frmAttendanceDtl:登録': { writes: 9, steps: 37 },
  'frmAttendanceDtl:削除': { writes: 9, steps: 41 },
};

let sizes: Record<string, SaveSize> = { ...MEASURED };
let loading: Promise<void> | null = null;

/** 端末に覚えておいた数を読む（アプリを開いてから1回だけ） */
export function loadSaveSizes(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((text) => {
      const saved = text ? (JSON.parse(text) as unknown) : null;
      if (!saved || typeof saved !== 'object') return;
      for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
        if (isSize(value)) sizes[key] = value;
      }
    })
    .catch(() => {});
  return loading;
}

/** 画面（URL の /runapp/アプリ/画面/）と、押した書き込みのボタンの名前から、覚える名前を作る */
export function saveKey(uri: string, label: string): string {
  const form = /\/runapp\/[^/]+\/([^/?#]+)/.exec(uri)?.[1] ?? '';
  return `${decodeURIComponent(form)}:${label}`;
}

/** 前に保存できたときの数（知らなければ null） */
export function saveSizeOf(key: string): SaveSize | null {
  return sizes[key] ?? null;
}

/** 保存できたときの数を覚える */
export function rememberSaveSize(key: string, size: SaveSize): void {
  if (!isSize(size) || size.writes === 0) return;
  // 新しく覚えたものを最後に置き、多すぎたら古いものから捨てる
  const next = { ...sizes };
  delete next[key];
  next[key] = { writes: size.writes, steps: size.steps };
  const keys = Object.keys(next);
  for (const old of keys.slice(0, Math.max(0, keys.length - KEEP))) delete next[old];
  sizes = next;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sizes)).catch(() => {});
}

/** 「保存しています（3/9）」の文。前の数を知らなければ「保存しています」だけ */
export function savingText(writes: number, size: SaveSize | null): string {
  if (!size) return '保存しています';
  return `保存しています（${Math.min(writes, size.writes)}/${size.writes}）`;
}

/** 進み具合の棒の長さ（0〜1）。終わるまでは 1 にしない。前の数を知らなければ null（棒を出さない） */
export function saveProgress(steps: number, size: SaveSize | null): number | null {
  if (!size || size.steps <= 0) return null;
  return Math.min(steps / size.steps, 0.95);
}

function isSize(value: unknown): value is SaveSize {
  if (!value || typeof value !== 'object') return false;
  const { writes, steps } = value as Record<string, unknown>;
  return Number.isInteger(writes) && Number.isInteger(steps) && (writes as number) >= 0 && (steps as number) >= 0 && (steps as number) < 10_000;
}

/** 開発中に Metro に出す、保存の測り結果の1行（かかった時間・通信の数・時間のかかった通信）。データの中身は含まない */
export function describeSave(
  key: string,
  end: { ok: boolean; steps: number; writes: number; ms: number },
  log: { cmd: string; ms: number }[],
): string {
  const [form, label] = key.split(':');
  const sec = (ms: number) => `${(ms / 1000).toFixed(1)}秒`;
  const slow = log.filter((step) => step.ms >= 300).map((step) => `${step.cmd} ${sec(step.ms)}`);
  return (
    `[保存] ${form}「${label || '?'}」 ${end.ok ? '' : '失敗・取り消し '}${sec(end.ms)}・通信 ${end.steps} 回（書き込み ${end.writes}）` +
    (slow.length > 0 ? `・時間のかかった通信: ${slow.join('、')}` : '')
  );
}
