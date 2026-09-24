import { useEffect, useState } from 'react';

interface AsyncState<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

/** Runs `load` whenever `deps` change; ignores results from outdated runs. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    load().then(
      (data) => { if (!cancelled) setState({ data, loading: false }); },
      (error: Error) => { if (!cancelled) setState({ error, loading: false }); },
    );
    return () => { cancelled = true; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
