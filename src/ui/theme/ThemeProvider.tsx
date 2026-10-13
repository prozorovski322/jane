import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, radius, space, typography, type ThemeColors } from './tokens';

export type SchemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  space: typeof space;
  radius: typeof radius;
  typography: typeof typography;
}

/** Text sizes the learner can choose in the settings. */
export const FONT_SCALES = [
  { value: 0.9, label: 'Мелкий' },
  { value: 1, label: 'Обычный' },
  { value: 1.15, label: 'Крупный' },
  { value: 1.3, label: 'Очень крупный' },
] as const;

/** Scales every text style; line heights follow so large text never overlaps. */
export function scaleTypography(scale: number): typeof typography {
  if (scale === 1) return typography;
  return Object.fromEntries(
    Object.entries(typography).map(([k, v]) => [
      k,
      {
        ...v,
        fontSize: Math.round(v.fontSize * scale),
        lineHeight: Math.round(v.lineHeight * scale),
      },
    ]),
  ) as typeof typography;
}

function makeTheme(scheme: 'light' | 'dark', fontScale = 1): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    space,
    radius,
    typography: scaleTypography(fontScale),
  };
}

const ThemeContext = createContext<Theme>(makeTheme('light'));

export function ThemeProvider({
  preference = 'system',
  fontScale = 1,
  children,
}: {
  preference?: SchemePreference;
  fontScale?: number;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const theme = useMemo(() => makeTheme(scheme, fontScale), [scheme, fontScale]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
