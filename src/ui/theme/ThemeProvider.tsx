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

function makeTheme(scheme: 'light' | 'dark'): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    space,
    radius,
    typography,
  };
}

const ThemeContext = createContext<Theme>(makeTheme('light'));

export function ThemeProvider({
  preference = 'system',
  children,
}: {
  preference?: SchemePreference;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const theme = useMemo(() => makeTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
