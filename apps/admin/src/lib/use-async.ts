import { useEffect, useRef, useState, type DependencyList } from "react";

interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
}

/**
 * Runs an async fetch whenever `deps` change. Keeps the previous data while the
 * next request is in flight (so tables don't flash empty) and ignores stale
 * responses that resolve after a newer request started.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => {
        if (latest.current === id) setState({ data, loading: false, error: null });
      },
      (err: unknown) => {
        if (latest.current === id) {
          setState((s) => ({
            data: s.data,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { ...state, reload: () => setVersion((v) => v + 1) };
}

/** Debounces a fast-changing value (search boxes) before it hits a query. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(handle);
  }, [value, ms]);
  return debounced;
}
