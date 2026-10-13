import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { getDb } from '@/core/storage';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import type { LessonSession } from '@/features/lesson/session';
import { PRACTICE_KINDS, practiceId, type PracticeKind } from '@/features/practice/build';
import { loadPracticeSession } from '@/features/practice/load';
import { useProgress } from '@/features/progress/store';

export default function PracticeRoute() {
  const params = useLocalSearchParams<{ kind: string; ref?: string; title?: string }>();
  const kind = (PRACTICE_KINDS as readonly string[]).includes(params.kind)
    ? (params.kind as PracticeKind)
    : null;
  const spec = kind ? { kind, ref: params.ref || undefined } : null;
  const [session, setSession] = useState<LessonSession | null | undefined>(undefined);

  useEffect(() => {
    if (!kind) return;
    let alive = true;
    const completed = useProgress.getState().snapshot?.completedLessons ?? new Set<string>();
    void loadPracticeSession(
      getDb(),
      { kind, ref: params.ref || undefined },
      completed,
      params.title ?? '',
    ).then((s) => alive && setSession(s));
    return () => {
      alive = false;
    };
  }, [kind, params.ref, params.title]);

  const exit = () => (router.canGoBack() ? router.back() : router.replace('/practice'));
  if (!spec) return <LessonScreen session={null} onExit={exit} />;
  if (session === undefined) return null;

  return (
    <LessonScreen
      session={session}
      onComplete={(summary) =>
        useProgress
          .getState()
          .record(getDb(), { id: practiceId(spec), unitId: null, kind: 'practice' }, summary)
      }
      onExit={exit}
    />
  );
}
