// Walk the Talk の歩数入力に、ヘルスケアの歩数を入れるページのスクリプト（appStyles.ts の HEALTH_STEPS_JS）。
// 今日までの日だけを聞くこと、年をまたぐ週の日付、多い日だけ入れること、知らせの文を確かめる。
// ページは jsdom で作る（React Native のテストの設定と jsdom の環境は一緒に使えないため、テストの中で作る）。
// 時計（setTimeout・Date）は、Jest の偽の時計を使う。
import { JSDOM } from 'jsdom';

import { HEALTH_STEPS_JS, WEEKLY } from '../webview/appStyles';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

type Win = JSDOM['window'] & {
  __myappHealth?: boolean;
  __myappXhr?: () => number;
  __myappXhrAt?: number;
  __myappXhrIdle?: (ms: number) => boolean;
  __myappStepsReply?: (id: string, steps: number | null) => void;
  ReactNativeWebView?: { postMessage: jest.Mock };
};
let win: Win;
let document: Document;

/** EZCraft の「歩数入力」と同じ作りの部品を置く（labels は月〜日の「11/16」など、values は欄の中身） */
function dialog(labels: string[], values: string[] = labels.map(() => '0')) {
  document.body.innerHTML = `<div id="${WEEKLY}" class="tcc-form">${DAYS.map(
    (day, i) => `
      <div id="${WEEKLY}_lbl_date_${day}"><label class="tcc-label"><div class="tcc-label-text">${labels[i]}</div></label></div>
      <div id="${WEEKLY}_num_steps_${day}"><input type="text" value="${values[i]}"></div>`,
  ).join('')}</div>`;
}
const input = (day: string) => document.querySelector<HTMLInputElement>(`#${WEEKLY}_num_steps_${day} input`)!;
/** アプリに聞いた日（"2026-11-17" など） */
const asked = () => win.ReactNativeWebView!.postMessage.mock.calls.map(([json]) => JSON.parse(json as string).day as string);
/** アプリに聞いたぶんに、日ごとの歩数で答える */
function reply(steps: Record<string, number | null>) {
  for (const [json] of win.ReactNativeWebView!.postMessage.mock.calls) {
    const { id, day } = JSON.parse(json as string);
    win.__myappStepsReply!(id, day in steps ? steps[day] : 0);
  }
}
const note = () => document.querySelector('.myapp-health-note')?.textContent ?? null;

let healthSteps: () => void;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 18, 9, 0)); // 2026/11/18（水）
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  win = dom.window as Win;
  document = win.document;
  win.__myappHealth = true;
  win.__myappXhr = () => 0;
  win.__myappXhrAt = 0;
  // ページの読み込み前に入れる bootJs（src/webview/ezcraftSkin.ts）と同じ判定
  win.__myappXhrIdle = (ms) => (win.__myappXhr?.() ?? 0) === 0 && Date.now() - (win.__myappXhrAt ?? 0) >= ms;
  win.ReactNativeWebView = { postMessage: jest.fn() };
  // ページに入れるのと同じ文を、そのページ（window・document・Event）で動かし、中の関数を取り出す
  healthSteps = new Function('window', 'document', 'Event', 'FocusEvent', `${HEALTH_STEPS_JS}; return healthSteps;`)(
    win,
    document,
    win.Event,
    win.FocusEvent,
  );
});
afterEach(() => {
  jest.useRealTimers();
  win.close();
});

/** 開いてから、読み込みが落ち着くまで待って、歩数を聞く */
function openAndWait() {
  healthSteps();
  jest.advanceTimersByTime(1000);
  healthSteps();
}

test('今日までの日だけ、ヘルスケアの歩数を聞く（これからの日は聞かない）', () => {
  dialog(['11/16', '11/17', '11/18', '11/19', '11/20', '11/21', '11/22']);
  openAndWait();
  expect(asked()).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
});

test('ヘルスケアの歩数が多い日だけ入れて、知らせを出す（保存は人が押す）', () => {
  dialog(['11/16', '11/17', '11/18', '11/19', '11/20', '11/21', '11/22'], ['0', '9,000', '0', '0', '0', '0', '0']);
  openAndWait();
  reply({ '2026-11-16': 8234, '2026-11-17': 5000, '2026-11-18': 0 });
  expect(input('monday').value).toBe('8234');
  // 手で多めに入れた日は、そのまま
  expect(input('tuesday').value).toBe('9,000');
  expect(input('wednesday').value).toBe('0');
  expect(note()).toBe('ヘルスケアの歩数を入れました（11/16）。「保存」で登録します');
});

test('欄に入れたら、EZCraft が「変わった」と分かるように input と change を送る', () => {
  dialog(['11/16', '11/17', '11/18', '11/19', '11/20', '11/21', '11/22']);
  const events: string[] = [];
  ['input', 'change', 'focusout'].forEach((type) => input('monday').addEventListener(type, () => events.push(type)));
  openAndWait();
  reply({ '2026-11-16': 1200 });
  expect(events).toEqual(['input', 'change', 'focusout']);
});

test('打っている途中の欄は書き換えない', () => {
  dialog(['11/16', '11/17', '11/18', '11/19', '11/20', '11/21', '11/22']);
  openAndWait();
  input('monday').focus();
  reply({ '2026-11-16': 8234 });
  expect(input('monday').value).toBe('0');
});

test('ヘルスケアに歩数がない週は、そう知らせる', () => {
  dialog(['11/16', '11/17', '11/18', '11/19', '11/20', '11/21', '11/22']);
  openAndWait();
  reply({});
  expect(note()).toBe('ヘルスケアに、この週の歩数がありませんでした');
});

test('年をまたぐ週は、日付ごとに正しい年で聞く', () => {
  jest.setSystemTime(new Date(2027, 0, 2, 9, 0)); // 2027/1/2（土）
  dialog(['12/28', '12/29', '12/30', '12/31', '1/1', '1/2', '1/3']);
  openAndWait();
  expect(asked()).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
});

test('同じ週は1回だけ聞く（画面が書き換わるたびに聞き直さない）', () => {
  dialog(['11/16', '11/17', '11/18', '11/19', '11/20', '11/21', '11/22']);
  openAndWait();
  healthSteps();
  jest.advanceTimersByTime(2000);
  healthSteps();
  expect(asked()).toHaveLength(3);
});

test('登録してある歩数を読んでいるあいだは待つ（読み終わる前に入れると上書きされる）', () => {
  dialog(['11/16', '11/17', '11/18', '11/19', '11/20', '11/21', '11/22']);
  let busy = 1;
  win.__myappXhr = () => busy;
  healthSteps();
  jest.advanceTimersByTime(3000);
  expect(asked()).toHaveLength(0);
  busy = 0;
  win.__myappXhrAt = Date.now();
  jest.advanceTimersByTime(1000);
  expect(asked()).toHaveLength(3);
});

test('ヘルスケアが使えない（Expo Go など）ときは、何もしない', () => {
  win.__myappHealth = false;
  dialog(['11/16', '11/17', '11/18', '11/19', '11/20', '11/21', '11/22']);
  openAndWait();
  expect(asked()).toHaveLength(0);
});
