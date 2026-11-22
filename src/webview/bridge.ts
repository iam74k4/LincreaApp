// ページからアプリへの知らせ（WebView の postMessage）の形と、読み方・受け付ける条件。
// 知らせを送るのは、ページに入れるスクリプト（src/webview/page/bridgeJs.ts。番号 1〜9 の説明もそこにある）。
import { shortValues } from '../core/shortValues';
import type { Handoff } from './handoff';

/** ページからアプリへの知らせ */
export type BridgeMessage =
  | { type: 'close' }
  | { type: 'open'; url: string; handoff: Handoff }
  | { type: 'scroll'; y: number; target: string }
  | { type: 'write'; label: string }
  | { type: 'childRefreshed'; ok: boolean }
  | { type: 'title'; text: string }
  | { type: 'file'; base64: string; name: string; mime: string }
  | { type: 'apply'; form: string; prefill: Record<string, string>; auto: boolean }
  | { type: 'initApp'; app: string; form: string; id: string; text: string }
  | { type: 'applyQueue'; form: string; items: Record<string, string>[] }
  | { type: 'modal'; open: boolean }
  | { type: 'tick' }
  | { type: 'skinMissing'; form: string; ids: string[] }
  | { type: 'steps'; id: string; day: string }
  | { type: 'attendanceDays'; month: string; days: string }
  | { type: 'pwFaceId' }
  | { type: 'pwTyped'; value: string }
  | { type: 'saveStart' }
  | { type: 'saveWait' }
  | { type: 'saveError'; text: string }
  | { type: 'saveStep'; cmd: string; ms: number; ok: boolean; steps: number; writes: number }
  | { type: 'saveEnd'; ok: boolean; steps: number; writes: number; ms: number }
  | { type: 'net'; method: string; path: string; keys: string; at: number; ms: number; status: number; sent: number; received: number; hint: string }
  | { type: 'refMode'; key: string; text: string; contentType: string }
  | { type: 'pageLog'; level: 'error' | 'warn'; text: string }
  | { type: 'urlChange'; url: string }
  | { type: 'ready' };

/** ページから来た数（0 以上の整数で、大きすぎないもの）。違えば null */
function count(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}


export function parseBridgeMessage(data: string): BridgeMessage | null {
  try {
    const message = JSON.parse(data) as Record<string, unknown>;
    if (message.type === 'close') return { type: 'close' };
    if (message.type === 'write') return { type: 'write', label: typeof message.label === 'string' ? message.label.slice(0, 20) : '' };
    // 重ねて開いた画面から戻ったときの、データだけの読み直し（childClosedJs）ができたか
    if (message.type === 'childRefreshed') return { type: 'childRefreshed', ok: message.ok === true };
    // ページが決めた、いまの画面の名前（勤務表のタブなど。空ならアプリが決めた名前に戻す）
    if (message.type === 'title' && typeof message.text === 'string') return { type: 'title', text: message.text.slice(0, 20) };
    if (message.type === 'file' && typeof message.base64 === 'string' && message.base64) {
      const text = (value: unknown, fallback: string) => (typeof value === 'string' && value ? value : fallback);
      return { type: 'file', base64: message.base64, name: text(message.name, ''), mime: text(message.mime, 'application/octet-stream') };
    }
    if (message.type === 'ready') return { type: 'ready' };
    // ページが、読み込まずにアドレスだけ変える（pushState・replaceState）。変わったあとの URL
    if (message.type === 'urlChange' && typeof message.url === 'string') return { type: 'urlChange', url: message.url.slice(0, 2048) };
    // 開発中だけ: ページの通信1回ぶんの記録（NET_TRACE_JS）。パス・クエリの名前・かかった時間・大きさ・名前らしい語だけ
    if (message.type === 'net') {
      const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
      const at = typeof message.at === 'number' && Number.isFinite(message.at) ? message.at : null;
      const ms = count(message.ms, 3_600_000);
      if (at === null || ms === null) return null;
      return {
        type: 'net',
        method: str(message.m, 10),
        path: str(message.p, 120),
        keys: str(message.q, 120),
        at,
        ms,
        status: count(message.s, 999) ?? 0,
        sent: count(message.n, 100_000_000) ?? 0,
        received: count(message.r, 100_000_000) ?? 0,
        hint: str(message.h, 300),
      };
    }
    // 保存の進み具合（SAVE_WATCH_JS）。通信の種類・数・かかった時間だけ
    if (message.type === 'saveStart') return { type: 'saveStart' };
    // ほかの画面の保存が終わるのを待たせた（SAVE_WATCH_JS）
    if (message.type === 'saveWait') return { type: 'saveWait' };
    // 保存に失敗したときに、ページが出したエラーの文（アプリの知らせに出すだけ。200 字まで）
    if (message.type === 'saveError') return { type: 'saveError', text: typeof message.text === 'string' ? message.text.slice(0, 200) : '' };
    if (message.type === 'saveStep') {
      const ms = count(message.ms, 600_000);
      const steps = count(message.steps, 10_000);
      const writes = count(message.writes, 10_000);
      if (typeof message.cmd !== 'string' || !/^[A-Za-z]{1,20}$/.test(message.cmd) || ms === null || steps === null || writes === null) return null;
      return { type: 'saveStep', cmd: message.cmd, ms, ok: message.ok === true, steps, writes };
    }
    if (message.type === 'saveEnd') {
      const ms = count(message.ms, 3_600_000);
      const steps = count(message.steps, 10_000);
      const writes = count(message.writes, 10_000);
      if (ms === null || steps === null || writes === null) return null;
      return { type: 'saveEnd', ok: message.ok === true, steps, writes, ms };
    }
    // ログインした人の「参照モード」の返事（initApp.ts の refModeJs）。小さいものだけ控える（src/webview/refModeCache.ts）
    if (message.type === 'refMode' && typeof message.key === 'string' && message.key.length <= 1000 && typeof message.text === 'string' && message.text.length <= 2000) {
      return { type: 'refMode', key: message.key, text: message.text, contentType: typeof message.contentType === 'string' ? message.contentType.slice(0, 200) : '' };
    }
    // 開発中だけ: ページで起きたエラー・警告（NET_TRACE_JS）
    if (message.type === 'pageLog' && (message.level === 'error' || message.level === 'warn') && typeof message.text === 'string') {
      return { type: 'pageLog', level: message.level, text: message.text.slice(0, 2000) };
    }
    // ヘルスケアの歩数をください（Walk the Talk の歩数の登録。アプリは stepsReplyJs で答える）
    if (message.type === 'steps' && typeof message.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(message.id) && typeof message.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(message.day)) {
      return { type: 'steps', id: message.id, day: message.day };
    }
    // 勤務表の、日ごとの状態（勤怠登録の通知のため。src/attendance/attendanceReminder.ts）。年月と、1日1文字（u・o・r・-）だけ
    if (message.type === 'attendanceDays' && typeof message.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(message.month) && typeof message.days === 'string' && /^[uor-]{28,31}$/.test(message.days)) {
      return { type: 'attendanceDays', month: message.month, days: message.days };
    }
    // 給与・賞与明細のパスワード: Face ID で入れてほしい（アプリは pwFillJs で答える）
    if (message.type === 'pwFaceId') return { type: 'pwFaceId' };
    // 給与・賞与明細のパスワード: 手で入れて「開く」を押した（明細が開けたら、Face ID で覚えるか聞く。src/auth/payslipPassword.ts）
    if (message.type === 'pwTyped' && typeof message.value === 'string' && message.value.length > 0 && message.value.length <= 128) {
      return { type: 'pwTyped', value: message.value };
    }
    // 開発中だけ: 見た目の直しが名前で指している部品が、画面に見つからない（ezcraftSkin.ts の CHECK_JS）
    if (message.type === 'skinMissing' && typeof message.form === 'string' && Array.isArray(message.ids)) {
      const ids = message.ids.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_]{1,120}$/.test(id));
      return { type: 'skinMissing', form: message.form.slice(0, 80), ids: ids.slice(0, 200) };
    }
    // 時刻のダイヤル（timsSkin.ts の openDial）を1目もり回した
    if (message.type === 'tick') return { type: 'tick' };
    if (message.type === 'modal') return { type: 'modal', open: message.open === true };
    // 画面の定義（src/webview/page/initApp.ts）。名前と ID の形を確かめる（中身は initAppCache が確かめる）
    if (
      message.type === 'initApp' &&
      typeof message.app === 'string' &&
      /^[A-Za-z0-9_]+$/.test(message.app) &&
      typeof message.form === 'string' &&
      /^[A-Za-z0-9_]+$/.test(message.form) &&
      typeof message.id === 'string' &&
      /^[A-Za-z0-9_\-+/=.]{1,80}$/.test(message.id) &&
      typeof message.text === 'string' &&
      message.text.length < 8_000_000
    ) {
      return { type: 'initApp', app: message.app, form: message.form, id: message.id, text: message.text };
    }
    if (message.type === 'apply' && typeof message.form === 'string' && /^[A-Za-z0-9_]+$/.test(message.form)) {
      return { type: 'apply', form: message.form, prefill: shortValues(message.prefill), auto: message.auto === true };
    }
    // まとめて申請（勤務表の「残業をまとめて申請」）: 入れておく値の組を、1日ずつ（多くても1か月分）
    if (message.type === 'applyQueue' && typeof message.form === 'string' && /^[A-Za-z0-9_]+$/.test(message.form) && Array.isArray(message.items)) {
      const items = (message.items as unknown[]).slice(0, 31).map(shortValues).filter((v) => Object.keys(v).length > 0);
      return items.length > 0 ? { type: 'applyQueue', form: message.form, items } : null;
    }
    if (message.type === 'scroll' && typeof message.y === 'number') {
      return { type: 'scroll', y: message.y, target: typeof message.target === 'string' ? message.target : '' };
    }
    if (message.type === 'open' && typeof message.url === 'string') {
      const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
      return {
        type: 'open',
        url: message.url,
        handoff: { appData: text(message.appData), name: text(message.name), params: text(message.params) },
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * その画面のアプリだけが送ってよい知らせ。知らせはサイト（同じホスト）から来たものしか受け付けないが、
 * そのサイトには低コードで作られたアプリがいくつも載っている。ほかのアプリが歩数を読んだり、
 * 申請の画面を値を入れて開かせたり、通知の予約を変えたりできないよう、アプリごとに分ける
 */
const ONLY_FROM: Partial<Record<BridgeMessage['type'], string>> = {
  steps: 'YIF_walk_the_talk',
  apply: 'L_Tims',
  applyQueue: 'L_Tims',
  // 明細のパスワードは、給与・賞与明細の画面とだけやりとりする（ほかのアプリにパスワードを渡さない）
  pwFaceId: 'L_Payslip',
  pwTyped: 'L_Payslip',
  attendanceDays: 'L_Tims',
};
/** 歩数を答える日: 今日から、さかのぼって 62 日まで（Walk the Talk の歩数の登録は、今週と少し前の週だけ） */
const STEPS_BACK_DAYS = 62;

/** appId の画面が、この知らせを送ってよいか */
export function allowedFrom(message: BridgeMessage, appId: string): boolean {
  const only = ONLY_FROM[message.type];
  if (only && appId !== only) return false;
  // 開いてよいのは申請の画面だけ（src/shortcuts/openShortcut.ts の近道にあるもの）
  if ((message.type === 'apply' || message.type === 'applyQueue') && !/^frmApply_/.test(message.form)) return false;
  return true;
}

/** その日の歩数を答えてよいか（未来の日と、古すぎる日は答えない） */
export function stepsDayAllowed(day: string, now: Date = new Date()): boolean {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oldest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - STEPS_BACK_DAYS);
  return date <= today && date >= oldest;
}
