import { useCallback, useState } from "react";

export type SortDir = "asc" | "desc";

/** `key: null` = no sort (natural order) */
export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
}

/**
 * Column sort state. `toggle` cycles asc → desc → none on repeated clicks;
 * `setSort` sets an explicit direction (or null to clear).
 */
export function useSort<K extends string>(initial: SortState<K>) {
  const [sort, setSortState] = useState<SortState<K>>(initial);

  const toggle = useCallback((key: K) => {
    setSortState((s) => {
      if (s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return { key: null, dir: "asc" };
    });
  }, []);

  const setSort = useCallback((key: K, dir: SortDir | null) => {
    setSortState(dir ? { key, dir } : { key: null, dir: "asc" });
  }, []);

  const clearSort = useCallback(() => setSortState({ key: null, dir: "asc" }), []);

  return { sort, toggle, setSort, clearSort };
}

/** Locale-aware comparison; nulls always sort last regardless of direction. */
export function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  let result: number;
  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else if (typeof a === "boolean" && typeof b === "boolean") {
    result = Number(a) - Number(b);
  } else {
    result = String(a).localeCompare(String(b), ["he", "en"], { numeric: true });
  }
  return dir === "asc" ? result : -result;
}

export function sortRows<T>(
  rows: T[],
  getValue: (row: T) => unknown,
  dir: SortDir,
): T[] {
  return [...rows].sort((a, b) => compareValues(getValue(a), getValue(b), dir));
}
