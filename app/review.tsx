import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { getDb } from '@/core/storage';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import type { LessonSession } from '@/features/lesson/session';
import { useProgress } from '@/features/progress/store';
import { loadReviewSession } from '@/features/review/sources';

export default function ReviewRoute() {
  const [session, setSession] = useState<LessonSession | null>(null);

  useEffect(() => {
    let alive = true;
    const completed = useProgress.getState().snapshot?.completedLessons ?? new Set<string>();
    void loadReviewSession(getDb(), completed).then((s) => alive && setSession(s));
    return () => {
      alive = false;
    };
  }, []);

  if (!session) return null;

  return (
    <LessonScreen
      session={session}
      onComplete={(summary) =>
        useProgress
          .getState()
          .record(getDb(), { id: 'review', unitId: null, kind: 'review' }, summary)
      }
      onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
