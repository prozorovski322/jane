import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useProgress } from '../progress/store';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { Icon, type IconName } from '@/ui/components/Icon';
import { useTheme } from '@/ui/theme/ThemeProvider';

export function LearningTools() {
  const { colors } = useTheme();
  const due = useProgress((s) => s.dueCount);
  const items: { title: string; subtitle: string; icon: IconName; href: Href }[] = [
    {
      title: 'Умное повторение',
      subtitle: due ? `Сейчас к повторению: ${due}` : 'Карточки по вашему расписанию',
      icon: 'refresh',
      href: '/review',
    },
    {
      title: 'Мой словарь',
      subtitle: 'Слова и фразы для практики',
      icon: 'cards',
      href: '/dictionary',
    },
    {
      title: 'Тест уровня',
      subtitle: 'Найдите свою точку старта',
      icon: 'target',
      href: '/placement',
    },
    {
      title: 'Учёба за границей',
      subtitle: 'От колледжа до собеседования',
      icon: 'book',
      href: '/study',
    },
  ];
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Card
          key={item.title}
          onPress={() => router.push(item.href)}
          label={`${item.title}. ${item.subtitle}`}
          style={styles.card}
        >
          <Icon name={item.icon} color={colors.primary} size={23} />
          <AppText variant="bodyStrong">{item.title}</AppText>
          <AppText variant="caption" color="textMuted">
            {item.subtitle}
          </AppText>
        </Card>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexBasis: '45%', flexGrow: 1, minWidth: 125 },
});
