import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useOnboarding } from '@/features/onboarding/store';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/ui/components/Icon';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts } from '@/ui/theme/tokens';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Путь', icon: 'path' },
  { name: 'today', title: 'Сегодня', icon: 'sun' },
  { name: 'practice', title: 'Практика', icon: 'target' },
  { name: 'dictionary', title: 'Словарь', icon: 'book' },
  { name: 'profile', title: 'Профиль', icon: 'user' },
];

/** From this width (a laptop or a tablet in landscape) the tabs become a side menu. */
const SIDEBAR_FROM = 900;

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sidebar = width >= SIDEBAR_FROM;
  const onboarded = useOnboarding((s) => s.data?.done);
  // First run: onboarding before anything else.
  if (onboarded === false) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        ...(sidebar
          ? {
              tabBarPosition: 'left',
              tabBarLabelPosition: 'beside-icon',
              tabBarActiveBackgroundColor: colors.primarySoft,
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderRightColor: colors.border,
                width: 220,
                paddingTop: 24 + insets.top,
                paddingHorizontal: 12,
              },
              tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 16, marginLeft: 16 },
            }
          : {
              // Explicit height: Golos Text's line height does not fit the default 49pt bar.
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                height: 62 + insets.bottom,
                paddingTop: 6,
                paddingBottom: 6 + insets.bottom,
              },
              tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
            }),
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: t.title,
            tabBarIcon: ({ color, size }) => (
              <Icon name={t.icon} size={size} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
