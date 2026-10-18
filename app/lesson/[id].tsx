import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import type { Exercise } from '@/core/content/schema';
import { getDb } from '@/core/storage';
import { isExamId, loadExamSession } from '@/features/exams/exam';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { loadLessonSession } from '@/features/lesson/session';
import { useProgress } from '@/features/progress/store';
import { loadMasteredSkip } from '@/features/review/sources';
import { useLoad } from '@/lib/useLoad';
import { LoadFailed } from '@/ui/components/LoadFailed';

const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function LessonRoute() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  // `?start=N` opens a lesson at exercise N; a development aid for reviewing content.
  const startAt = __DEV__ && start ? Math.max(0, Number(start) || 0) : 0;
  // A module test or level exam is assembled from the course's exercises; each attempt differs.
  const [seed] = useState(() => String(Date.now()));
  // The website downloads the units first.
  const loaded = useLoad(
    () => (isExamId(id) ? loadExamSession(id, seed) : loadLessonSession(id)),
    [id, seed],
  );
  const session = loaded.status === 'done' ? loaded.value : undefined;
  const repeat = useProgress(
    (s) => (!isExamId(id) && s.snapshot?.completedLessons.has(id)) ?? false,
  );
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

  if (loaded.status === 'failed') return <LoadFailed onRetry={loaded.retry} onExit={exit} />;
  if (skip === undefined || session === undefined) return null;

  return (
    <LessonScreen
      // New-word cards are for the first pass; a repeat goes straight to the exercises.
      session={repeat && session ? { ...session, introWords: undefined } : session}
      skip={skip ?? undefined}
      startAt={startAt}
      // A lesson opened in the middle (`?start=`) is a preview: it would count as completed.
      onComplete={
        startAt > 0 || !session
          ? undefined
          : (summary) =>
              useProgress.getState().record(
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
      onOpenCertificate={(level) => router.replace(`/certificate/${level.toLowerCase()}`)}
      onExit={exit}
    />
  );
}
