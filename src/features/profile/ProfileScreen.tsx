import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { getLesson } from '@/core/content';
import { parseDay } from '@/core/progress/dates';
import { isMastered } from '@/core/srs/scheduler';
import { allCards } from '@/core/storage/srs-repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { IconButton } from '@/ui/components/IconButton';
import { AchievementsSection } from '../achievements/AchievementsSection';
import { WeekSummaryCards } from '../progress/WeekSummaryCard';
import { Screen, SectionTitle } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { PRACTICE_INFO, type PracticeKind } from '../practice/build';
import { loadHistory, loadSkillStats, SKILL_LABEL, type HistoryItem } from '../progress/insights';
import { GOALS, useOnboarding } from '../onboarding/store';
import { lastPlacement } from '../placement/apply';
import { FORECAST_TARGETS, loadForecast } from '../progress/forecast';
import { useProgress } from '../progress/store';
import { Button } from '@/ui/components/Button';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { SkillRadar } from './SkillRadar';

function Stat({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: 'xp' | 'accent' | 'success';
}) {
  return (
    <Card style={styles.stat}>
      <View accessible aria-label={`${label}: ${value}`}>
        <AppText variant="title" color={color ?? 'text'}>
          {value}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {label}
        </AppText>
      </View>
    </Card>
  );
}

function historyTitle(h: HistoryItem): string {
  if (h.kind === 'review') return 'Повторение';
  if (h.kind === 'practice') {
    const kind = h.lessonId.split('.')[1] as PracticeKind | undefined;
    return `Практика: ${kind && PRACTICE_INFO[kind] ? PRACTICE_INFO[kind].title : h.lessonId}`;
  }
  return getLesson(h.lessonId)?.title ?? h.lessonId;
}

function Calendar() {
  const { colors } = useTheme();
  const days = useProgress((s) => s.snapshot?.calendar ?? []);
  const max = Math.max(1, ...days.map((d) => d.xp));
  const active = days.filter((d) => d.xp > 0).length;
  return (
    <View
      accessible
      aria-label={`За 5 недель занятия были в ${active} из ${days.length} дней`}
      style={styles.calendar}
    >
      {days.map((d) => (
        <View
          key={d.day}
          style={[
            styles.cell,
            {
              backgroundColor:
                d.xp > 0 ? colors.primary : d.frozen ? colors.infoSoft : colors.surfaceAlt,
              opacity: d.xp > 0 ? 0.35 + 0.65 * (d.xp / max) : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function ProfileScreen() {
  const snap = useProgress((s) => s.snapshot);
  const completed = snap?.completedLessons;
  const goal = useOnboarding((s) => s.data?.goal);
  const data = useDbQuery(
    async (db) => {
      const [skills, history, cards, forecast, placement] = await Promise.all([
        loadSkillStats(db),
        loadHistory(db, 15),
        allCards(db, 'word'),
        loadForecast(db, completed ?? new Set()),
        lastPlacement(db),
      ]);
      return {
        skills,
        history,
        forecast,
        placement,
        learned: cards.filter(isMastered).length,
        learning: cards.length,
      };
    },
    [completed],
  );
  const forecast = data ? data.forecast : null;
  const placement = data ? data.placement : null;

  return (
    <Screen
      title="Профиль"
      subtitle={goal ? `Цель: ${GOALS[goal].toLowerCase()}` : undefined}
      right={
        <IconButton
          icon="sliders"
          label="Настройки"
          color="text"
          onPress={() => router.push('/settings')}
        />
      }
    >
      {snap && (
        <View style={styles.stats}>
          <Stat value={snap.totalXp} label="опыт" color="xp" />
          <Stat value={snap.streak} label="серия" color="accent" />
          <Stat value={data?.learned ?? '…'} label="выучено слов" color="success" />
          <Stat value={snap.completedLessons.size} label="уроков" />
        </View>
      )}

      <SectionTitle>Прогноз уровня</SectionTitle>
      <Card>
        {forecast &&
          FORECAST_TARGETS.map((t) => (
            <View key={t} style={styles.forecastRow}>
              <AppText variant="bodyStrong" style={styles.level}>
                {t}
              </AppText>
              <View style={styles.flex}>
                <ProgressBar value={forecast[t]} label={`Готовность к ${t}`} />
              </View>
              <AppText variant="small" color="textMuted" style={styles.percent}>
                {Math.round(forecast[t] * 20) * 5}%
              </AppText>
            </View>
          ))}
        <AppText variant="caption" color="textMuted">
          Оценка готовности по тесту уровня, пройденным урокам и точности ответов. Это не
          экзаменационный балл.
          {placement
            ? ` Последний тест: ${placement.level}, ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(placement.at))}.`
            : ''}
        </AppText>
        <Button
          label={placement ? 'Пройти тест уровня ещё раз' : 'Пройти тест уровня'}
          icon="target"
          variant="secondary"
          compact
          onPress={() => router.push('/placement')}
        />
      </Card>

      <SectionTitle>Итоги недели</SectionTitle>
      <WeekSummaryCards />

      <SectionTitle>Достижения</SectionTitle>
      <AchievementsSection />

      <SectionTitle>Навыки</SectionTitle>
      {data && (
        <Card>
          {data.skills.every((s) => s.accuracy === null) ? (
            <AppText variant="small" color="textMuted">
              Пройдите несколько уроков — здесь появится точность по каждому навыку.
            </AppText>
          ) : (
            <SkillRadar stats={data.skills} />
          )}
          {data.skills.map((s) => (
            <View key={s.skill} style={styles.skillRow} aria-hidden>
              <AppText variant="small" style={styles.flex}>
                {SKILL_LABEL[s.skill]}
              </AppText>
              <AppText variant="small" color="textMuted">
                {s.accuracy === null ? '—' : `${Math.round(s.accuracy * 100)}% · ${s.attempts}`}
              </AppText>
            </View>
          ))}
        </Card>
      )}

      <SectionTitle>Активность за 5 недель</SectionTitle>
      <Card>
        <Calendar />
        {snap && (
          <AppText variant="caption" color="textMuted">
            Заморозок серии в запасе: {snap.freezes}. Карточек в повторении: {data?.learning ?? '…'}
            .
          </AppText>
        )}
      </Card>

      <SectionTitle>История</SectionTitle>
      {data?.history.length ? (
        data.history.map((h) => (
          <Card key={h.id}>
            <View style={styles.skillRow}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{historyTitle(h)}</AppText>
                <AppText variant="caption" color="textMuted">
                  {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(
                    parseDay(h.day),
                  )}{' '}
                  · точность {Math.round(h.accuracy * 100)}%
                  {h.kind === 'test' ? (h.passed ? ' · сдан' : ' · не сдан') : ''}
                </AppText>
              </View>
              <AppText variant="smallStrong" color="xp">
                +{h.xp}
              </AppText>
            </View>
          </Card>
        ))
      ) : (
        <AppText variant="small" color="textMuted">
          Здесь будет история занятий.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexGrow: 1, flexBasis: '45%', padding: 12 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Exactly 7 days per row: 7 cells of 28 and 6 gaps of 6.
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: 7 * 28 + 6 * 6,
    alignSelf: 'center',
  },
  cell: { width: 28, height: 28, borderRadius: 6 },
  forecastRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  level: { width: 28 },
  percent: { width: 40, textAlign: 'right' },
});
