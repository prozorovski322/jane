import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { getCourse } from '@/core/content';
import { dayOf, parseDay } from '@/core/progress/dates';
import { getDb } from '@/core/storage';
import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Card, ListRow } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { Icon, type IconName } from '@/ui/components/Icon';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { Screen, SectionTitle } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { KIND_ICON } from '../path/kinds';
import { pathState } from '../path/state';
import { StreakXp } from '../progress/Badges';
import { WeekGoal } from '../progress/WeekGoal';
import { QuestsCard } from '../quests/QuestsCard';
import { loadToday, loadWeakSpots } from '../progress/insights';
import { dailyMinutes, setDailyMinutes } from '../progress/service';
import { useProgress } from '../progress/store';
import { courseExercises } from '../review/sources';
import { isDone, todayPlan, type PlanItem } from './plan';

const MINUTES = [5, 10, 15, 30];
const NO_PLAN: PlanItem[] = [];
const NO_KINDS = new Map<string, string>();
const WEEKDAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function hrefOf(item: PlanItem): Href {
  if (item.kind === 'review') return '/review';
  if (item.kind === 'lesson') return `/lesson/${item.ref}`;
  return `/practice/${item.ref.replace(/^practice\./, '')}`;
}

function iconOf(item: PlanItem, lessonKind: (id: string) => string | undefined): IconName {
  if (item.kind === 'review') return 'refresh';
  if (item.kind === 'practice')
    return item.ref.includes('listening')
      ? 'speaker'
      : item.ref.includes('speaking')
        ? 'mic'
        : 'target';
  return KIND_ICON[lessonKind(item.ref) ?? ''] ?? 'book';
}

function WeekStrip() {
  const { colors } = useTheme();
  const calendar = useProgress((s) => s.snapshot?.calendar ?? []);
  const today = dayOf(new Date());
  return (
    <View style={styles.week}>
      {calendar.slice(-7).map((d) => {
        const active = d.xp > 0;
        const label = `${WEEKDAY[parseDay(d.day).getDay()]}: ${active ? 'занимались' : d.frozen ? 'заморозка' : 'без занятий'}`;
        return (
          <View key={d.day} style={styles.day} accessible aria-label={label}>
            <AppText variant="caption" color={d.day === today ? 'text' : 'textMuted'}>
              {WEEKDAY[parseDay(d.day).getDay()]}
            </AppText>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: active
                    ? colors.accent
                    : d.frozen
                      ? colors.infoSoft
                      : colors.surfaceAlt,
                  borderColor: d.day === today ? colors.text : 'transparent',
                },
              ]}
            >
              {active && <Icon name="flame" size={14} color={colors.surface} />}
              {d.frozen && !active && <Icon name="snow" size={14} color={colors.info} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function TodayScreen() {
  const snap = useProgress((s) => s.snapshot);
  const due = useProgress((s) => s.dueCount);
  const completed = snap?.completedLessons;

  const data = useDbQuery(
    async (db) => {
      const done = completed ?? new Set<string>();
      const minutes = await dailyMinutes(db);
      const state = pathState(getCourse(), done);
      const upcoming = state.levels
        .flatMap((l) => l.units.flatMap((u) => u.nodes))
        .filter((n) => n.status !== 'done')
        .slice(0, 4)
        .map((n) => ({ id: n.id, title: n.title, isTest: n.isTest, kind: n.kind }));
      const seen = courseExercises(done);
      const plan = await todayPlan(db, {
        minutes,
        dueCount: due,
        nextLessons: upcoming,
        canPractice: {
          listening: seen.some((e) => e.type === 'listen_dictation' || e.type === 'listen_choice'),
          speaking: seen.some((e) => e.type.startsWith('speak_')),
        },
        weak: await loadWeakSpots(db),
      });
      const kinds = new Map(
        state.levels.flatMap((l) =>
          l.units.flatMap((u) => u.nodes.map((n) => [n.id, n.kind] as const)),
        ),
      );
      return { minutes, plan, today: await loadToday(db, dayOf(new Date())), kinds };
    },
    [completed, due],
  );

  const chooseMinutes = async (m: number) => {
    const db = getDb();
    await setDailyMinutes(db, m);
    await useProgress.getState().refresh(db);
  };

  const goal = snap ? Math.min(1, snap.todayXp / snap.goalXp) : 0;
  const date = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  // Plain values first: the React Compiler hoists `data.x` reads out of callbacks.
  const plan = data ? data.plan : NO_PLAN;
  const today = data ? data.today : null;
  const kinds = data ? data.kinds : NO_KINDS;
  const minutes = data ? data.minutes : null;
  const doneCount = today ? plan.filter((p) => isDone(p, today)).length : 0;

  return (
    <Screen title="Сегодня" subtitle={date} right={<StreakXp />}>
      {snap && (
        <Card>
          <View style={styles.row}>
            <AppText variant="heading" style={styles.flex}>
              Цель дня
            </AppText>
            <AppText variant="smallStrong" color={goal >= 1 ? 'success' : 'textMuted'}>
              {Math.min(snap.todayXp, snap.goalXp)} / {snap.goalXp} XP
            </AppText>
          </View>
          <ProgressBar value={goal} label="Цель дня" />
          <AppText variant="small" color="textMuted">
            {goal >= 1
              ? 'Цель выполнена — всё остальное сегодня уже бонус.'
              : snap.todayXp > 0
                ? `До цели ${snap.goalXp - snap.todayXp} XP. Серия: ${snap.streak}.`
                : snap.streak > 0
                  ? `Серия ${snap.streak}: один урок сегодня — и она продолжится. Заморозок в запасе: ${snap.freezes}.`
                  : 'Один урок — и серия начнётся.'}
          </AppText>
          <WeekStrip />
          <WeekGoal />
        </Card>
      )}

      <QuestsCard />

      <SectionTitle>Сколько времени сегодня</SectionTitle>
      <View style={styles.chips} role="radiogroup">
        {MINUTES.map((m) => (
          <Chip
            key={m}
            label={`${m} мин`}
            selected={minutes === m}
            onPress={() => void chooseMinutes(m)}
          />
        ))}
      </View>

      <SectionTitle>
        {today ? `План дня · ${doneCount} из ${plan.length}` : 'План дня'}
      </SectionTitle>
      {plan.map((item) => {
        const done = !!today && isDone(item, today);
        return (
          <ListRow
            key={`${item.kind}:${item.ref}`}
            icon={iconOf(item, (id) => kinds.get(id))}
            title={item.title}
            subtitle={`${item.subtitle} · ${item.minutes} мин`}
            done={done}
            onPress={() => router.push(hrefOf(item))}
          />
        );
      })}
      {today && plan.length === 0 && (
        <AppText variant="body" color="textMuted">
          На сегодня всё пройдено. Загляните в практику или словарь.
        </AppText>
      )}
      {due > 0 && today && !plan.some((p) => p.kind === 'review') && (
        <ListRow
          icon="refresh"
          title="Повторение"
          subtitle={`Карточек к повторению: ${due}`}
          onPress={() => router.push('/review')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  day: { alignItems: 'center', gap: 4 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
