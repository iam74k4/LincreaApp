// 保存（登録・削除など）のあいだ、ページの上に出す「保存しています（3/9）」。
//
// EZCraft の保存は、通信を1つずつ順に送るので、長いと 10 秒ほどかかる。そのあいだ、くるくるだけだと
// 止まっているのか進んでいるのか分からないので、段の数と棒で進み具合を見せる（src/webview/bridge.ts の SAVE_WATCH_JS）。
//   - 5 秒を超えたら、待ってよいことを伝える
//   - 重ねて開いた画面なら、‹ で戻っても保存は裏で続くことを伝える（src/webview/backgroundSaves.ts）
//   - シートの画面は裏に回せないので、‹ で戻ろうとしたら、終わってから戻る（途中で戻ると保存が切れるため）
//   - ほかの画面が保存しているあいだに「登録」などを押したら、前の保存が終わるのを待っていることを伝える
// ページは押せないようにしておく（2回押して、2回保存しないように）。上のヘッダー（‹）は押せる。
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { saveProgress, savingText, type SaveSize } from '../webview/saveSizes';

/** すぐ終わる保存で、ちらっと出ないように、少し待ってから出す */
const SHOW_AFTER_MS = 300;
/** これを超えたら、待ってよいことを伝える */
const SLOW_AFTER_MS = 5000;

type Props = {
  startedAt: number;
  writes: number;
  steps: number;
  size: SaveSize | null;
  /** 保存のあいだに戻ろうとした（終わったら戻る。シートの画面だけ） */
  backAfter: boolean;
  /** ‹ で戻っても、保存を裏で続けられる */
  canLeave: boolean;
  /** ほかの画面の保存が終わるのを待っている（まだこの画面の保存は始まっていない） */
  waiting?: boolean;
};

export function SaveProgress({ startedAt, writes, steps, size, backAfter, canLeave, waiting = false }: Props) {
  const c = useColors();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const elapsed = now - startedAt;
  const progress = saveProgress(steps, size);
  const shown = elapsed >= SHOW_AFTER_MS || backAfter;

  return (
    // 押せないようにする面は、出す前から置いておく
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {shown && (
        // 後ろを少し暗くして、待つあいだはページを押せないことを見せる
        <View style={[styles.center, styles.dim]} pointerEvents="none">
          <View style={[styles.card, { backgroundColor: c.card }]} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
            <ActivityIndicator color={c.textSecondary} />
            <Text style={[styles.title, { color: c.text }]}>{waiting ? '前の保存を待っています' : savingText(writes, size)}</Text>
            {!waiting && progress !== null && (
              <View style={[styles.track, { backgroundColor: c.separator }]}>
                <View style={[styles.bar, { backgroundColor: c.accent, width: `${Math.round(progress * 100)}%` }]} />
              </View>
            )}
            {waiting && <Text style={[styles.note, { color: c.textSecondary }]}>{'前の保存が終わったら、\nこの画面の保存を始めます'}</Text>}
            {!waiting && elapsed >= SLOW_AFTER_MS && (
              <Text style={[styles.note, { color: c.textSecondary }]}>{'通信に時間がかかっています。\nこのままお待ちください'}</Text>
            )}
            {backAfter && <Text style={[styles.note, { color: c.textSecondary }]}>{'保存が終わったら、\n前の画面に戻ります'}</Text>}
            {!waiting && canLeave && !backAfter && (
              <Text style={[styles.hint, { color: c.textSecondary }]}>{'‹ で戻っても、保存は続きます'}</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dim: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  card: {
    alignSelf: 'stretch',
    maxWidth: 360,
    marginHorizontal: 'auto',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 22,
    paddingHorizontal: 22,
    borderRadius: 22,
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  track: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: {
    height: 4,
    borderRadius: 2,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
