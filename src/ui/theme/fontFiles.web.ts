/**
 * Font files for the website: WOFF2 subsets with only the characters the course uses
 * (scripts/web-fonts.mjs), about 110 KB together instead of 620 KB of TTF.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles assets through require. */
export const FONT_FILES = {
  Unbounded_600SemiBold: require('../../../assets/fonts/web/Unbounded-600.woff2'),
  GolosText_400Regular: require('../../../assets/fonts/web/GolosText-400.woff2'),
  GolosText_500Medium: require('../../../assets/fonts/web/GolosText-500.woff2'),
  GolosText_600SemiBold: require('../../../assets/fonts/web/GolosText-600.woff2'),
  GolosText_700Bold: require('../../../assets/fonts/web/GolosText-700.woff2'),
};
