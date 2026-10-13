import { StyleSheet, View } from 'react-native';

import { dayOf, addDays, parseDay } from '@/core/progress/dates';
import { weekStart, type WeekSummary } from '@/core/progress/week';
import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';

import { loadWeekSummary } from './week';

const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line} accessible aria-label={`${label}: ${value}`}>
      <AppText variant="small" color="textMuted">
        {label}
      </AppText>
      <AppText variant="smallStrong">{value}</AppText>
    </View>
  );
}

function Summary({ title, week }: { title: string; week: WeekSummary }) {
  const range = `${fmt.format(parseDay(week.start))} — ${fmt.format(parseDay(addDays(week.start, 6)))}`;
  const gain = week.xp - week.previousXp;
  return (
    <Card>
      <AppText variant="heading">{title}</AppText>
      <AppText variant="caption" color="textMuted">
        {range}
      </AppText>
      {week.activeDays === 0 ? (
        <AppText variant="small" color="textMuted">
          В эту неделю занятий не было. Один короткий урок — хороший способ вернуться.
        </AppText>
      ) : (
        <>
          <Line label="Опыт" value={`${week.xp} XP`} />
          <Line label="Дней с занятиями" value={String(week.activeDays)} />
          <Line label="Уроков" value={String(week.lessons)} />
          <Line label="Карточек повторено" value={String(week.reviews)} />
          <Line label="Время" value={`${week.minutes} мин`} />
          {week.accuracy !== null && (
            <Line label="Точность" value={`${Math.round(week.accuracy * 100)}%`} />
          )}
          {gain > 0 && week.previousXp > 0 && (
            <AppText variant="small" color="success">
              На {gain} XP больше, чем неделей раньше.
            </AppText>
          )}
        </>
      )}
    </Card>
  );
}

/** This week so far and the week before: gentle, no comparisons that could discourage. */
export function WeekSummaryCards() {
  const start = weekStart(dayOf(new Date()));
  const data = useDbQuery(
    async (db) => ({
      current: await loadWeekSummary(db, start),
      previous: await loadWeekSummary(db, addDays(start, -7)),
    }),
    [start],
  );
  const current = data ? data.current : null;
  const previous = data ? data.previous : null;
  if (!current || !previous) return null;
  return (
    <>
      <Summary title="Эта неделя" week={current} />
      {previous.activeDays > 0 && <Summary title="Прошлая неделя" week={previous} />}
    </>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
