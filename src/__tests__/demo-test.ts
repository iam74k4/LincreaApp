// 審査用のデモ（src/demo/）: 決まったユーザー名とパスワードでだけ入る・見本のデータへの登録・どのページも開けること・
// ページのスクリプトが、登録をアプリに知らせること（jsdom で動かす）。
import { JSDOM } from 'jsdom';

import { DEMO_PASSWORD, DEMO_USERNAME, isDemoCredentials, isDemoSession } from '../demo/demoAccount';
import { addDays, isWeekend } from '../demo/demoDates';
import { esc } from '../demo/demoHtml';
import { demoPage, demoStepsDayAllowed, type DemoEnv } from '../demo/demoPages';
import { applyAction, DEMO_APPS, DEMO_PAYSLIP_PASSWORD, initialState, payslips, recordOf, statusOf, unregisteredDays, type DemoState } from '../demo/demoStore';
import { SHORTCUTS } from '../shortcuts/shortcuts';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NOW = new Date(2026, 10, 24, 10, 0); // 2026-11-24（火）
const ENV: DemoEnv = { health: true, healthSource: 'ヘルスケア', bottomInset: 34 };

function must(result: ReturnType<typeof applyAction>): DemoState {
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

test('決まったユーザー名とパスワードのときだけ、デモで入る', () => {
  expect(isDemoCredentials(DEMO_USERNAME, DEMO_PASSWORD)).toBe(true);
  expect(isDemoCredentials(` ${DEMO_USERNAME.toUpperCase()} `, DEMO_PASSWORD)).toBe(true);
  expect(isDemoCredentials(DEMO_USERNAME, DEMO_PASSWORD.toLowerCase())).toBe(false);
  expect(isDemoCredentials(DEMO_USERNAME, '')).toBe(false);
  expect(isDemoCredentials('taro', DEMO_PASSWORD)).toBe(false);
  expect(isDemoSession({ username: DEMO_USERNAME })).toBe(false); // 名前が同じでも、デモの印がなければ本物
  expect(isDemoSession({ username: DEMO_USERNAME, demo: true })).toBe(true);
});

test('勤務表の見本: 過ぎた平日は登録済み、近い2日だけ未登録。週末は休日、今日と先の日は空', () => {
  const state = initialState(NOW);
  expect(state.today).toBe('2026-11-24');
  expect(unregisteredDays(state)).toEqual(['2026-11-23', '2026-11-20']);
  expect(statusOf(state, '2026-11-19')).toBe('registered');
  expect(statusOf(state, '2026-11-22')).toBe('holiday');
  expect(statusOf(state, '2026-11-24')).toBe('today');
  expect(statusOf(state, '2026-11-25')).toBe('future');
});

test('勤怠実績を登録すると、その日が登録済みになる。おかしな時刻・先の日は断る', () => {
  const state = initialState(NOW);
  const next = must(applyAction(state, 'attendance.save', { day: '2026-11-23', kind: '出勤', start: '09:00', end: '18:00', rest: '01:00', note: '' }));
  expect(statusOf(next, '2026-11-23')).toBe('registered');
  expect(unregisteredDays(next)).toEqual(['2026-11-20']);
  expect(applyAction(state, 'attendance.save', { day: '2026-11-23', kind: '出勤', start: '18:00', end: '09:00', rest: '01:00' }).ok).toBe(false);
  expect(applyAction(state, 'attendance.save', { day: '2026-11-30', kind: '出勤', start: '09:00', end: '18:00', rest: '01:00' }).ok).toBe(false);
  expect(applyAction(state, 'attendance.save', { day: '2026-11-23', kind: '休む', start: '', end: '' }).ok).toBe(false);
  // 有給休暇の日は、時刻を入れなくてよい
  const leave = must(applyAction(state, 'attendance.save', { day: '2026-11-20', kind: '有給休暇' }));
  expect(recordOf(leave, '2026-11-20')).toEqual({ kind: '有給休暇', start: '', end: '', rest: '', note: '' });
});

test('申請と取り下げ・健康診断の予約・歩数・明細のパスワード', () => {
  let state = initialState(NOW);
  state = must(applyAction(state, 'apply.create', { kind: 'zangyo', day: '2026-11-24', detail: '21:00', reason: '障害対応' }));
  expect(state.applications[0]).toMatchObject({ kind: 'zangyo', status: '承認待ち', detail: '21:00' });
  expect(applyAction(state, 'apply.create', { kind: 'yukyu', day: '2026-11-24', detail: '全日', reason: '私用' }).ok).toBe(false); // 今日の有給は断る
  expect(applyAction(state, 'apply.create', { kind: 'zangyo', day: '2026-11-24', detail: '21:00', reason: '' }).ok).toBe(false);
  state = must(applyAction(state, 'apply.cancel', { id: state.applications[0].id }));
  expect(state.applications[0].status).toBe('取り下げ');
  expect(applyAction(state, 'apply.cancel', { id: state.applications[0].id }).ok).toBe(false); // 2回は取り下げない

  state = must(applyAction(state, 'health.reserve', { day: '2026-12-02', time: '10:30', place: '本社 健康管理室' }));
  expect(state.reservation).toEqual({ day: '2026-12-02', time: '10:30', place: '本社 健康管理室' });
  expect(must(applyAction(state, 'health.cancel', {})).reservation).toBeNull();

  state = must(applyAction(state, 'walk.save', { day: '2026-11-24', steps: '8,421' }));
  expect(state.steps['2026-11-24']).toBe(8421);
  expect(applyAction(state, 'walk.save', { day: '2026-11-24', steps: '-1' }).ok).toBe(false);
  expect(applyAction(state, 'walk.save', { day: '2026-11-25', steps: '100' }).ok).toBe(false);

  expect(applyAction(state, 'payslip.unlock', { password: 'x' }).ok).toBe(false);
  expect(must(applyAction(state, 'payslip.unlock', { password: DEMO_PAYSLIP_PASSWORD })).payslipUnlocked).toBe(true);
  expect(applyAction(state, 'server.write', {}).ok).toBe(false); // 知らない操作
});

test('明細は、支給日が来た新しい 6 か月ぶん（12 月・6 月は賞与も）', () => {
  const slips = payslips(initialState(NOW));
  expect(slips[0].title).toBe('2026年10月 給与'); // 11 月 25 日はまだ
  expect(slips.filter((s) => s.id.startsWith('salary-'))).toHaveLength(6);
  expect(slips.map((s) => s.title)).toContain('2026年6月 賞与');
});

test('歩数を読むのは、今日から 30 日前までの日だけ', () => {
  const state = initialState(NOW);
  expect(demoStepsDayAllowed(state, '2026-11-24')).toBe(true);
  expect(demoStepsDayAllowed(state, '2026-11-25')).toBe(false);
  expect(demoStepsDayAllowed(state, addDays('2026-11-24', -31))).toBe(false);
  expect(demoStepsDayAllowed(state, 'today')).toBe(false);
});

/** ページの中のリンク（data-open）の行き先 */
function linksOf(html: string): { form: string; q: string; app: string }[] {
  const doc = new JSDOM(html).window.document;
  return Array.from(doc.querySelectorAll('[data-open]')).map((el) => ({
    form: el.getAttribute('data-open') ?? '',
    q: el.getAttribute('data-q') ?? '',
    app: el.getAttribute('data-app') ?? '',
  }));
}

test('マイアプリ・近道から、リンクをたどって開けるページは、どれも「デモでは開けません」にならない', () => {
  let state = initialState(NOW);
  state = must(applyAction(state, 'payslip.unlock', { password: DEMO_PAYSLIP_PASSWORD }));
  const start = [
    ...DEMO_APPS.map((a) => ({ app: a.logicName, form: a.formName, q: '' })),
    ...SHORTCUTS.map((s) => ({ app: s.app, form: s.direct.form, q: '' })),
  ];
  const seen = new Set<string>();
  const queue = [...start];
  while (queue.length) {
    const { app, form, q } = queue.shift()!;
    const key = `${app}/${form}?${q}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const page = demoPage(state, app, form, q, ENV);
    expect([key, page.html.includes('デモでは開けません')]).toEqual([key, false]);
    expect([key, page.title]).not.toEqual([key, '']);
    for (const link of linksOf(page.html)) queue.push({ app: link.app || app, form: link.form, q: link.q });
  }
  expect(seen.size).toBeGreaterThan(20);
});

test('知らない画面は「デモでは開けません」。入れた文字は HTML として読まれない', () => {
  const state = initialState(NOW);
  expect(demoPage(state, 'L_Tims', 'frmUnknown', '', ENV).html).toContain('デモでは開けません');
  const saved = must(applyAction(state, 'attendance.save', { day: '2026-11-23', kind: '出勤', start: '09:00', end: '18:00', rest: '01:00', note: '<img src=x onerror=alert(1)>' }));
  const html = demoPage(saved, 'L_Tims', 'frmAttendanceDtl', 'day=2026-11-23', ENV).html;
  expect(html).toContain(esc('<img src=x onerror=alert(1)>'));
  expect(html).not.toContain('<img src=x');
});

const opened: JSDOM[] = [];
afterEach(() => opened.splice(0).forEach((d) => d.window.close()));

/** ページを jsdom で動かし、アプリへの知らせを集める */
function run(html: string) {
  const posted: Record<string, unknown>[] = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(window) {
      (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
        postMessage: (data: string) => posted.push(JSON.parse(data)),
      };
    },
  });
  opened.push(dom);
  return { window: dom.window, document: dom.window.document, posted };
}

test('ページの登録の form は、入れた値をアプリに送り、返事を受けたら閉じる', () => {
  jest.useFakeTimers();
  try {
    const page = demoPage(initialState(NOW), 'L_Tims', 'frmAttendanceDtl', 'day=2026-11-23', ENV);
    const { window, document, posted } = run(page.html);
    const form = document.querySelector('form')!;
    (form.querySelector('[name=start]') as HTMLInputElement).value = '08:30';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    expect(posted[0]).toMatchObject({
      type: 'action',
      action: 'attendance.save',
      back: true,
      data: { day: '2026-11-23', kind: expect.any(String), start: '08:30', end: '18:00', rest: '01:00', note: '' },
    });
    (window as unknown as { __demoResult: (id: string, ok: boolean, m: string) => void }).__demoResult(posted[0].id as string, true, '登録しました');
    expect(document.getElementById('demo-toast')!.textContent).toBe('登録しました');
    jest.advanceTimersByTime(1000);
    expect(posted[1]).toEqual({ type: 'back' });
  } finally {
    jest.useRealTimers();
  }
});

test('断られたら、ページにその文を出して閉じない', () => {
  const page = demoPage(initialState(NOW), 'L_Tims', 'frmApply_zangyo', '', ENV);
  const { window, document, posted } = run(page.html);
  document.querySelector('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  (window as unknown as { __demoResult: (id: string, ok: boolean, m: string) => void }).__demoResult(posted[0].id as string, false, '理由を入れてください。');
  expect(document.querySelector('.error')!.textContent).toBe('理由を入れてください。');
  expect(posted).toHaveLength(1);
});

test('リンクを押すと、次の画面を開く知らせ。Walk the Talk は端末の歩数を読んで欄に入れる', () => {
  const top = run(demoPage(initialState(NOW), 'L_Tims', 'frmLTiMSTop', '', ENV).html);
  (top.document.querySelector('[data-open=frmAttendance]') as HTMLElement).click();
  expect(top.posted[0]).toEqual({ type: 'open', app: '', form: 'frmAttendance', q: '', sheet: false });

  const walk = run(demoPage(initialState(NOW), 'YIF_walk_the_talk', 'frmWalkInput', 'day=2026-11-24', ENV).html);
  (walk.document.getElementById('read') as HTMLButtonElement).click();
  expect(walk.posted[0]).toMatchObject({ type: 'steps', day: '2026-11-24' });
  (walk.window as unknown as { __demoSteps: (id: string, steps: number | null) => void }).__demoSteps(walk.posted[0].id as string, 7345);
  expect((walk.document.getElementById('steps') as HTMLInputElement).value).toBe('7345');

  // 歩数を読めない端末では、読み込みのボタンを出さない
  const manual = demoPage(initialState(NOW), 'YIF_walk_the_talk', 'frmWalkInput', 'day=2026-11-24', { ...ENV, health: false });
  expect(run(manual.html).document.getElementById('read')).toBeNull();
});

test('健康診断の予約は、1 週間より先の平日から選ぶ', () => {
  const html = demoPage(initialState(NOW), 'L_HealthCare', 'frmHealthReserve', '', ENV).html;
  const days = linksOfOptions(html);
  expect(days.length).toBe(8);
  expect(days.every((d) => d >= '2026-12-01' && !isWeekend(d))).toBe(true);
});

function linksOfOptions(html: string): string[] {
  const doc = new JSDOM(html).window.document;
  return Array.from(doc.querySelectorAll('select[name=day] option')).map((o) => o.getAttribute('value') ?? '');
}
