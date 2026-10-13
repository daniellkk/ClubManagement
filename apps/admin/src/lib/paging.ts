import type { SortDir } from "./table";

/** Mirrors the API contract (`page`, `pageSize`, sort) so the connect phase is a drop-in. */
export interface PagedQuery {
  page: number; // 1-based
  pageSize: number;
  sortKey?: string;
  sortDir?: SortDir;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const MAX_PAGE_SIZE = 100;
/** Exports walk the data in chunks — never one giant query */
export const EXPORT_CHUNK = 100;

export function paginate<T>(rows: T[], page: number, pageSize: number): PagedResult<T> {
  const size = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * size;
  return { items: rows.slice(start, start + size), total: rows.length, page: safePage, pageSize: size };
}

/** Simulated network latency for the V1 in-browser stores */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
