// iPhone のヘルスケアから、1日の歩数を読む（Walk the Talk の歩数の登録に入れる）。読むだけで、書き込まない。
//
// 中身はこのアプリだけの小さな部品（modules/health。HealthKit を Swift で使う）。
// Expo Go にはこの部品がないので、Expo Go では「使えない」になる（歩数は手で打つ、今までどおり）。
import { requireOptionalNativeModule } from 'expo';

type HealthModule = {
  isAvailable(): boolean;
  requestStepsAccess(): Promise<boolean>;
  stepsOnDay(day: string): Promise<number>;
};

const native = requireOptionalNativeModule<HealthModule>('MyAppHealth');

/** 歩数を読む許可を求めるのは1回だけ（1週間ぶんを続けて聞いても、iOS の許可の画面は1つ） */
let access: Promise<boolean> | null = null;

/** この端末で、ヘルスケアから歩数を読めるか（Expo Go・ヘルスケアのない端末では false） */
export function healthAvailable(): boolean {
  try {
    return native !== null && native.isAvailable();
  } catch {
    return false;
  }
}

/**
 * その日（"yyyy-MM-dd"、端末の暦の 0:00〜24:00）の歩数の合計。読めなければ null。
 * 初めてのときは、iOS が「歩数を読んでよいか」を聞く。断られていると、iOS は理由を言わずに 0 を返す
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
