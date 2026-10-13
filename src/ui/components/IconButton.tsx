import { StyleSheet } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH, type ThemeColors } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  icon: IconName;
  /** Required: icon buttons have no visible text. */
  label: string;
  onPress: () => void;
  size?: number;
  color?: keyof ThemeColors;
  filled?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function IconButton({
  icon,
  label,
  onPress,
  size = 24,
  color = 'textMuted',
  filled,
  disabled,
  testID,
}: IconButtonProps) {
  const { colors, radius } = useTheme();
  const box = Math.max(MIN_TOUCH, size + 24);
  return (
    <PressableScale
      testID={testID}
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.base,
        { width: box, height: box, borderRadius: filled ? radius.lg : radius.pill },
        filled && { backgroundColor: colors.primary },
      ]}
    >
      <Icon name={icon} size={size} color={filled ? colors.onPrimary : colors[color]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
