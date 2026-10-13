import { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export interface TextFieldProps extends TextInputProps {
  label: string;
  state?: 'idle' | 'correct' | 'wrong';
}

/** Answer input. Autocorrect is off so the app, not the keyboard, judges spelling. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, state = 'idle', style, multiline, ...rest },
  ref,
) {
  const { colors, radius, typography } = useTheme();
  const border =
    state === 'correct' ? colors.success : state === 'wrong' ? colors.error : colors.borderStrong;
  return (
    <TextInput
      ref={ref}
      aria-label={label}
      autoCorrect={false}
      autoCapitalize="none"
      spellCheck={false}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      maxFontSizeMultiplier={2}
      {...rest}
      style={[
        typography.body,
        styles.base,
        {
          color: colors.text,
          backgroundColor: colors.surface,
          borderColor: border,
          borderRadius: radius.lg,
          minHeight: multiline ? 140 : 56,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  base: { borderWidth: 2, paddingHorizontal: 16, paddingVertical: 12 },
});
