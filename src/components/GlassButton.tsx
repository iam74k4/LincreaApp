// 主な操作の、丸い（カプセルの）ボタン。iOS 26 では本物の Liquid Glass（差し色を透かしたガラス。押すと光って少しふくらむ）。
// ガラスが使えない端末（iOS 26 より前・Android）や「透明度を下げる」の設定では、差し色で塗ったふつうのボタンにする。
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

import { sizes, useColors } from '../theme';

/** ガラスを使えるか（iOS 26 以上で、その API があるとき。一部の iOS 26 のベータには API がなく、使うと落ちる） */
const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/** 「透明度を下げる」の設定を見る（オンのときはガラスにしない） */
function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((v) => active && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

type Props = {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function GlassButton({ onPress, disabled, accessibilityLabel, busy, style, children }: Props) {
  const c = useColors();
  const reduce = useReduceTransparency();
  const glass = GLASS && !reduce;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={style}
    >
      {({ pressed }) =>
        glass ? (
          <GlassView glassEffectStyle="regular" tintColor={c.accent} isInteractive style={styles.body}>
            {children}
          </GlassView>
        ) : (
          <View style={[styles.body, { backgroundColor: c.accent }, (pressed || disabled) && styles.dim]}>{children}</View>
        )
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    height: sizes.control,
    borderRadius: sizes.control / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dim: {
    opacity: 0.8,
  },
});
