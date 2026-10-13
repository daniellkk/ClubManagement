import clsx from "clsx";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  checkExisting,
  importFans,
  type ImportResult,
  type ImportRow,
} from "../../lib/fans-api";
import {
  guessField,
  IMPORT_FIELDS,
  parseSpreadsheet,
  type ImportField,
  type ParsedSheet,
} from "../../lib/spreadsheet";
import { useAsync } from "../../lib/use-async";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

type Mapping = Record<string, ImportField | "">;

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** called after a successful import so the list refetches from the API */
  onDone: (result: ImportResult) => void;
}

function buildRows(sheet: ParsedSheet, mapping: Mapping): ImportRow[] {
  const headerFor = (field: ImportField) =>
    Object.entries(mapping).find(([, f]) => f === field)?.[0];
  const get = (row: Record<string, string>, field: ImportField) => {
    const header = headerFor(field);
    const v = header ? (row[header] ?? "").trim() : "";
    return v || undefined;
  };
  const byNumber = new Map<string, ImportRow>();
  for (const row of sheet.rows) {
    const customerNumber = get(row, "customerNumber");
    if (!customerNumber) continue;
    const ageText = get(row, "age");
    const age = ageText ? Number.parseInt(ageText, 10) : Number.NaN;
    byNumber.set(customerNumber, {
      customerNumber,
      firstName: get(row, "firstName") ?? get(row, "oldFirstName"),
      lastName: get(row, "lastName") ?? get(row, "oldLastName"),
      email: get(row, "email"),
      oldEmail: get(row, "oldEmail"),
      legacyId: get(row, "oldId"),
      phone: get(row, "phone"),
      city: get(row, "city"),
      age: Number.isNaN(age) ? undefined : age,
      birthDate: get(row, "birthDate"),
      seatArea: get(row, "seatArea"),
      seatRow: get(row, "seatRow"),
      seatNumber: get(row, "seatNumber"),
    });
  }
  return [...byNumber.values()];
}

export function ImportDialog({ open, onClose, onDone }: ImportDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const rows = useMemo(() => (sheet ? buildRows(sheet, mapping) : []), [sheet, mapping]);
  const hasCustomerNumber = Object.values(mapping).includes("customerNumber");

  const numbers = useMemo(() => rows.map((r) => r.customerNumber), [rows]);
  const { data: existing, loading: checking } = useAsync(
    () => (numbers.length ? checkExisting(numbers) : Promise.resolve(new Set<string>())),
    [numbers],
  );

  const stats = useMemo(() => {
    let withEmail = 0;
    let oldEmailOnly = 0;
    let noEmail = 0;
    let withPhone = 0;
    for (const r of rows) {
      if (r.email) withEmail += 1;
      else if (r.oldEmail) oldEmailOnly += 1;
      else noEmail += 1;
      if (r.phone) withPhone += 1;
    }
    const updated = existing ? rows.filter((r) => existing.has(r.customerNumber)).length : 0;
    return { withEmail, oldEmailOnly, noEmail, withPhone, updated, added: rows.length - updated };
  }, [rows, existing]);

  const reset = () => {
    setFileName(null);
    setFile(null);
    setSheet(null);
    setMapping({});
    setError(null);
    setResult(null);
    setProgress(null);
  };

  const close = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File, sheetName?: string) => {
    setError(null);
    setResult(null);
    setParsing(true);
    try {
      const parsed = await parseSpreadsheet(file, sheetName);
      if (parsed.headers.length === 0) throw new Error("empty");
      const used = new Set<ImportField>();
      const auto: Mapping = {};
      for (const header of parsed.headers) {
        const guess = guessField(header);
        auto[header] = guess && !used.has(guess) ? guess : "";
        if (guess && !used.has(guess)) used.add(guess);
      }
      setFileName(file.name);
      setFile(file);
      setSheet(parsed);
      setMapping(auto);
    } catch {
      setError(t("import.errParse"));
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const runImport = async () => {
    setImporting(true);
    setError(null);
    setProgress({ done: 0, total: rows.length });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await importFans(
        fileName ?? "import",
        rows,
        (done, total) => setProgress({ done, total }),
        controller.signal,
      );
      setResult(res);
      onDone(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("import.errParse"));
    } finally {
      abortRef.current = null;
      setImporting(false);
    }
  };

  const cancelImport = () => abortRef.current?.abort();

  if (!open) return null;

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t("import.title")}</h2>
            <p className="mt-1 text-sm text-gray-500">{t("import.subtitle")}</p>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title={t("common.cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {result ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              {result.cancelled ? (
                <AlertCircle className="size-12 text-amber-500" />
              ) : (
                <CheckCircle2 className="size-12 text-green-600" />
              )}
              <p className="text-base font-medium text-gray-900">
                {t(result.cancelled ? "import.cancelled" : "import.success", {
                  added: result.added,
                  updated: result.updated,
                  done: result.done ?? 0,
                })}
              </p>
            </div>
          ) : importing && progress ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Spinner size="lg" />
              <p className="text-sm text-gray-600">
                {t("import.progress", { done: progress.done, total: progress.total })}
              </p>
              <Button variant="ghost" onClick={cancelImport}>
                {t("import.cancel")}
              </Button>
            </div>
          ) : !sheet ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !parsing && inputRef.current?.click()}
              className={clsx(
                "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
                dragging ? "border-brand bg-red-50/50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
              )}
            >
              {parsing ? (
                <>
                  <Spinner size="lg" />
                  <p className="text-sm text-gray-500">{t("common.loading")}</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="size-10 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">{t("import.dropHint")}</p>
                  <p className="text-xs text-gray-400">.xlsx · .xls · .csv</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <FileSpreadsheet className="size-4 text-gray-400" />
                  <span className="font-medium">{fileName}</span>
                  <span className="text-gray-500">
                    · {t("import.detected", { rows: sheet.rows.length, cols: sheet.headers.length })}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {sheet.sheetNames.length > 1 && (
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      {t("import.sheet")}
                      <select
                        value={sheet.sheetName}
                        disabled={parsing}
                        onChange={(e) => file && void handleFile(file, e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs"
                      >
                        {sheet.sheetNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      {parsing && <Spinner size="sm" />}
                    </label>
                  )}
                  <button onClick={reset} className="text-sm font-medium text-brand hover:underline">
                    {t("common.clearFilter")}
                  </button>
                </span>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("import.mapping")}</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {sheet.headers.map((header) => (
                    <label key={header} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm">
                      <span className="w-2/5 truncate text-gray-600" title={header} dir="auto">
                        {header}
                      </span>
                      <select
                        value={mapping[header] ?? ""}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [header]: e.target.value as ImportField | "" }))
                        }
                        className={inputClass}
                      >
                        <option value="">{t("import.ignore")}</option>
                        {IMPORT_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {t(`import.field${field.charAt(0).toUpperCase()}${field.slice(1)}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {!hasCustomerNumber && (
                  <p className="mt-2 text-sm text-red-600">{t("import.errNoCustomerNumber")}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {(
                  [
                    ["statTotal", rows.length],
                    ["statNew", stats.added],
                    ["statUpdated", stats.updated],
                    ["statWithEmail", stats.withEmail],
                    ["statOldEmailOnly", stats.oldEmailOnly],
                    ["statNoEmail", stats.noEmail],
                    ["statWithPhone", stats.withPhone],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="flex items-center gap-2 text-lg font-bold text-gray-900 tabular-nums">
                      {checking && (key === "statNew" || key === "statUpdated") ? <Spinner size="sm" /> : value}
                    </p>
                    <p className="text-xs text-gray-500">{t(`import.${key}`)}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">{t("import.emailRule")}</p>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("import.preview")}</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        {sheet.headers.map((h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-2 text-start font-medium" dir="auto">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sheet.rows.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          {sheet.headers.map((h) => (
                            <td key={h} className="whitespace-nowrap px-3 py-1.5 text-gray-700" dir="auto">
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          {error && (
            <div className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          {result ? (
            <Button onClick={close}>{t("common.back")}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close} disabled={importing}>
                {t("common.cancel")}
              </Button>
              <Button
                icon={<Upload className="size-4" />}
                loading={importing}
                disabled={!sheet || !hasCustomerNumber || rows.length === 0 || checking}
                onClick={() => void runImport()}
              >
                {t("import.importBtn", { count: rows.length })}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
