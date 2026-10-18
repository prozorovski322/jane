/**
 * Font files for the app: the full TTF fonts. The website uses smaller WOFF2 subsets instead
 * (fontFiles.web.ts). Keys are the family names in tokens.ts.
 */
import { GolosText_400Regular } from '@expo-google-fonts/golos-text/400Regular';
import { GolosText_500Medium } from '@expo-google-fonts/golos-text/500Medium';
import { GolosText_600SemiBold } from '@expo-google-fonts/golos-text/600SemiBold';
import { GolosText_700Bold } from '@expo-google-fonts/golos-text/700Bold';
import { Unbounded_600SemiBold } from '@expo-google-fonts/unbounded/600SemiBold';

export const FONT_FILES = {
  Unbounded_600SemiBold,
  GolosText_400Regular,
  GolosText_500Medium,
  GolosText_600SemiBold,
  GolosText_700Bold,
};
