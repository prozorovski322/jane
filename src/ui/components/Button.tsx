import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { feedback } from '@/core/feedback/feedback';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** Spoken description when the label alone is not enough. */
  accessibilityHint?: string;
  compact?: boolean;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  accessibilityHint,
  compact,
  testID,
}: ButtonProps) {
  const { colors, radius } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    success: { bg: colors.success, fg: colors.onSuccess, border: colors.success },
    danger: { bg: colors.error, fg: colors.onError, border: colors.error },
  }[variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      testID={testID}
      role="button"
      aria-label={label}
      aria-disabled={inactive}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={[
        styles.base,
        {
          minHeight: compact ? MIN_TOUCH : 56,
          borderRadius: radius.lg,
          backgroundColor: inactive && variant !== 'ghost' ? colors.surfaceAlt : palette.bg,
          borderColor: inactive && variant !== 'ghost' ? colors.border : palette.border,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={20} color={inactive ? colors.textMuted : palette.fg} />}
          <AppText variant="bodyStrong" style={{ color: inactive ? colors.textMuted : palette.fg }}>
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 2, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
