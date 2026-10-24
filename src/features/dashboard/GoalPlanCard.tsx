import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getDb } from '@/core/storage';
import { GOALS, useOnboarding, type Goal } from '../onboarding/store';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';

const ADVICE: Record<Goal, { text: string; label: string; href: Href }> = {
  study: {
    text: 'Начните с общения в колледже и разговора с преподавателем. Затем проверьте свой уровень и переходите к экзаменационным заданиям курса.',
    label: 'Практика для учёбы',
    href: '/study',
  },
  travel: {
    text: 'Пройдите базовые темы курса, затем тренируйте ситуации в аэропорту, отеле и городе в треке «Путешествия».',
    label: 'Открыть курс и треки',
    href: '/',
  },
  work: {
    text: 'Укрепляйте базовый английский и переходите к деловой переписке, встречам и собеседованиям в треке делового английского.',
    label: 'Открыть курс и треки',
    href: '/',
  },
  people: {
    text: 'Чередуйте уроки с тренировками речи и аудирования. Произнесите ответ вслух, затем сравните его с образцом.',
    label: 'Открыть тренировки',
    href: '/practice',
  },
  media: {
    text: 'Развивайте чтение и аудирование. Сохраняйте незнакомые слова в словарь и возвращайтесь к ним по расписанию повторения.',
    label: 'Открыть тренировки',
    href: '/practice',
  },
  self: {
    text: 'Двигайтесь по курсу в своём темпе. План на сегодня сочетает новые уроки, повторение и практику пройденного.',
    label: 'Мой план на сегодня',
    href: '/today',
  },
};

export function GoalPlanCard() {
  const goal = useOnboarding((s) => s.data?.goal);
  const save = useOnboarding((s) => s.save);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const choose = async (next: Goal) => {
    setSaving(true);
    setFailed(false);
    try {
      await save(getDb(), { goal: next });
      setEditing(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const advice = goal ? ADVICE[goal] : null;
  return (
    <Card tone="infoSoft">
      <AppText variant="caption" color="info">
        ВАША ПРОГРАММА
      </AppText>
      <AppText variant="heading">{goal ? GOALS[goal] : 'Для чего вам английский?'}</AppText>
      {advice && (
        <>
          <AppText variant="small">{advice.text}</AppText>
          <Button
            label={advice.label}
            variant="secondary"
            onPress={() => router.push(advice.href)}
          />
        </>
      )}
      <Button
        label={editing ? 'Скрыть выбор цели' : 'Изменить цель обучения'}
        variant="ghost"
        compact
        onPress={() => setEditing((v) => !v)}
        disabled={saving}
      />
      {(editing || !goal) && (
        <View style={styles.chips} role="radiogroup" aria-label="Цель обучения">
          {(Object.keys(GOALS) as Goal[]).map((key) => (
            <Chip
              key={key}
              label={GOALS[key]}
              selected={goal === key}
              onPress={() => {
                if (!saving) void choose(key);
              }}
            />
          ))}
        </View>
      )}
      {failed && (
        <AppText variant="small" color="error">
          Не удалось сохранить цель. Попробуйте ещё раз.
        </AppText>
      )}
    </Card>
  );
}
const styles = StyleSheet.create({ chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
