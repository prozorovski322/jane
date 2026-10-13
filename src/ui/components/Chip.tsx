import { StyleSheet } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

/** A toggle chip for filters. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <PressableScale
      role="button"
      aria-label={label}
      aria-selected={selected}
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.chip,
        {
          borderRadius: radius.pill,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.borderStrong,
        },
      ]}
    >
      <AppText variant="smallStrong" style={{ color: selected ? colors.onPrimary : colors.text }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 2,
    paddingHorizontal: 14,
    minHeight: MIN_TOUCH - 8,
    justifyContent: 'center',
  },
});
