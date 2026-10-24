import { useSettings } from '@/features/settings/store';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton } from './IconButton';

export function ThemeToggle() {
  const { scheme } = useTheme();
  const update = useSettings((s) => s.update);
  return (
    <IconButton
      icon={scheme === 'dark' ? 'sun' : 'moon'}
      label={scheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      onPress={() => update({ theme: scheme === 'dark' ? 'light' : 'dark' })}
    />
  );
}
