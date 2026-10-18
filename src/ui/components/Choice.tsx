import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type ChoiceState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

export interface ChoiceProps {
  label?: string;
  /** Custom content (e.g. a picture); `label` is then still used as the accessible name. */
  children?: React.ReactNode;
  state?: ChoiceState;
  onPress?: () => void;
  disabled?: boolean;
  /** Short key shown on the left, e.g. "1". Helps keyboard and switch-control users. */
  index?: number;
  /** Smaller text and padding for narrow columns (match pairs, sentence words). */
  compact?: boolean;
  /**
   * "radio" (default): one option of a radiogroup, read as selected or not. "button": a toggle
   * outside a group of options (match pairs, the words of a sentence).
   */
  role?: 'radio' | 'button';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** One answer option. Correct/wrong states use an icon as well as color. */
export function Choice({
  label,
  children,
  state = 'idle',
  onPress,
  disabled,
  index,
  compact,
  role = 'radio',
  style,
  testID,
}: ChoiceProps) {
  const { colors, radius } = useTheme();
  const look = {
    idle: { bg: colors.surface, border: colors.border, fg: colors.text },
    selected: { bg: colors.primarySoft, border: colors.primary, fg: colors.text },
    correct: { bg: colors.successSoft, border: colors.success, fg: colors.text },
    wrong: { bg: colors.errorSoft, border: colors.error, fg: colors.text },
    dimmed: { bg: colors.surface, border: colors.border, fg: colors.textMuted },
  }[state];
  // Spoken state; must not echo option texts like «Верно» / «Неверно».
  const stateLabel =
    state === 'correct' ? ' — правильный ответ' : state === 'wrong' ? ' — ваш ответ, ошибка' : '';

  return (
    <PressableScale
      testID={testID}
      role={role}
      aria-label={`${label ?? ''}${stateLabel}`}
      {...(role === 'radio'
        ? { 'aria-checked': state === 'selected' }
        : { 'aria-pressed': state === 'selected' })}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: look.bg,
          borderColor: look.border,
          borderRadius: radius.lg,
          minHeight: MIN_TOUCH + 8,
        },
        compact && styles.compact,
        style,
      ]}
    >
      {index !== undefined && (
        <View style={[styles.key, { borderColor: colors.border, borderRadius: radius.sm }]}>
          <AppText variant="caption" color="textMuted">
            {index}
          </AppText>
        </View>
      )}
      <View style={styles.content}>
        {children ?? (
          <AppText variant={compact ? 'smallStrong' : 'bodyStrong'} style={{ color: look.fg }}>
            {label}
          </AppText>
        )}
      </View>
      {state === 'correct' && <Icon name="check" size={compact ? 16 : 22} color={colors.success} />}
      {state === 'wrong' && <Icon name="cross" size={compact ? 16 : 22} color={colors.error} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderBottomWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compact: { paddingHorizontal: 10, gap: 6 },
  key: { width: 26, height: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
});
