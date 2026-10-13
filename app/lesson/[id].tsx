import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import type { Exercise } from '@/core/content/schema';
import { getDb } from '@/core/storage';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { sessionForLesson } from '@/features/lesson/session';
import { useProgress } from '@/features/progress/store';
import { loadMasteredSkip } from '@/features/review/sources';

export default function LessonRoute() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  // `?start=N` opens a lesson at exercise N; a development aid for reviewing content.
  const startAt = __DEV__ && start ? Math.max(0, Number(start) || 0) : 0;
  const session = useMemo(() => sessionForLesson(id), [id]);
  const repeat = useProgress((s) => s.snapshot?.completedLessons.has(id) ?? false);
  // A repeated lesson leaves out what the learner already knows well; a first pass shows all.
  const [skip, setSkip] = useState<((ex: Exercise) => boolean) | null | undefined>(
    repeat ? undefined : null,
  );

  useEffect(() => {
    if (!repeat) return;
    let alive = true;
    void loadMasteredSkip(getDb()).then((fn) => alive && setSkip(() => fn));
    return () => {
      alive = false;
    };
  }, [repeat]);

  if (skip === undefined) return null;

  return (
    <LessonScreen
      session={session}
      skip={skip ?? undefined}
      startAt={startAt}
      // A lesson opened in the middle (`?start=`) is a preview: it would count as completed.
      onComplete={
        startAt > 0 || !session
          ? undefined
          : (summary) =>
              useProgress
                .getState()
                .record(
                  getDb(),
                  {
                    id: session.id,
                    unitId: session.unitId,
                    kind: session.kind,
                    passScore: session.passScore,
                  },
                  summary,
                )
      }
      onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
