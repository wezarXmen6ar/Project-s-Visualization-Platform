import { useCallback, useState } from 'react';
import { api } from './api';
import { useAsync } from './useAsync';

/** Loads who "I am" is; `reload` fetches it again after a change. */
export function useMe() {
  const [version, setVersion] = useState(0);
  const loaded = useAsync(() => api.getMe(), [version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { me: loaded.data, error: loaded.error, reload };
}
