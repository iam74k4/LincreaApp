// 勤怠登録の通知: 未登録の勤務日が3日以上あったら、水曜の 12:00 に「勤怠登録の最新化をお願いします」と知らせる。
//
// サーバーから送る通知ではなく、この端末の中で予約しておく通知（会社のサイトのパスワードを、ほかのサーバーに預けないため）。
//   1. 勤務表のページが、見ている月の日ごとの状態（未登録・休日・登録した日）を知らせてくる（src/webview/page/timsSkin.ts の reportDays）。
//      登録して一覧が読み直されたときも知らせてくる
//   2. それを覚えておき（端末の中。ログアウトで消す）、これからの水曜 12:00 ごとに、未登録の勤務日がいくつになるかを見込む
//      （src/attendance/attendanceSchedule.ts）。3日以上になる水曜に、通知を予約する（先の4週ぶん。前の予約は入れ替える）
//   3. 押したら、勤務表を開く
// 予約した通知は、アプリを開かなくても届く。アプリを開いたときにも、覚えている状態から予約し直す（週が進むので）。
// パソコンなどで登録した分は、次に勤務表を見るまで分からない（そのあいだに届いた通知は、勤務表を見れば止まる）。
import { useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { daysInMonth, keepRecentMonths, planReminders, type AttendanceDays, type Reminder } from './attendanceSchedule';

/** 通知を押したら開く近道（src/shortcuts/shortcuts.ts の勤務表） */
export const REMINDER_SHORTCUT = 'tims-attendance';

const STORE_KEY = 'myapp.attendanceDays';
/** 覚えている状態と予約が、だれのものか（ログインの名前） */
const OWNER_KEY = 'myapp.attendanceOwner';
const ID_PREFIX = 'attendance-reminder-';
/** 覚えておく月の数（数えるのは、知らせる日の前の月から） */
const KEEP_MONTHS = 3;
/** 勤務表は、読み直しのあいだに何度か知らせてくるので、落ち着いてから予約し直す */
const SETTLE_MS = 1000;

// アプリを開いているときに届いても、上に出す
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let months: AttendanceDays | null = null;
let settle: ReturnType<typeof setTimeout> | null = null;
// 覚え書きの読み書きと予約は、1つずつ順に行う（重なると、取り消しと予約が入れ違うため）
let queue: Promise<void> = Promise.resolve();

function run(task: () => Promise<void>): void {
  queue = queue.then(task).catch(() => {});
}

async function load(): Promise<AttendanceDays> {
  if (months) return months;
  const loaded: AttendanceDays = {};
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? '{}');
    for (const [month, days] of Object.entries(parsed as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}$/.test(month) && typeof days === 'string' && days.length === daysInMonth(month)) loaded[month] = days;
    }
  } catch {
    // 読めなければ、何も覚えていないことにする（次に勤務表を見たら覚え直す）
  }
  months = loaded;
  return loaded;
}

/** 勤務表のページから、見ている月の日ごとの状態を受け取る（src/webview/bridge.ts の attendanceDays） */
export function noteAttendanceDays(month: string, days: string): void {
  if (days.length !== daysInMonth(month)) return;
  run(async () => {
    const all = await load();
    if (all[month] === days) return;
    months = keepRecentMonths({ ...all, [month]: days }, KEEP_MONTHS);
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(months));
  });
  // 勤務表を見ているときは、通知を許してもらう（初めてのときだけ iOS が尋ねる）
  if (settle) clearTimeout(settle);
  settle = setTimeout(() => {
    settle = null;
    run(() => sync(true));
  }, SETTLE_MS);
}

/** ログアウトしたら、覚えていた状態と、予約した通知を消す（ほかの人がログインするかもしれないので） */
export function forgetAttendanceReminders(): void {
  if (settle) clearTimeout(settle);
  settle = null;
  run(async () => {
    await forgetAll();
    await AsyncStorage.removeItem(OWNER_KEY);
  });
}

async function forgetAll(): Promise<void> {
  months = {};
  // 先に予約を消す（覚えていた状態を消せなくても、前の人の通知は届かないように）
  await cancel((await scheduledReminders()).map((n) => n.identifier));
  await AsyncStorage.removeItem(STORE_KEY);
}

/**
 * いまこの端末を使う人を知らせる（起動したとき・ログインしたとき。src/session/SessionContext.tsx）。
 * 覚えている状態と予約が別の人のものなら、消す。ログインが切れていて入り直せないまま、ログイン画面から別の人が入ったとき、
 * ログアウトを通らないので、前の人の通知が届き続けていた。
 * だれのものか分からない（持ち主を覚える前の版が残した）ものも、一度消す。持ち主は、勤務表の状態を受け取るより先に
 * （起動したとき・ログインしたときに）覚えるので、持ち主のない状態は前の版のものだけ。前の版で別の人が入ったあとの端末では、
 * 前の人の通知が残っていることがある。消しても、次に勤務表を開けば覚え直して、予約し直す
 */
export function attendanceRemindersFor(username: string): void {
  run(async () => {
    const owner = await AsyncStorage.getItem(OWNER_KEY);
    if (owner !== null && owner.toLowerCase() === username.toLowerCase()) return;
    await forgetAll();
    await AsyncStorage.setItem(OWNER_KEY, username);
  });
}

/**
 * ログインしたあとの画面で使う: アプリを開いたとき（前に出てきたときも）に予約し直し、通知を押して開いたら openTimesheet を呼ぶ。
 * openTimesheet は、変わらない関数を渡す
 */
export function useAttendanceReminders(openTimesheet: () => void): void {
  useEffect(() => {
    run(() => sync(false));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run(() => sync(false));
    });
    return () => subscription.remove();
  }, []);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (response.notification.request.content.data?.open !== REMINDER_SHORTCUT) return;
    // 一度だけ開く（画面を作り直しても、同じ通知でもう一度開かないように）
    Notifications.clearLastNotificationResponse();
    openTimesheet();
  }, [response, openTimesheet]);
}

function idOf(reminder: Reminder): string {
  const at = reminder.at;
  return `${ID_PREFIX}${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
}

function contentOf(reminder: Reminder): Notifications.NotificationContentInput {
  return {
    title: '勤怠登録の最新化をお願いします',
    body: `まだ登録していない勤務日が${reminder.days}日あります。押すと勤務表を開きます。`,
    sound: 'default',
    data: { open: REMINDER_SHORTCUT },
  };
}

async function scheduledReminders(): Promise<Notifications.NotificationRequest[]> {
  return (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.identifier.startsWith(ID_PREFIX));
}

async function cancel(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

/** 予約を、いま見込んだものに入れ替える（同じ日・同じ文の予約は、そのまま残す）。ask なら、まだ尋ねていなければ通知を許してもらう */
async function sync(ask: boolean): Promise<void> {
  const plan = planReminders(new Date(), await load());
  const wanted = new Map(plan.map((reminder) => [idOf(reminder), contentOf(reminder)]));
  const scheduled = await scheduledReminders();
  const unchanged = new Set(scheduled.filter((n) => n.content.body === wanted.get(n.identifier)?.body).map((n) => n.identifier));
  await cancel(scheduled.map((n) => n.identifier).filter((id) => !unchanged.has(id)));

  const add = plan.filter((reminder) => !unchanged.has(idOf(reminder)));
  if (add.length === 0 || !(await mayNotify(ask))) return;
  for (const reminder of add) {
    await Notifications.scheduleNotificationAsync({
      identifier: idOf(reminder),
      content: contentOf(reminder),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: CHANNEL_ID },
    });
  }
}

/**
 * 通知のチャンネル。Android は、通知を出す先のチャンネルを作っておかないと、通知の許可を尋ねる画面（Android 13 以上）も出ず、
 * 設定の画面でも「その他」と出る。iPhone などチャンネルのない端末では、何もしない（null が返る）
 */
const CHANNEL_ID = 'attendance-reminder';
async function ensureChannel(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '勤怠登録の通知',
      // eslint-disable-next-line import/namespace -- 実行時にはある（export * の先にある enum を、lint が辿れない）
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch (e) {
    console.log(`[reminder] NG 通知のチャンネルを作れませんでした: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 通知を出してよいか。ask なら、まだ尋ねていなければ尋ねる（断られていたら、もう尋ねない） */
async function mayNotify(ask: boolean): Promise<boolean> {
  await ensureChannel(); // 許可を尋ねる前に作る（Android 13 以上）
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return asked.granted;
}
