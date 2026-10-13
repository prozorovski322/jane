import { useCallback, useEffect, useState } from 'react';

import { getDb } from '@/core/storage';
import { kvGet, kvSet } from '@/core/storage/kv';

/**
 * A value stored in the `kv` table, for settings screens. `fallback` must be a stable value
 * (a module constant). `loaded` is false until the first read finishes.
 */
export function useKvState<T>(key: string, fallback: T) {
  const [state, setState] = useState<{ loaded: boolean; value: T }>({
    loaded: false,
    value: fallback,
  });

  useEffect(() => {
    let alive = true;
    void kvGet<T>(getDb(), key, fallback).then((value) => {
      if (alive) setState({ loaded: true, value });
    });
    return () => {
      alive = false;
    };
  }, [key, fallback]);

  const set = useCallback(
    (value: T) => {
      setState({ loaded: true, value });
      return kvSet(getDb(), key, value);
    },
    [key],
  );
  return [state.value, set, state.loaded] as const;
}
