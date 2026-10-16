import { useEffect, useState } from 'react';

export type Loaded<T> =
  { status: 'loading' } | { status: 'done'; value: T } | { status: 'failed'; retry: () => void };

/**
 * Runs an async load when `deps` change and reports its state. A failure can be retried; this
 * is used for content the website downloads on demand.
 */
export function useLoad<T>(load: () => Promise<T>, deps: readonly (string | number)[]): Loaded<T> {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([...deps, attempt]);
  // The result is tagged with the request it answers, so a stale one reads as "loading".
  const [result, setResult] = useState<{ key: string; value?: T; failed?: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    load().then(
      (value) => alive && setResult({ key, value }),
      () => alive && setResult({ key, failed: true }),
    );
    return () => {
      alive = false;
    };
    // `load` is a fresh closure on every render; `key` captures what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (result?.key !== key) return { status: 'loading' };
  if (result.failed) return { status: 'failed', retry: () => setAttempt((n) => n + 1) };
  return { status: 'done', value: result.value as T };
}
