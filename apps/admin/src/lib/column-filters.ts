import { useCallback, useMemo, useState } from "react";

export type CellValue = string | number | boolean | null | undefined;

export interface ColumnDef<Row> {
  key: string;
  getValue: (row: Row) => CellValue;
  /** Display formatting for option labels (e.g. dates) */
  format?: (value: CellValue) => string;
}

export interface FilterOption {
  key: string;
  value: CellValue;
  count: number;
}

/** Selected value-keys per column; `undefined` = no filter on that column */
export type FilterMap = Record<string, Set<string> | undefined>;

export const EMPTY_TOKEN = "__EMPTY__";
/** Facet lists are capped like a server-side aggregate would be */
export const MAX_FACET_OPTIONS = 50;

export function valueKey(value: CellValue): string {
  return value === null || value === undefined || value === ""
    ? EMPTY_TOKEN
    : String(value);
}

/** Column filter state only — the data work happens in a paged query. */
export function useFilterState() {
  const [filters, setFilters] = useState<FilterMap>({});
  const setFilter = useCallback((key: string, selected: Set<string> | undefined) => {
    setFilters((f) => ({ ...f, [key]: selected }));
  }, []);
  const clearAll = useCallback(() => setFilters({}), []);
  const activeCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );
  return { filters, setFilter, clearAll, activeCount };
}

// ── Pure helpers used by the (V1 in-browser) query layer ─────────────────────

function rowPasses<Row>(
  row: Row,
  colByKey: Record<string, ColumnDef<Row>>,
  filters: FilterMap,
  except?: string,
): boolean {
  for (const [key, selected] of Object.entries(filters)) {
    if (!selected || key === except) continue;
    const col = colByKey[key];
    if (!col) continue;
    if (!selected.has(valueKey(col.getValue(row)))) return false;
  }
  return true;
}

export function applyColumnFilters<Row>(
  rows: Row[],
  columns: ColumnDef<Row>[],
  filters: FilterMap,
): Row[] {
  const colByKey = Object.fromEntries(columns.map((c) => [c.key, c]));
  return rows.filter((r) => rowPasses(r, colByKey, filters));
}

/**
 * Distinct values of one column with every OTHER column's filter applied
 * (Excel behaviour), capped to MAX_FACET_OPTIONS by frequency.
 */
export function computeFacets<Row>(
  rows: Row[],
  columns: ColumnDef<Row>[],
  filters: FilterMap,
  key: string,
  limit = MAX_FACET_OPTIONS,
): FilterOption[] {
  const colByKey = Object.fromEntries(columns.map((c) => [c.key, c]));
  const col = colByKey[key];
  if (!col) return [];
  const counts = new Map<string, FilterOption>();
  for (const row of rows) {
    if (!rowPasses(row, colByKey, filters, key)) continue;
    const value = col.getValue(row);
    const k = valueKey(value);
    const entry = counts.get(k);
    if (entry) entry.count += 1;
    else counts.set(k, { key: k, value, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .sort((a, b) => {
      if (a.key === EMPTY_TOKEN) return 1;
      if (b.key === EMPTY_TOKEN) return -1;
      if (typeof a.value === "number" && typeof b.value === "number") return a.value - b.value;
      return String(a.value).localeCompare(String(b.value), ["he", "en"], { numeric: true });
    });
}
