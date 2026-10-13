import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export interface AppearProps extends ViewProps {
  children: ReactNode;
  /** Slide up from below, or grow in place. */
  variant?: 'slide-up' | 'zoom' | 'fade';
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance animation that never hides content: the element is visible from the first frame and
 * only its offset, scale and opacity animate. (Layout `entering` animations keep an element
 * hidden until the animation starts, which can leave critical UI invisible.)
 */
export function Appear({
  children,
  variant = 'slide-up',
  duration = 220,
  style,
  ...rest
}: AppearProps) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    t.set(reduced ? 1 : withTiming(1, { duration }));
  }, [t, reduced, duration]);

  const animated = useAnimatedStyle(() => {
    const p = t.get();
    if (variant === 'zoom')
      return { opacity: 0.4 + 0.6 * p, transform: [{ scale: 0.85 + 0.15 * p }] };
    if (variant === 'fade') return { opacity: 0.4 + 0.6 * p };
    return { transform: [{ translateY: (1 - p) * 32 }] };
  });

  return (
    <Animated.View {...rest} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}
