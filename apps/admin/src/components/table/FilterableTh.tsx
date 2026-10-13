import clsx from "clsx";
import { ArrowDown, ArrowUp, Check, Filter, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EMPTY_TOKEN,
  type CellValue,
  type FilterOption,
} from "../../lib/column-filters";
import type { SortDir, SortState } from "../../lib/table";
import { Spinner } from "../ui/Spinner";

interface FilterableThProps<K extends string> {
  columnKey: K;
  label: string;
  sort: SortState<K>;
  /** header click: cycles asc → desc → none */
  onSort: (key: K) => void;
  /** explicit direction from the popover; null clears the sort */
  onSetSort: (key: K, dir: SortDir | null) => void;
  selected: Set<string> | undefined;
  onFilter: (selected: Set<string> | undefined) => void;
  /** Facet values are fetched (paged/limited) when the popover opens */
  loadOptions: (key: string) => Promise<FilterOption[]>;
  format?: (value: CellValue) => string;
  className?: string;
}

/**
 * Excel-style column header: click the label to sort, the funnel to open a
 * popover with sort buttons, a value search and check-box value filters.
 */
export function FilterableTh<K extends string>({
  columnKey,
  label,
  sort,
  onSort,
  onSetSort,
  selected,
  onFilter,
  loadOptions,
  format,
  className,
}: FilterableThProps<K>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cellRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    loadOptions(columnKey)
      .then((opts) => {
        if (!cancelled) setOptions(opts);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loadOptions, columnKey]);

  const labelOf = (o: FilterOption) =>
    o.key === EMPTY_TOKEN ? t("table.empty") : format ? format(o.value) : String(o.value);
  const visible = query
    ? options.filter((o) => labelOf(o).toLowerCase().includes(query.toLowerCase()))
    : options;
  const allKeys = options.map((o) => o.key);
  const isAllSelected = selected === undefined || allKeys.every((k) => selected.has(k));
  const filterActive = selected !== undefined;
  const sortActive = sort.key === columnKey;

  const toggleValue = (key: string) => {
    const next = new Set(selected ?? allKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const everything = allKeys.every((k) => next.has(k));
    onFilter(everything ? undefined : next);
  };

  const toggleAll = () => onFilter(isAllSelected ? new Set<string>() : undefined);

  // Clicking the already-active direction cancels the sort
  const sortTo = (dir: SortDir) => {
    onSetSort(columnKey, sortActive && sort.dir === dir ? null : dir);
    setOpen(false);
  };

  const SortIcon = sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      ref={cellRef}
      className={clsx("relative px-4 py-3 text-start font-medium whitespace-nowrap", className)}
    >
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSort(columnKey)}
          aria-sort={sortActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
          className={clsx("inline-flex items-center gap-1 hover:text-gray-900", sortActive ? "text-gray-900" : "text-gray-500")}
        >
          {label}
          {sortActive && <SortIcon className="size-3.5 text-brand" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={t("table.filterColumn")}
          aria-expanded={open}
          className={clsx(
            "rounded p-0.5 transition-colors",
            filterActive ? "text-brand" : "text-gray-300 hover:text-gray-600",
          )}
        >
          <Filter className="size-3.5" fill={filterActive ? "currentColor" : "none"} />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          className="absolute top-full start-0 z-30 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-2 text-sm font-normal shadow-lg"
        >
          <div className="flex gap-1 border-b border-gray-100 pb-2">
            <button
              type="button"
              onClick={() => sortTo("asc")}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs hover:bg-gray-100",
                sortActive && sort.dir === "asc" ? "bg-red-50 text-brand" : "text-gray-600",
              )}
            >
              <ArrowUp className="size-3.5" /> {t("table.sortAsc")}
            </button>
            <button
              type="button"
              onClick={() => sortTo("desc")}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs hover:bg-gray-100",
                sortActive && sort.dir === "desc" ? "bg-red-50 text-brand" : "text-gray-600",
              )}
            >
              <ArrowDown className="size-3.5" /> {t("table.sortDesc")}
            </button>
          </div>
          {sortActive && (
            <button
              type="button"
              onClick={() => {
                onSetSort(columnKey, null);
                setOpen(false);
              }}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="size-3.5" /> {t("table.clearSort")}
            </button>
          )}

          <div className="relative my-2">
            <Search className="absolute top-2 start-2.5 size-3.5 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("table.searchValues")}
              className="w-full rounded-lg border border-gray-300 ps-8 pe-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-500">
              <Spinner size="sm" /> {t("table.loadingOptions")}
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleAll}
                  className="size-3.5 accent-[var(--tenant-primary)]"
                />
                {t("table.selectAll")}
              </label>
              <ul className="max-h-56 overflow-y-auto">
                {visible.map((o) => {
                  const checked = selected === undefined || selected.has(o.key);
                  return (
                    <li key={o.key}>
                      <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleValue(o.key)}
                          className="size-3.5 accent-[var(--tenant-primary)]"
                        />
                        <span className="flex-1 truncate">{labelOf(o)}</span>
                        <span className="text-gray-400 tabular-nums">{o.count}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {filterActive && (
            <button
              type="button"
              onClick={() => {
                onFilter(undefined);
                setOpen(false);
              }}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-brand hover:bg-red-50"
            >
              <Check className="size-3.5" /> {t("table.clear")}
            </button>
          )}
        </div>
      )}
    </th>
  );
}
