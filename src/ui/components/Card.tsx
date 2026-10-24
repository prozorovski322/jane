import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

/** A surface block. Pressable when `onPress` is given (then it needs an accessible label). */
export function Card({
  children,
  onPress,
  label,
  tone = 'surface',
  style,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  label?: string;
  tone?: 'surface' | 'primarySoft' | 'accentSoft' | 'xpSoft' | 'infoSoft';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, radius } = useTheme();
  const box = [
    styles.card,
    { backgroundColor: colors[tone], borderColor: colors.border, borderRadius: radius.lg },
    style,
  ];
  if (!onPress) return <View style={box}>{children}</View>;
  return (
    <PressableScale role="button" aria-label={label} onPress={onPress} style={box} testID={testID}>
      {children}
    </PressableScale>
  );
}

/** A tappable row: icon, title, subtitle, chevron. */
export function ListRow({
  icon,
  iconColor = 'primary',
  title,
  subtitle,
  right,
  onPress,
  done,
}: {
  icon?: IconName;
  iconColor?: keyof ThemeColors;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  done?: boolean;
}) {
  const { colors } = useTheme();
  const sentence = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);
  const a11y = [title, subtitle, done ? 'Сделано' : null]
    .filter(Boolean)
    .map((s) => sentence(s!))
    .join(' ');
  return (
    <Card onPress={onPress} label={a11y}>
      <View style={styles.row}>
        {icon && (
          <View
            style={[
              styles.icon,
              { backgroundColor: done ? colors.successSoft : colors.primarySoft },
            ]}
          >
            <Icon
              name={done ? 'check' : icon}
              size={20}
              color={done ? colors.success : colors[iconColor]}
            />
          </View>
        )}
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color={done ? 'textMuted' : 'text'}>
            {title}
          </AppText>
          {subtitle && (
            <AppText variant="small" color="textMuted">
              {subtitle}
            </AppText>
          )}
        </View>
        {right}
        {onPress && <Icon name="chevron-right" size={18} color={colors.textMuted} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 18, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
