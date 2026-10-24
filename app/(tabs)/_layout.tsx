import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboarding } from '@/features/onboarding/store';
import { Icon } from '@/ui/components/Icon';
import { SideMenu, type SideMenuTab } from '@/ui/components/SideMenu';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts } from '@/ui/theme/tokens';

const TABS: SideMenuTab[] = [
  { name: 'course', title: 'Путь', icon: 'path' },
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
      tabBar={sidebar ? (props) => <SideMenu {...props} tabs={TABS} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarPosition: sidebar ? 'left' : 'bottom',
        // Explicit height and line height: Golos Text's descenders do not fit the default bar.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
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
