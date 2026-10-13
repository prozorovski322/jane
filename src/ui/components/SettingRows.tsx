import type { ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';
import { AppText } from './AppText';
import { Chip } from './Chip';

/** A labelled on/off setting. */
export function SwitchRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description && (
          <AppText variant="small" color="textMuted">
            {description}
          </AppText>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        aria-label={label}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

/** A labelled single choice shown as chips. */
export function ChipRow<T extends string | number>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      <View>
        <AppText variant="bodyStrong">{label}</AppText>
        {description && (
          <AppText variant="small" color="textMuted">
            {description}
          </AppText>
        )}
      </View>
      <View style={styles.chips} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <Chip
            key={String(o.value)}
            label={o.label}
            selected={o.value === value}
            onPress={() => onChange(o.value)}
          />
        ))}
      </View>
    </View>
  );
}

/** A group of related settings under one card. */
export function SettingGroup({ children }: { children: ReactNode }) {
  return <View style={styles.groupBox}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH },
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupBox: { gap: 16 },
});
