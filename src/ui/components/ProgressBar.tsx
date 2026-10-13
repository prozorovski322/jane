import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  const width = useSharedValue(value);

  useEffect(() => {
    width.set(reduced ? value : withTiming(value, { duration: 300 }));
  }, [value, reduced, width]);

  const fill = useAnimatedStyle(() => ({ width: `${Math.round(width.get() * 100)}%` }));

  return (
    <View
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      style={[styles.track, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: colors.primary, borderRadius: radius.pill }, fill]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 14, flex: 1, overflow: 'hidden' },
  fill: { height: '100%' },
});
