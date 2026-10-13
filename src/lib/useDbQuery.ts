import { useEffect, useState } from 'react';

import { getDb } from '@/core/storage';
import type { Db } from '@/core/storage/db';
import { useProgress } from '@/features/progress/store';

/**
 * Runs a database query and re-runs it whenever progress changes (a session was saved, a word
 * was added). Returns undefined until the first result arrives.
 */
export function useDbQuery<T>(
  query: (db: Db) => Promise<T>,
  deps: readonly unknown[],
): T | undefined {
  const version = useProgress((s) => s.version);
  const [data, setData] = useState<T | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    query(getDb()).then(
      (r) => alive && setData(r),
      // Screens show their empty state; the error is visible in development logs.
      (e: unknown) => console.warn('useDbQuery failed', e),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  return data;
}
