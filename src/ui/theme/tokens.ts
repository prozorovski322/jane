/**
 * Jane design tokens. The palette is original: teal for action, coral for streaks and
 * celebrations, sun for XP, iris for listening and info, on warm "paper" neutrals.
 * Semantic colors meet WCAG AA for text on their intended backgrounds.
 */

export const palette = {
  teal: {
    50: '#E6F5F4',
    100: '#C2E8E5',
    300: '#5FC2BC',
    500: '#0E8C86',
    600: '#0B7570',
    700: '#095E5A',
    900: '#053533',
  },
  coral: { 100: '#FFE3DC', 300: '#F79A86', 500: '#EF6A4F', 700: '#B8442D' },
  sun: { 100: '#FFF2C7', 300: '#FFD65C', 500: '#F2B800', 700: '#8A6A00' },
  iris: { 100: '#E4E8FF', 300: '#98A5F5', 500: '#5468E8', 700: '#3341B0' },
  sand: {
    0: '#FFFFFF',
    50: '#FBF8F3',
    100: '#F4EFE7',
    200: '#E8E1D6',
    300: '#D6CDBF',
    500: '#8F8577',
    600: '#6B6258',
    700: '#4A433B',
    800: '#2F2A24',
    850: '#2A251F',
    900: '#1E1A16',
    950: '#14110E',
  },
  green: { 100: '#E3F4EA', 300: '#7FD3A3', 600: '#2A7F4F', 900: '#173525' },
  red: { 100: '#FBE6E4', 300: '#F0807A', 600: '#B93A33', 900: '#3D1E1C' },
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  xp: string;
  xpSoft: string;
  info: string;
  infoSoft: string;
  success: string;
  successSoft: string;
  onSuccess: string;
  error: string;
  errorSoft: string;
  onError: string;
  focus: string;
  overlay: string;
}

const { teal, coral, sun, iris, sand, green, red } = palette;

export const lightColors: ThemeColors = {
  background: sand[50],
  surface: sand[0],
  surfaceAlt: sand[100],
  border: sand[200],
  borderStrong: sand[300],
  text: sand[900],
  textMuted: sand[600],
  primary: teal[600],
  primaryPressed: teal[700],
  onPrimary: sand[0],
  primarySoft: teal[50],
  accent: coral[700],
  accentSoft: coral[100],
  xp: sun[700],
  xpSoft: sun[100],
  info: iris[700],
  infoSoft: iris[100],
  success: green[600],
  successSoft: green[100],
  onSuccess: sand[0],
  error: red[600],
  errorSoft: red[100],
  onError: sand[0],
  focus: iris[500],
  overlay: 'rgba(20,17,14,0.45)',
};

export const darkColors: ThemeColors = {
  background: '#0B0B0B',
  surface: '#171717',
  surfaceAlt: '#222222',
  border: '#333333',
  borderStrong: '#4A4A4A',
  text: '#F4EFE7',
  textMuted: '#B3A999',
  primary: teal[300],
  primaryPressed: teal[100],
  onPrimary: teal[900],
  primarySoft: '#10302E',
  accent: coral[300],
  accentSoft: '#3A211B',
  xp: sun[300],
  xpSoft: '#352C10',
  info: iris[300],
  infoSoft: '#1E2244',
  success: green[300],
  successSoft: green[900],
  onSuccess: '#0E2A1A',
  error: red[300],
  errorSoft: red[900],
  onError: '#2A0F0D',
  focus: iris[300],
  overlay: 'rgba(0,0,0,0.6)',
};

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;

export const radius = { sm: 8, md: 14, lg: 22, xl: 28, pill: 999 } as const;

/** Minimum size of anything tappable (Apple HIG 44, Material 48). */
export const MIN_TOUCH = 48;

export const fonts = {
  display: 'Unbounded_600SemiBold',
  regular: 'GolosText_400Regular',
  medium: 'GolosText_500Medium',
  semibold: 'GolosText_600SemiBold',
  bold: 'GolosText_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30 },
  heading: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  prompt: { fontFamily: fonts.medium, fontSize: 21, lineHeight: 30 },
  small: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
} as const;

export type TypographyVariant = keyof typeof typography;
