// よく使う理由（src/webview/timsSkin.ts の REASONS_JS）。ページの中で動く JavaScript を、そのまま動かす。
import { REASONS_JS } from '../webview/timsSkin';

type Reasons = {
  rememberReason: (kind: string, text: string) => void;
  pickReasons: (kind: string) => string[];
  reasonList: (kind: string) => { t: string; n: number; at: number }[];
};

function setup(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  };
  let now = 1_000;
  const clock = { now: () => now };
  const r = new Function(
    'localStorage',
    'Date',
    `${REASONS_JS}\nreturn { rememberReason: rememberReason, pickReasons: pickReasons, reasonList: reasonList };`,
  )(localStorage, clock) as Reasons;
  const later = (ms = 1_000) => {
    now += ms;
  };
  return { r, store, later };
}

test('覚えている理由がなければ、札は出さない', () => {
  const { r } = setup();
  expect(r.pickReasons('overtime')).toEqual([]);
});

test('最後に使った理由を先頭に、そのあとは使った回数の多い順に、3つまで', () => {
  const { r, later } = setup();
  for (const t of ['会議のため', '会議のため', '会議のため', 'リリース対応のため', 'リリース対応のため', '資料作成のため']) {
    r.rememberReason('overtime', t);
    later();
  }
  r.rememberReason('overtime', '障害対応のため');
  expect(r.pickReasons('overtime')).toEqual(['障害対応のため', '会議のため', 'リリース対応のため']);
});

test('同じ理由は1つにまとめて数える（前後の空白は無視する）。空の理由は覚えない', () => {
  const { r, later } = setup();
  r.rememberReason('leave', '私用のため');
  later();
  r.rememberReason('leave', '  私用のため \n');
  r.rememberReason('leave', '   ');
  expect(r.reasonList('leave')).toEqual([{ t: '私用のため', n: 2, at: 2_000 }]);
});

test('残業申請と有給休暇申請は、別々に覚える', () => {
  const { r } = setup();
  r.rememberReason('overtime', '会議のため');
  r.rememberReason('leave', '私用のため');
  expect(r.pickReasons('overtime')).toEqual(['会議のため']);
  expect(r.pickReasons('leave')).toEqual(['私用のため']);
});

test('前の版が覚えていた残業申請の「前回の理由」も、はじめの1つとして出す', () => {
  const { r, later } = setup({ 'myapp.overtime.lastReason': '月末の締め作業のため' });
  expect(r.pickReasons('overtime')).toEqual(['月末の締め作業のため']);
  later();
  r.rememberReason('overtime', '会議のため');
  expect(r.pickReasons('overtime')).toEqual(['会議のため', '月末の締め作業のため']);
  expect(r.pickReasons('leave')).toEqual([]);
});

test('20 件を超えたら、長く使っていないものから忘れる', () => {
  const { r, later } = setup();
  for (let i = 0; i < 25; i++) {
    r.rememberReason('overtime', `理由${i}`);
    later();
  }
  const kept = r.reasonList('overtime').map((x) => x.t);
  expect(kept).toHaveLength(20);
  expect(kept).toContain('理由24');
  expect(kept).not.toContain('理由4');
});

test('壊れた控え（JSON でない・配列でない）は、なかったことにする', () => {
  expect(setup({ 'myapp.reasons.overtime': '{oops' }).r.pickReasons('overtime')).toEqual([]);
  expect(setup({ 'myapp.reasons.leave': '{"t":"x"}' }).r.pickReasons('leave')).toEqual([]);
});
