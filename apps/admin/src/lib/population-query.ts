import {
  applyColumnFilters,
  computeFacets,
  type ColumnDef,
  type FilterMap,
  type FilterOption,
} from "./column-filters";
import type { PopulationFan } from "./mock-data";
import { delay, paginate, type PagedQuery, type PagedResult } from "./paging";
import { sortRows } from "./table";

export interface PopulationQuery extends PagedQuery {
  /** the general-filter result set the table works on */
  rows: PopulationFan[];
  q?: string;
  columns: ColumnDef<PopulationFan>[];
  filters: FilterMap;
}

/** Paged, filtered, sorted slice of the (mock) population — async like the API will be. */
export async function queryPopulation(
  query: PopulationQuery,
): Promise<PagedResult<PopulationFan>> {
  await delay(120);
  const q = query.q?.trim();
  let rows = q ? query.rows.filter((f) => f.name.includes(q)) : query.rows;
  rows = applyColumnFilters(rows, query.columns, query.filters);
  const col = query.columns.find((c) => c.key === query.sortKey);
  if (col && query.sortDir) rows = sortRows(rows, (r) => col.getValue(r), query.sortDir);
  return paginate(rows, query.page, query.pageSize);
}

export async function populationFacets(
  rows: PopulationFan[],
  columns: ColumnDef<PopulationFan>[],
  filters: FilterMap,
  key: string,
): Promise<FilterOption[]> {
  await delay(80);
  return computeFacets(rows, columns, filters, key);
}
