/**
 * The tab navigation as a side menu on wide screens (a computer, a tablet in landscape): the
 * site's name on top, the sections, and Settings at the bottom.
 */
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export const SIDE_MENU_WIDTH = 220;

export interface SideMenuTab {
  name: string;
  title: string;
  icon: IconName;
}

function Item({
  title,
  icon,
  active,
  onPress,
  role,
}: {
  title: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
  role: 'tab' | 'link';
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      role={role}
      aria-label={title}
      aria-selected={role === 'tab' ? active : undefined}
      onPress={onPress}
      // react-native-web adds `hovered` to the state; the native types do not know it.
      style={(s) => [
        styles.item,
        { borderRadius: radius.md },
        active
          ? { backgroundColor: colors.primarySoft }
          : (s as { hovered?: boolean }).hovered && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      <Icon name={icon} size={22} color={active ? colors.primary : colors.textMuted} />
      <AppText variant="bodyStrong" style={{ color: active ? colors.primary : colors.text }}>
        {title}
      </AppText>
    </Pressable>
  );
}

export function SideMenu({
  state,
  navigation,
  insets,
  tabs,
}: BottomTabBarProps & { tabs: readonly SideMenuTab[] }) {
  const { colors } = useTheme();
  return (
    <View
      role="navigation"
      style={[
        styles.menu,
        {
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
          paddingTop: 24 + insets.top,
          paddingBottom: 16 + insets.bottom,
        },
      ]}
    >
      <View style={styles.brand}>
        <AppText variant="title">Jane</AppText>
        <AppText variant="caption" color="textMuted">
          английский с нуля до C1
        </AppText>
      </View>
      <View role="tablist" style={styles.list}>
        {state.routes.map((route, i) => {
          const tab = tabs.find((t) => t.name === route.name);
          if (!tab) return null;
          const active = state.index === i;
          return (
            <Item
              key={route.key}
              role="tab"
              title={tab.title}
              icon={tab.icon}
              active={active}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
      <View style={styles.footer}>
        <Item
          role="link"
          title="Настройки"
          icon="sliders"
          active={false}
          onPress={() => router.push('/settings')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { width: SIDE_MENU_WIDTH, borderRightWidth: 1, paddingHorizontal: 12 },
  brand: { paddingHorizontal: 12, paddingBottom: 20, gap: 2 },
  list: { gap: 4 },
  footer: { marginTop: 'auto' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, height: 48 },
});
