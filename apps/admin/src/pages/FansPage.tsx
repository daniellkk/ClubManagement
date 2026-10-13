import {
  Download,
  Eye,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ImportDialog } from "../components/fans/ImportDialog";
import { FilterableTh } from "../components/table/FilterableTh";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { PageHeader } from "../components/ui/PageHeader";
import { Pagination } from "../components/ui/Pagination";
import { ScoreBadge } from "../components/ui/ScoreBadge";
import { useFilterState, type CellValue } from "../lib/column-filters";
import {
  deleteFan,
  fanFacets,
  queryFans,
  seatLabel,
  statusLabel,
  subTypeLabel,
  type ApiFan,
  type FanStatusCode,
} from "../lib/fans-api";
import { formatDate } from "../lib/format";
import { EXPORT_CHUNK } from "../lib/paging";
import { exportRows } from "../lib/spreadsheet";
import { useSort } from "../lib/table";
import { useAsync, useDebounced } from "../lib/use-async";

type SortKey =
  | "customerNumber"
  | "name"
  | "age"
  | "city"
  | "subType"
  | "seat"
  | "score"
  | "status"
  | "lastLogin"
  | "lastActivity";

export function FansPage() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reloadKey, setReloadKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ApiFan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const { sort, toggle, setSort } = useSort<SortKey>({ key: "score", dir: "desc" });
  const { filters, setFilter, clearAll, activeCount } = useFilterState();

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exportOpen]);

  // Any change of search/filter/sort starts again from page 1
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filters, sort, pageSize]);

  const { data, loading, error } = useAsync(
    () =>
      queryFans({
        page,
        pageSize,
        q: debouncedQuery,
        sortKey: sort.key ?? undefined,
        sortDir: sort.dir,
        filters,
      }),
    [page, pageSize, debouncedQuery, sort, filters, reloadKey],
  );
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const loadOptions = useCallback(
    (key: string) => fanFacets(key, { q: debouncedQuery, filters }),
    [debouncedQuery, filters],
  );

  // How facet values (server keys) are shown in the popover
  const formats = useMemo<Partial<Record<SortKey, (v: CellValue) => string>>>(
    () => ({
      subType: (v) => subTypeLabel(v ? String(v) : null, t) ?? "",
      status: (v) => (v ? statusLabel(String(v) as FanStatusCode, t) : ""),
      seat: (v) => {
        if (!v) return "";
        const [seatArea, seatRow, seatNumber] = String(v).split("|");
        return seatLabel({ seatArea, seatRow, seatNumber }, t);
      },
      lastLogin: (v) => (v ? formatDate(String(v)) : ""),
      lastActivity: (v) => (v ? formatDate(String(v)) : ""),
    }),
    [t],
  );

  const doExport = async (format: "csv" | "xlsx") => {
    setExportOpen(false);
    setExporting(true);
    try {
      // Walk the filtered set in pages — never a single "everything" query
      const all: ApiFan[] = [];
      let chunk = 1;
      for (;;) {
        const res = await queryFans({
          page: chunk,
          pageSize: EXPORT_CHUNK,
          q: debouncedQuery,
          sortKey: sort.key ?? undefined,
          sortDir: sort.dir,
          filters,
        });
        all.push(...res.items);
        if (all.length >= res.total || res.items.length === 0) break;
        chunk += 1;
      }
      exportRows(
        all.map((f) => ({
          [t("common.customerNumber")]: f.customerNumber,
          [t("fanEdit.firstName")]: f.firstName,
          [t("fanEdit.lastName")]: f.lastName,
          [t("common.email")]: f.email ?? "",
          [t("import.fieldOldEmail")]: f.oldEmail ?? "",
          [t("import.fieldOldId")]: f.legacyId ?? "",
          [t("common.phone")]: f.phone ?? "",
          [t("common.city")]: f.city ?? "",
          [t("common.age")]: f.age ?? "",
          [t("fans.colSubType")]: subTypeLabel(f.currentSubscription?.type, t) ?? "",
          [t("import.fieldSeatArea")]: f.seatArea ?? "",
          [t("import.fieldSeatRow")]: f.seatRow ?? "",
          [t("import.fieldSeatNumber")]: f.seatNumber ?? "",
          [t("common.score")]: f.engagementScore,
          [t("common.status")]: statusLabel(f.status, t),
          [t("fanProfile.lastLogin")]: f.appLastLoginAt ? formatDate(f.appLastLoginAt) : "",
          [t("fans.colLastActivity")]: f.lastActivityAt ? formatDate(f.lastActivityAt) : "",
        })),
        format,
        `fans-${new Date().toISOString().slice(0, 10)}`,
      );
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteFan(pendingDelete.id);
      setPendingDelete(null);
      setReloadKey((k) => k + 1);
    } finally {
      setDeleting(false);
    }
  };

  const thProps = (key: SortKey, label: string) => ({
    columnKey: key,
    label,
    sort,
    onSort: toggle,
    onSetSort: setSort,
    selected: filters[key],
    onFilter: (s: Set<string> | undefined) => setFilter(key, s),
    loadOptions,
    format: formats[key],
  });

  return (
    <div key={i18n.language}>
      <PageHeader
        title={t("fans.title")}
        subtitle={t("fans.subtitle")}
        actions={
          <>
            <Button icon={<Plus className="size-4" />}>{t("fans.addFan")}</Button>
            <Button variant="ghost" icon={<Upload className="size-4" />} onClick={() => setImportOpen(true)}>
              {t("fans.importExcel")}
            </Button>
            <div ref={exportRef} className="relative">
              <Button
                variant="ghost"
                icon={<Download className="size-4" />}
                loading={exporting}
                onClick={() => setExportOpen((o) => !o)}
              >
                {exporting ? t("common.exporting") : t("fans.export")}
              </Button>
              {exportOpen && (
                <div className="absolute end-0 top-full z-30 mt-1 w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                  <button onClick={() => void doExport("xlsx")} className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-gray-50">
                    {t("fans.exportXlsx")}
                  </button>
                  <button onClick={() => void doExport("csv")} className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-gray-50">
                    {t("fans.exportCsv")}
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      <div className="p-8">
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4 rounded-t-xl">
            <div className="relative">
              <Search className="absolute top-2.5 start-3 size-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                className="w-64 rounded-lg border border-gray-300 bg-white ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            {activeCount > 0 && (
              <>
                <span className="text-xs text-gray-500">{t("table.activeFilters", { count: activeCount })}</span>
                <button onClick={clearAll} className="text-sm font-medium text-brand hover:underline">
                  {t("table.clearAll")}
                </button>
              </>
            )}
            {error && <span className="text-sm text-red-600">{t("fans.errLoad")}</span>}
          </div>

          <LoadingOverlay loading={loading}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <FilterableTh {...thProps("customerNumber", t("common.customerNumber"))} />
                    <FilterableTh {...thProps("name", t("common.name"))} />
                    <FilterableTh {...thProps("age", t("common.age"))} />
                    <FilterableTh {...thProps("city", t("common.city"))} />
                    <FilterableTh {...thProps("subType", t("fans.colSubType"))} />
                    <FilterableTh {...thProps("seat", t("fans.colSeat"))} />
                    <FilterableTh {...thProps("score", t("common.score"))} />
                    <FilterableTh {...thProps("status", t("common.status"))} />
                    <FilterableTh {...thProps("lastLogin", t("fanProfile.lastLogin"))} />
                    <FilterableTh {...thProps("lastActivity", t("fans.colLastActivity"))} />
                    <th className="px-4 py-3 text-start font-medium">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                        {t("fans.noResults")}
                      </td>
                    </tr>
                  )}
                  {loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-16" />
                    </tr>
                  )}
                  {rows.map((fan) => {
                    const sub = subTypeLabel(fan.currentSubscription?.type, t);
                    const seat = seatLabel(fan, t);
                    return (
                      <tr key={fan.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-500 tabular-nums">{fan.customerNumber}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {fan.firstName} {fan.lastName}
                          {fan.importedAt && (
                            <span className="ms-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                              {t("fans.importedBadge")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{fan.age ?? <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3">{fan.city ?? <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3">
                          {sub ? <Badge variant="subscriber">{sub}</Badge> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {seat || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBadge score={fan.engagementScore} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={fan.status === "ACTIVE" ? "success" : fan.status === "INACTIVE" ? "danger" : "neutral"}>
                            {statusLabel(fan.status, t)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {fan.appLastLoginAt ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Smartphone className="size-3.5 text-gray-400" />
                              {formatDate(fan.appLastLoginAt)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {fan.lastActivityAt ? formatDate(fan.lastActivityAt) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Link to={`/fans/${fan.id}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title={t("fans.viewProfile")}>
                              <Eye className="size-4" />
                            </Link>
                            <Link to={`/fans/${fan.id}/edit`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title={t("common.edit")}>
                              <Pencil className="size-4" />
                            </Link>
                            <button className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title={t("common.sendMessage")}>
                              <MessageSquare className="size-4" />
                            </button>
                            <button
                              onClick={() => setPendingDelete(fan)}
                              className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-brand"
                              title={t("fans.delete")}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </LoadingOverlay>

          <div className="border-t border-gray-100 px-5 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </div>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => setReloadKey((k) => k + 1)}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("fans.deleteConfirmTitle")}
        text={t("fans.deleteConfirmText")}
        confirmLabel={t("common.delete")}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
