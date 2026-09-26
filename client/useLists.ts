import { useCallback, useMemo, useState } from 'react';
import type { ListValue, Lists } from '../shared/types';
import { api } from './api';
import { useAsync } from './useAsync';

const EMPTY: Lists = {
  mainProject: [], projectType: [], goal: [], department: [], phase: [], role: [], attachmentType: [], company: [],
  personDocumentType: [], accountType: [], keyDateType: [],
};

/** Loads the dropdown lists. `remember` adds a value that was just created inline, so it shows without a reload. */
export function useLists() {
  const loaded = useAsync(() => api.getLists(), []);
  const [added, setAdded] = useState<ListValue[]>([]);

  const lists = useMemo(() => {
    const merged: Lists = { ...(loaded.data ?? EMPTY) };
    for (const value of added) {
      if (!merged[value.list].some((v) => v.id === value.id)) merged[value.list] = [...merged[value.list], value];
    }
    return merged;
  }, [loaded.data, added]);

  const remember = useCallback((value: ListValue) => setAdded((list) => [...list, value]), []);

  return { lists, error: loaded.error, remember };
}
