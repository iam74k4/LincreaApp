// 保存（登録・削除など）のあいだ、ページの上に出す「保存しています（3/9）」。
//
// EZCraft の保存は、通信を1つずつ順に送るので、長いと 10 秒ほどかかる。そのあいだ、くるくるだけだと
// 止まっているのか進んでいるのか分からないので、段の数と棒で進み具合を見せる（src/webview/bridge.ts の SAVE_WATCH_JS）。
//   - 5 秒を超えたら、待ってよいことを伝える
//   - 保存を裏で続けられないとき、‹ で戻ろうとしたら、すぐには戻らず、終わってから戻る（途中で戻ると保存が切れるため）
//   - 保存を裏で続けられるとき（onLeave。ページを置き場へ移せるアプリだけ。src/webview/savePark.tsx）は、‹ で戻っても保存は続くことを伝える。
//     右へなぞっても戻れる（保存のあいだは iOS の戻るスワイプを止めているため）
//   - ほかの画面が保存しているあいだに「登録」などを押したら、前の保存が終わるのを待っていることを伝える（waiting="turn"）。
//     待っているあいだに戻ろうとしたら、この画面の保存が始まってから戻る
//   - 同じ日のページを、ほかの画面が裏で保存しているあいだに開いたら、終わってから開き直すことを伝える（waiting="samePage"）
// ページは押せないようにしておく（2回押して、2回保存しないように）。上のヘッダー（‹）は押せる。
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, PanResponder, StyleSheet, Text, View } from 'react-native';

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
  /**
   * まだこの画面の保存は始まっていない。
   * turn: ほかの画面の保存が終わるのを待っている。samePage: 同じページの裏の保存が終わったら、開き直す
   */
  waiting?: 'turn' | 'samePage';
  /** 保存を裏で続けて戻る（あれば、戻れることを伝え、右へなぞったら呼ぶ。保存のあいだは iOS の戻るスワイプを止めているため） */
  onLeave?: () => void;
};

/** これだけ右へなぞるか、速く払ったら、戻る */
const SWIPE_BACK_DISTANCE = 60;
const SWIPE_BACK_VELOCITY = 0.5;

const WAITING_TEXT = {
  turn: { title: '前の保存を待っています', note: '前の保存が終わったら、\nこの画面の保存を始めます' },
  samePage: { title: 'この日を保存しています', note: '保存が終わったら、\n新しい内容で開き直します' },
};

export function SaveProgress({ startedAt, writes, steps, size, backAfter, waiting, onLeave }: Props) {
  const c = useColors();
  // 横へのなぞりだけを受ける（縦や斜めは受けない。押しただけでも受けない）。
  // onLeave は変わらない関数を渡してもらう（なぞっている途中で作り直すと、なぞった長さが分からなくなる）
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => onLeave !== undefined && g.dx > 12 && Math.abs(g.dy) < g.dx * 0.6,
        onPanResponderRelease: (_, g) => {
          if (onLeave && (g.dx > SWIPE_BACK_DISTANCE || g.vx > SWIPE_BACK_VELOCITY)) onLeave();
        },
      }),
    [onLeave],
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const elapsed = now - startedAt;
  const progress = saveProgress(steps, size);
  const shown = elapsed >= SHOW_AFTER_MS || backAfter;
  const wait = waiting ? WAITING_TEXT[waiting] : null;

  return (
    // 押せないようにする面は、出す前から置いておく
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal {...swipe.panHandlers}>
      {shown && (
        // 後ろを少し暗くして、待つあいだはページを押せないことを見せる
        <View style={[styles.center, styles.dim]} pointerEvents="none">
          <View style={[styles.card, { backgroundColor: c.card }]} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
            <ActivityIndicator color={c.textSecondary} />
            <Text style={[styles.title, { color: c.text }]}>{wait ? wait.title : savingText(writes, size)}</Text>
            {!wait && progress !== null && (
              <View style={[styles.track, { backgroundColor: c.separator }]}>
                <View style={[styles.bar, { backgroundColor: c.accent, width: `${Math.round(progress * 100)}%` }]} />
              </View>
            )}
            {wait && <Text style={[styles.note, { color: c.textSecondary }]}>{wait.note}</Text>}
            {/* 戻っても保存が続くときは「このままお待ちください」とは言わない（下の「戻っても、保存は続きます」と食い違うので） */}
            {!wait && elapsed >= SLOW_AFTER_MS && (
              <Text style={[styles.note, { color: c.textSecondary }]}>{onLeave ? '通信に時間がかかっています' : '通信に時間がかかっています。\nこのままお待ちください'}</Text>
            )}
            {backAfter && (
              <Text style={[styles.note, { color: c.textSecondary }]}>{wait && onLeave ? '保存が始まったら、\n前の画面に戻ります' : '保存が終わったら、\n前の画面に戻ります'}</Text>
            )}
            {onLeave && !backAfter && waiting !== 'samePage' && (
              <Text style={[styles.hint, { color: c.textSecondary }]}>{wait ? '戻っても、この画面の保存は行われます' : '戻っても、保存は続きます'}</Text>
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
