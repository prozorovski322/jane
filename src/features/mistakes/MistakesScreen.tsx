import { router } from 'expo-router';

import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { SubScreen } from '@/ui/components/SubScreen';

import { correctAnswerOf, loadMistakes, promptOf, type Mistake } from './service';

const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const NO_MISTAKES: Mistake[] = [];

/** What the learner still gets wrong, newest first, with a button to practise exactly that. */
export function MistakesScreen() {
  const data = useDbQuery((db) => loadMistakes(db), []);
  const mistakes = data ?? NO_MISTAKES;

  return (
    <SubScreen
      title="Ошибки"
      fallback="/practice"
      footer={
        mistakes.length > 0 ? (
          <Button
            label={`Потренировать (${Math.min(mistakes.length, 12)})`}
            icon="target"
            onPress={() =>
              router.push({ pathname: '/practice/[kind]', params: { kind: 'mistakes' } })
            }
          />
        ) : undefined
      }
    >
      <AppText variant="small" color="textMuted">
        Задания, в которых последний ответ был неверным (за 30 дней). Ответите верно — задание уйдёт
        из списка.
      </AppText>
      {data && mistakes.length === 0 && (
        <AppText variant="body" color="textMuted">
          Сейчас неверных ответов нет. Ошибки появятся здесь после уроков и тренировок.
        </AppText>
      )}
      {mistakes.map(({ exercise, at }) => (
        <Card key={exercise.id}>
          <AppText variant="caption" color="textMuted">
            {fmt.format(new Date(at))}
          </AppText>
          <AppText variant="bodyStrong">{promptOf(exercise)}</AppText>
          <AppText variant="small">Правильно: {correctAnswerOf(exercise)}</AppText>
          <AppText variant="small" color="textMuted">
            {exercise.explanation}
          </AppText>
        </Card>
      ))}
    </SubScreen>
  );
}
