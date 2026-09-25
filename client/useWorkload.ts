import { useCallback, useState } from 'react';
import { api } from './api';
import { useAsync } from './useAsync';

/** Loads the workload data (people, leave, assignments, calendar, decisions); `reload` fetches it again after a change. */
export function useWorkload() {
  const [version, setVersion] = useState(0);
  const loaded = useAsync(() => api.getWorkload(), [version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { workload: loaded.data, error: loaded.error, reload };
}
