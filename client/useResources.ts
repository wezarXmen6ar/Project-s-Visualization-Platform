import { useCallback, useMemo, useState } from 'react';
import type { ResourceRecord } from '../shared/types';
import { api } from './api';
import { useAsync } from './useAsync';

/** Loads everyone in Resources. `remember` adds a person who was just created inline, so they show without a reload. */
export function useResources() {
  const loaded = useAsync(() => api.listResources(), []);
  const [added, setAdded] = useState<ResourceRecord[]>([]);

  const people = useMemo(() => {
    const base = loaded.data ?? [];
    return [...base, ...added.filter((a) => !base.some((b) => b.id === a.id))];
  }, [loaded.data, added]);

  const remember = useCallback((person: ResourceRecord) => setAdded((list) => [...list, person]), []);

  return { people, error: loaded.error, remember };
}
