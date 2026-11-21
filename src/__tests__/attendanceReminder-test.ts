// 勤怠登録の通知（src/attendance/attendanceReminder.ts）。ログアウトしたら、前の人の通知の予約を必ず消す。
// 予約を出す前に、通知のチャンネルを作る（Android 13 以上は、チャンネルがないと許可を尋ねられない。iPhone では何もしない）。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { attendanceRemindersFor, forgetAttendanceReminders, noteAttendanceDays } from '../attendance/attendanceReminder';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
  useLastNotificationResponse: jest.fn(),
  setNotificationHandler: jest.fn(),
}));
const notifications = Notifications as jest.Mocked<typeof Notifications>;

/** 予約や消すのは、順に並べて走らせる。終わるまで待つ */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0)).then(() => new Promise((resolve) => setTimeout(resolve, 0)));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
    { identifier: 'attendance-reminder-2026-11-25' } as Notifications.NotificationRequest,
    { identifier: 'other-app-reminder' } as Notifications.NotificationRequest,
  ]);
  notifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
});

test('ログアウト: このアプリの勤怠の通知の予約だけを消す（ほかの予約は消さない）', async () => {
  forgetAttendanceReminders();
  await settled();
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('attendance-reminder-2026-11-25');
  expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other-app-reminder');
});

test('ログアウト: 覚えていた勤務表の状態を消せなくても、通知の予約は先に消してある（前の人に通知が届かない）', async () => {
  (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('disk error'));
  forgetAttendanceReminders();
  await settled();
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('attendance-reminder-2026-11-25');
});

test('予約を出す前に、通知のチャンネルを作ってから、許可を確かめる（Android 13 以上で、許可を尋ねられるように）', async () => {
  // 2026-11-02（月）の朝。11 月の勤務日がすべて未登録なら、この先の水曜の通知を予約する
  jest.useFakeTimers({ now: new Date(2026, 10, 2, 9, 0) });
  try {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as Notifications.NotificationPermissionsStatus);
    notifications.scheduleNotificationAsync.mockResolvedValue('id');
    noteAttendanceDays('2026-11', 'u'.repeat(30)); // u: 未登録の勤務日（src/attendance/attendanceSchedule.ts）
    await jest.advanceTimersByTimeAsync(2000); // 少し待ってから（SETTLE_MS）予約し直す
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith('attendance-reminder', expect.objectContaining({ name: '勤怠登録の通知' }));
    expect(notifications.getPermissionsAsync).toHaveBeenCalled();
    expect(notifications.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      notifications.getPermissionsAsync.mock.invocationCallOrder[0],
    );
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalled();
    for (const call of notifications.scheduleNotificationAsync.mock.calls) {
      expect(call[0].trigger).toMatchObject({ channelId: 'attendance-reminder' });
    }
  } finally {
    jest.useRealTimers();
  }
});

test('別の人がログインしたら、前の人の通知の予約と、覚えていた勤務表の状態を消す（ログアウトを通らなかったときも）', async () => {
  // 起動したとき: 端末に残っていたのは、前にログインしていた人（ログインが切れていて、入り直せなかった）
  attendanceRemindersFor('user-a');
  await settled();
  await AsyncStorage.setItem('myapp.attendanceDays', '{}');
  expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  // ログイン画面から、別の人が入った
  attendanceRemindersFor('user-b');
  await settled();
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('attendance-reminder-2026-11-25');
  expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other-app-reminder');
  expect(await AsyncStorage.getItem('myapp.attendanceDays')).toBeNull();
  expect(await AsyncStorage.getItem('myapp.attendanceOwner')).toBe('user-b');
});

test('同じ人が入り直したとき（大文字・小文字の違いも）は、通知の予約を残す', async () => {
  attendanceRemindersFor('user-a');
  await settled();
  attendanceRemindersFor('User-A');
  await settled();
  expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
});

test('ログアウトしたら、だれの通知かも忘れる（次の人のときに、何も消さずに始める）', async () => {
  attendanceRemindersFor('user-a');
  forgetAttendanceReminders();
  await settled();
  expect(await AsyncStorage.getItem('myapp.attendanceOwner')).toBeNull();
  jest.clearAllMocks();
  attendanceRemindersFor('user-b');
  await settled();
  expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('myapp.attendanceOwner')).toBe('user-b');
});
