import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';

/** Shown when lesson content could not be downloaded (the website loads units on demand). */
export function LoadFailed({ onRetry, onExit }: { onRetry: () => void; onExit: () => void }) {
  const { space } = useTheme();
  return (
    <SafeAreaView style={[styles.center, { padding: space.lg, gap: space.md }]}>
      <AppText variant="heading">Не удалось загрузить урок</AppText>
      <AppText>Проверьте подключение к интернету и попробуйте ещё раз.</AppText>
      <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
        <Button label="Попробовать ещё раз" onPress={onRetry} />
        <Button label="Назад" variant="secondary" onPress={onExit} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
