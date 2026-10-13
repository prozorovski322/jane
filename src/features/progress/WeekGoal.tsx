import { dayOf } from '@/core/progress/dates';
import { weekDays, weekStart } from '@/core/progress/week';
import { AppText } from '@/ui/components/AppText';
import { ProgressBar } from '@/ui/components/ProgressBar';

import { useSettings } from '../settings/store';
import { useProgress } from './store';

/** Progress to the weekly goal (days of study this week). */
export function WeekGoal() {
  const calendar = useProgress((s) => s.snapshot?.calendar);
  const goalDays = useSettings((s) => s.weeklyGoalDays);
  if (!calendar) return null;

  const week = new Set(weekDays(weekStart(dayOf(new Date()))));
  const active = calendar.filter((d) => week.has(d.day) && d.xp > 0).length;
  return (
    <>
      <AppText variant="smallStrong">
        Неделя: {Math.min(active, goalDays)} из {goalDays} дней
      </AppText>
      <ProgressBar value={Math.min(1, active / goalDays)} label="Цель недели" />
    </>
  );
}
