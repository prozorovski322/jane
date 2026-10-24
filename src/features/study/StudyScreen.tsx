import { router } from 'expo-router';
import { getDb } from '@/core/storage';
import { AppText } from '@/ui/components/AppText';
import { Card, ListRow } from '@/ui/components/Card';
import { SubScreen } from '@/ui/components/SubScreen';
import { LessonScreen } from '../lesson/LessonScreen';
import { useProgress } from '../progress/store';
import { STUDY_SCENARIOS, studySession } from './content';

export function StudyScreen({ id }: { id?: string }) {
  if (id) {
    const session = studySession(id);
    return (
      <LessonScreen
        key={id}
        session={session}
        onExit={() => router.replace('/study')}
        onComplete={
          session
            ? (summary) =>
                useProgress
                  .getState()
                  .record(getDb(), { id: session.id, unitId: null, kind: 'practice' }, summary)
            : undefined
        }
      />
    );
  }
  return (
    <SubScreen title="Учёба за границей">
      <Card tone="infoSoft">
        <AppText variant="title">Почувствуйте себя увереннее в новой среде</AppText>
        <AppText variant="body">
          Три ситуации: слушайте фразы, произносите их, пишите ответы и пробуйте отвечать своими
          словами.
        </AppText>
        <AppText variant="small" color="textMuted">
          Уровень A2–B1 · по 10 заданий. Подсказки и объяснения — на русском. Проверка речи
          использует распознавание или самопроверку.
        </AppText>
      </Card>
      {STUDY_SCENARIOS.map((s, index) => (
        <ListRow
          key={s.id}
          icon={index === 0 ? 'book' : index === 1 ? 'mic' : 'user'}
          title={s.title}
          subtitle={`${s.description} · 10 заданий`}
          onPress={() => router.push({ pathname: '/study', params: { id: s.id } })}
        />
      ))}
    </SubScreen>
  );
}
