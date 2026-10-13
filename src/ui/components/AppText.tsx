import { Text, type TextProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors, TypographyVariant } from '../theme/tokens';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
  align?: 'left' | 'center' | 'right';
}

/** Text with Jane typography. Scales with the system font size, capped so layouts survive. */
export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  const { colors, typography } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={2}
      {...rest}
      style={[typography[variant], { color: colors[color] }, align && { textAlign: align }, style]}
    />
  );
}
