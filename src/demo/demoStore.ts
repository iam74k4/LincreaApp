// デモの見本のデータ。アプリのメモリの中だけに置く（サーバーにも端末にも書かない。アプリを閉じたら、初めの見本に戻る）。
//
// 見本は「今日」から作る（いつ審査されても、今月の勤務表・最近の明細になるように）。
// デモのページで登録・申請したものは、ここに入れて、ほかのページにもすぐ出す（登録した日は勤務表で「登録済み」になる）。
import type { MyApp } from '../models/myApp';
import { addDays, addMonths, isWeekend, monthOf, parseDay, ymd } from './demoDates';

export type AttendanceKind = '出勤' | '在宅勤務' | '有給休暇' | '欠勤';
export const ATTENDANCE_KINDS: AttendanceKind[] = ['出勤', '在宅勤務', '有給休暇', '欠勤'];

export type AttendanceRecord = { kind: AttendanceKind; start: string; end: string; rest: string; note: string };

export type DayStatus = 'holiday' | 'registered' | 'unregistered' | 'today' | 'future';

export type ApplyKind = 'zangyo' | 'yukyu';
export type Application = {
  id: string;
  kind: ApplyKind;
  day: string;
  /** 残業: 終わる時刻。有給: 全日・午前・午後 */
  detail: string;
  reason: string;
  status: '承認待ち' | '承認済み' | '取り下げ';
  appliedAt: string;
};

export type Reservation = { day: string; time: string; place: string };

export type DemoState = {
  today: string;
  attendance: Record<string, AttendanceRecord>;
  applications: Application[];
  reservation: Reservation | null;
  steps: Record<string, number>;
  /** 明細のパスワードを入れたか（デモでも、本物と同じく最初に聞く） */
  payslipUnlocked: boolean;
};

/** デモの明細のパスワード（ページに書いてある） */
export const DEMO_PAYSLIP_PASSWORD = '1234';

/** 有給休暇の残り（見本） */
export const PAID_LEAVE_DAYS = 12.5;

/** 見本で、登録していないことにする日（今日より前の平日を、近いほうから2日） */
function unregisteredSeeds(today: string): Set<string> {
  const out = new Set<string>();
  let day = addDays(today, -1);
  while (out.size < 2) {
    if (!isWeekend(day)) out.add(day);
    day = addDays(day, -1);
  }
  return out;
}

/** 見本の勤務の記録（日によって少しずつ変える） */
export function seedRecord(day: string): AttendanceRecord {
  const n = Number(day.slice(8, 10));
  const starts = ['08:55', '09:00', '09:02', '08:58'];
  const ends = ['18:00', '18:30', '19:15', '18:05', '20:00'];
  return { kind: n % 7 === 3 ? '在宅勤務' : '出勤', start: starts[n % 4], end: ends[n % 5], rest: '01:00', note: '' };
}

export function initialState(now: Date = new Date()): DemoState {
  const today = ymd(now);
  return {
    today,
    attendance: {},
    applications: [
      { id: 'a1', kind: 'zangyo', day: addDays(today, -6), detail: '20:00', reason: 'リリース前の確認作業のため', status: '承認済み', appliedAt: addDays(today, -6) },
      { id: 'a2', kind: 'yukyu', day: addDays(today, 10), detail: '全日', reason: '私用のため', status: '承認待ち', appliedAt: addDays(today, -2) },
    ],
    reservation: null,
    steps: Object.fromEntries(
      [2, 3, 4, 5, 6, 7].map((back) => [addDays(today, -back), 6000 + ((back * 2713) % 5200)]),
    ),
    payslipUnlocked: false,
  };
}

/** その日の記録（登録したもの → 見本の順）。記録がなければ null */
export function recordOf(state: DemoState, day: string): AttendanceRecord | null {
  if (Object.hasOwn(state.attendance, day)) return state.attendance[day];
  if (day >= state.today || isWeekend(day) || unregisteredSeeds(state.today).has(day)) return null;
  return seedRecord(day);
}

export function statusOf(state: DemoState, day: string): DayStatus {
  if (recordOf(state, day)) return 'registered';
  if (day === state.today) return 'today';
  if (day > state.today) return 'future';
  return isWeekend(day) ? 'holiday' : 'unregistered';
}

/** 勤務表で見られる月（先月と今月） */
export function attendanceMonths(state: DemoState): string[] {
  const current = monthOf(state.today);
  return [addMonths(current, -1), current];
}

/** 今日より前で、登録していない平日（新しい順） */
export function unregisteredDays(state: DemoState): string[] {
  const out: string[] = [];
  for (let day = addDays(state.today, -1), i = 0; i < 62; day = addDays(day, -1), i++) {
    if (statusOf(state, day) === 'unregistered') out.push(day);
  }
  return out;
}

// ---- 給与・賞与明細 ----

export type PayslipLine = { label: string; amount: number };
export type Payslip = { id: string; title: string; paidOn: string; earnings: PayslipLine[]; deductions: PayslipLine[] };

/** 見本の明細（今日までに支給日（25日）が来た、新しい 6 か月ぶん。6 月と 12 月は賞与も） */
export function payslips(state: DemoState): Payslip[] {
  const today = parseDay(state.today) ?? new Date();
  let month = monthOf(state.today);
  if (today.getDate() < 25) month = addMonths(month, -1);
  const out: Payslip[] = [];
  for (let i = 0; i < 6; i++, month = addMonths(month, -1)) {
    const mo = Number(month.slice(5, 7));
    const overtime = 18000 + ((mo * 7919) % 30000);
    out.push({
      id: `salary-${month}`,
      title: `${month.slice(0, 4)}年${mo}月 給与`,
      paidOn: `${month}-25`,
      earnings: [
        { label: '基本給', amount: 280000 },
        { label: '時間外手当', amount: overtime - (overtime % 100) },
        { label: '通勤手当', amount: 12000 },
      ],
      deductions: [
        { label: '健康保険', amount: 14350 },
        { label: '厚生年金', amount: 27450 },
        { label: '雇用保険', amount: 1860 },
        { label: '所得税', amount: 7840 },
        { label: '住民税', amount: mo === 6 ? 15800 : 15200 },
      ],
    });
    if (mo === 6 || mo === 12) {
      out.push({
        id: `bonus-${month}`,
        title: `${month.slice(0, 4)}年${mo}月 賞与`,
        paidOn: `${month}-10`,
        earnings: [{ label: '賞与', amount: 600000 }],
        deductions: [
          { label: '健康保険', amount: 29700 },
          { label: '厚生年金', amount: 54900 },
          { label: '雇用保険', amount: 3600 },
          { label: '所得税', amount: 41200 },
        ],
      });
    }
  }
  return out;
}

export const total = (lines: PayslipLine[]) => lines.reduce((sum, l) => sum + l.amount, 0);

// ---- 資格取得者の検索 ----

export type Qualified = { name: string; department: string; exams: string[] };

export const QUALIFIED: Qualified[] = [
  { name: '青木 さくら', department: '第1開発部', exams: ['応用情報技術者', '情報処理安全確保支援士'] },
  { name: '石川 健', department: '第2開発部', exams: ['基本情報技術者'] },
  { name: '上田 美咲', department: 'インフラ部', exams: ['ネットワークスペシャリスト', '応用情報技術者'] },
  { name: '岡本 拓也', department: '第1開発部', exams: ['データベーススペシャリスト'] },
  { name: '小林 真央', department: '品質保証部', exams: ['基本情報技術者', 'ITストラテジスト'] },
  { name: '斎藤 大輔', department: 'インフラ部', exams: ['情報処理安全確保支援士'] },
  { name: '鈴木 結衣', department: '第2開発部', exams: ['応用情報技術者'] },
  { name: '高橋 翔', department: 'プロジェクト推進部', exams: ['プロジェクトマネージャ', '応用情報技術者'] },
  { name: '中村 葵', department: '第1開発部', exams: ['システムアーキテクト'] },
  { name: '森 陽介', department: '品質保証部', exams: ['基本情報技術者'] },
];

// ---- マイアプリの一覧 ----

const icon = { name: 'desktop', color: '#FFFFFF', background: '#1C6EF2' };
const app = (logicName: string, formName: string, name: string, description: string): MyApp => ({
  id: `demo-${logicName}`,
  name,
  logicName,
  formName,
  description,
  icon,
  isAvailable: true,
  isDeveloping: false,
  releasedAt: null,
  releaseId: '',
  releaseNotes: '',
});

/** デモのマイアプリ（本物と同じアプリケーション ID。名前とアイコンは src/myApps/knownApps.ts） */
export const DEMO_APPS: MyApp[] = [
  app('L_Tims', 'frmLTiMSTop', '£-TiMS 勤怠管理', '勤務表・各種申請'),
  app('L_Payslip', 'frmPayslipList', '給与・賞与明細', '給与・賞与明細の照会'),
  app('L_HealthCare', 'frmHealthTop', '健康診断', '健康診断の予約と結果'),
  app('L_Payslip_Juminzei', 'frmJuminzei', '住民税特別徴収税額通知書', '住民税の通知書'),
  app('L_ITEE', 'frmIteeSearch', '情報処理試験資格取得者検索', '情報処理技術者試験の資格取得者を探す'),
  app('YIF_walk_the_talk', 'frmWalkTop', 'Walk the Talk', '歩数の登録とポイント'),
];

// ---- 登録・申請（ページから来る） ----

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** 書き込みの結果。message は、そのまま知らせに出す */
export type ActionResult = { ok: true; message: string; state: DemoState } | { ok: false; message: string };

/** ページから来た登録・申請を、見本のデータに入れる（中身はページが送ってきたものなので、形を確かめる） */
export function applyAction(state: DemoState, action: string, data: Record<string, unknown>): ActionResult {
  switch (action) {
    case 'attendance.save': {
      const day = str(data.day);
      const kind = str(data.kind) as AttendanceKind;
      if (!parseDay(day) || day > state.today) return { ok: false, message: '登録できる日ではありません。' };
      if (!ATTENDANCE_KINDS.includes(kind)) return { ok: false, message: '区分を選んでください。' };
      const working = kind === '出勤' || kind === '在宅勤務';
      const start = str(data.start);
      const end = str(data.end);
      const rest = str(data.rest) || '00:00';
      if (working && (!TIME.test(start) || !TIME.test(end) || !TIME.test(rest))) return { ok: false, message: '出勤・退勤・休憩の時刻を入れてください。' };
      if (working && end <= start) return { ok: false, message: '退勤は出勤より後の時刻にしてください。' };
      const record: AttendanceRecord = working ? { kind, start, end, rest, note: str(data.note) } : { kind, start: '', end: '', rest: '', note: str(data.note) };
      return { ok: true, message: '勤怠実績を登録しました。', state: { ...state, attendance: { ...state.attendance, [day]: record } } };
    }
    case 'apply.create': {
      const kind = str(data.kind) as ApplyKind;
      const day = str(data.day);
      const reason = str(data.reason);
      if (kind !== 'zangyo' && kind !== 'yukyu') return { ok: false, message: '申請の種類が分かりません。' };
      if (!parseDay(day)) return { ok: false, message: '日付を選んでください。' };
      if (reason === '') return { ok: false, message: '理由を入れてください。' };
      const detail = str(data.detail);
      if (kind === 'zangyo' && !TIME.test(detail)) return { ok: false, message: '終わる予定の時刻を入れてください。' };
      if (kind === 'yukyu' && !['全日', '午前', '午後'].includes(detail)) return { ok: false, message: '全日・午前・午後を選んでください。' };
      if (kind === 'yukyu' && day <= state.today) return { ok: false, message: '有給休暇は、明日より後の日で申請してください。' };
      const application: Application = { id: `a${state.applications.length + 1}-${day}`, kind, day, detail, reason, status: '承認待ち', appliedAt: state.today };
      return {
        ok: true,
        message: '申請しました。承認されると、勤務表に反映されます。',
        state: { ...state, applications: [application, ...state.applications] },
      };
    }
    case 'apply.cancel': {
      const id = str(data.id);
      const target = state.applications.find((a) => a.id === id && a.status === '承認待ち');
      if (!target) return { ok: false, message: '取り下げられる申請ではありません。' };
      return {
        ok: true,
        message: '申請を取り下げました。',
        state: { ...state, applications: state.applications.map((a) => (a === target ? { ...a, status: '取り下げ' } : a)) },
      };
    }
    case 'health.reserve': {
      const day = str(data.day);
      const time = str(data.time);
      const place = str(data.place);
      if (!parseDay(day) || day <= state.today) return { ok: false, message: '日にちを選んでください。' };
      if (!TIME.test(time) || place === '') return { ok: false, message: '時間と会場を選んでください。' };
      return { ok: true, message: '健康診断を予約しました。', state: { ...state, reservation: { day, time, place } } };
    }
    case 'health.cancel':
      return { ok: true, message: '予約を取り消しました。', state: { ...state, reservation: null } };
    case 'walk.save': {
      const day = str(data.day);
      const steps = Number(str(data.steps).replace(/,/g, ''));
      if (!parseDay(day) || day > state.today) return { ok: false, message: '登録できる日ではありません。' };
      if (!Number.isInteger(steps) || steps < 0 || steps > 100000) return { ok: false, message: '歩数は 0〜100,000 の数で入れてください。' };
      return { ok: true, message: '歩数を登録しました。', state: { ...state, steps: { ...state.steps, [day]: steps } } };
    }
    case 'payslip.unlock':
      if (str(data.password) !== DEMO_PAYSLIP_PASSWORD) return { ok: false, message: 'パスワードが違います。' };
      return { ok: true, message: '', state: { ...state, payslipUnlocked: true } };
    default:
      return { ok: false, message: 'この操作は、デモではできません。' };
  }
}

// ---- アプリの中で1つだけ持つ見本（画面はここを見る） ----

let current: DemoState | null = null;
let version = 0;
const listeners = new Set<() => void>();

export function demoState(): DemoState {
  // 日付が変わったら「今日」を進める（登録したものは残す）
  const today = ymd(new Date());
  if (!current) current = initialState();
  else if (current.today !== today) current = { ...current, today };
  return current;
}

export function runDemoAction(action: string, data: Record<string, unknown>): ActionResult {
  const result = applyAction(demoState(), action, data);
  if (result.ok) {
    current = result.state;
    version += 1;
    listeners.forEach((l) => l());
  }
  return result;
}

/** 見本を初めに戻す（ログアウトしたとき） */
export function resetDemo(): void {
  current = null;
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function demoVersion(): number {
  return version;
}
