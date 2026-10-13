import { useTranslation } from "react-i18next";

interface PaginationProps {
  page: number; // 1-based
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
}

/** Server-style pagination footer: range text, page size, prev/next. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50],
}: PaginationProps) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
      <span className="tabular-nums">{t("pagination.showing", { from, to, total })}</span>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-xs">
            {t("pagination.pageSize")}
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="text-xs tabular-nums">{t("pagination.page", { page, pages })}</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
          >
            {t("common.prev")}
          </button>
          <button
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
          >
            {t("common.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
