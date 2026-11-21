// 端末の歩数の記録（iPhone はヘルスケア、Android はヘルスコネクト）から、1日の歩数を読む（Walk the Talk の歩数の登録に入れる）。
// 読むだけで、書き込まない。
//
// 中身はこのアプリだけの小さな部品（modules/health。iPhone は HealthKit を Swift で、Android は Health Connect を Kotlin で使う）。
// どちらも同じ名前の関数を持つので、ここから先は端末を区別しない。
// Expo Go にはこの部品がないので、Expo Go では「使えない」になる（歩数は手で打つ、今までどおり）。
import { requireOptionalNativeModule } from 'expo';

type HealthModule = {
  /** 歩数を読む先の呼び名（「ヘルスケア」「ヘルスコネクト」） */
  readonly sourceName?: string;
  isAvailable(): boolean;
  requestStepsAccess(): Promise<boolean>;
  stepsOnDay(day: string): Promise<number>;
};

const native = requireOptionalNativeModule<HealthModule>('MyAppHealth');

/** 歩数を読む許可を求めるのは1回だけ（1週間ぶんを続けて聞いても、許可の画面は1つ） */
let access: Promise<boolean> | null = null;

/** 歩数を読む先の呼び名（ページの知らせに出す）。部品が名乗らなければ「ヘルスケア」 */
export function healthSourceName(): string {
  return native?.sourceName || 'ヘルスケア';
}

/** この端末で、歩数の記録から歩数を読めるか（Expo Go・記録のない端末・Android でヘルスコネクトが入っていない端末では false） */
export function healthAvailable(): boolean {
  try {
    return native !== null && native.isAvailable();
  } catch {
    return false;
  }
}

/**
 * その日（"yyyy-MM-dd"、端末の暦の 0:00〜24:00）の歩数の合計。読めなければ null。
 * 初めてのときは、端末が「歩数を読んでよいか」を聞く。断られていると 0 を返す（iOS は断られたことを教えない。Android も合わせて 0）
 */
export async function stepsOn(day: string): Promise<number | null> {
  if (!native || !healthAvailable() || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  try {
    access ??= native.requestStepsAccess();
    await access;
    return await native.stepsOnDay(day);
  } catch (e) {
    access = null; // 次はもう一度許可を求める
    console.log(`[health] NG ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
