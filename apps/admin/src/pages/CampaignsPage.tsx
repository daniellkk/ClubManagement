import clsx from "clsx";
import {
  AlertTriangle,
  Mail,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CampaignDialog } from "../components/campaigns/CampaignDialog";
import { Badge, type BadgeVariant } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { PageHeader } from "../components/ui/PageHeader";
import { Pagination } from "../components/ui/Pagination";
import {
  deleteCampaign,
  fetchCampaignsMeta,
  queryCampaigns,
  runCampaign,
  setCampaignEnabled,
  TRIGGER_DEFAULTS,
  type Campaign,
  type CampaignStatus,
} from "../lib/campaigns-api";
import { formatDateTime, formatNumber } from "../lib/format";
import { useAsync, useDebounced } from "../lib/use-async";

const STATUS_VARIANT: Record<CampaignStatus, BadgeVariant> = {
  DRAFT: "neutral",
  SCHEDULED: "league",
  SENDING: "warning",
  SENT: "success",
  CANCELLED: "danger",
  PAUSED: "warning",
};

const CHANNEL_ICON = {
  SMS: Smartphone,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
} as const;

export function CampaignsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 300);
  const [status, setStatus] = useState<CampaignStatus | "">("");
  const [dialog, setDialog] = useState<{ open: boolean; campaign: Campaign | null }>({ open: false, campaign: null });
  const [toDelete, setToDelete] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toRun, setToRun] = useState<Campaign | null>(null);
  const [starting, setStarting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const meta = useAsync(fetchCampaignsMeta, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, status, pageSize]);

  const list = useAsync(
    () => queryCampaigns({ page, pageSize, q: debouncedQuery, status: status || undefined }),
    [page, pageSize, debouncedQuery, status],
  );
  const reloadRef = useRef(list.reload);
  reloadRef.current = list.reload;

  // While a campaign is sending, poll so the counts move without a manual refresh
  const sending = list.data?.items.some((c) => c.status === "SENDING" || c.running) ?? false;
  useEffect(() => {
    if (!sending) return;
    const handle = setInterval(() => reloadRef.current(), 2500);
    return () => clearInterval(handle);
  }, [sending]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteCampaign(toDelete.id);
      setToDelete(null);
      reloadRef.current();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("campaigns.errSave"));
    } finally {
      setDeleting(false);
    }
  }

  async function confirmRun() {
    if (!toRun) return;
    setStarting(true);
    try {
      const res = await runCampaign(toRun.id);
      setNotice(t(res.dryRun ? "campaigns.runStartedDry" : "campaigns.runStarted", { name: toRun.name }));
      setToRun(null);
      reloadRef.current();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("campaigns.errSave"));
    } finally {
      setStarting(false);
    }
  }

  async function toggleEnabled(c: Campaign) {
    setBusyId(c.id);
    try {
      await setCampaignEnabled(c.id, !c.enabled);
      reloadRef.current();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("campaigns.errSave"));
    } finally {
      setBusyId(null);
    }
  }

  function scheduleLabel(c: Campaign): string {
    if (c.scheduleType === "ONCE") {
      return t("campaigns.scheduleOnceAt", { date: c.scheduledAt ? formatDateTime(c.scheduledAt) : "—" });
    }
    if (c.scheduleType === "CRON") {
      const preset = meta.data?.cronPresets.find((p) => p.expression === c.cronExpression);
      return preset ? t(`campaigns.cron.${preset.key}`) : (c.cronExpression ?? "—");
    }
    return t("campaigns.scheduleType.MANUAL");
  }

  const dryRun = meta.data?.inforu.dryRun ?? true;
  const items = list.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title={t("campaigns.title")}
        subtitle={t("campaigns.subtitle")}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setDialog({ open: true, campaign: null })} disabled={!meta.data}>
            {t("campaigns.new")}
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        {meta.data && (
          <div
            className={clsx(
              "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
              dryRun ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-800",
            )}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">{t(dryRun ? "campaigns.modeDry" : "campaigns.modeLive")}</p>
              <p className="text-xs opacity-80">
                {t(dryRun ? "campaigns.modeDryHint" : "campaigns.modeLiveHint", { sender: meta.data.inforu.sender })}
              </p>
            </div>
          </div>
        )}

        {notice && (
          <div className="flex items-center justify-between rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-xs text-gray-300 hover:text-white">
              {t("common.close")}
            </button>
          </div>
        )}

        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4">
            <div className="relative flex-1 min-w-56">
              <Search className="absolute inset-y-0 start-3 my-auto size-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("campaigns.search")}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 ps-9 pe-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CampaignStatus | "")}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{t("campaigns.allStatuses")}</option>
              {(Object.keys(STATUS_VARIANT) as CampaignStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(`campaigns.status.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <LoadingOverlay loading={list.loading || meta.loading}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                    <th className="px-4 py-3 text-start">{t("campaigns.colName")}</th>
                    <th className="px-4 py-3 text-start">{t("campaigns.colAudience")}</th>
                    <th className="px-4 py-3 text-start">{t("campaigns.colSchedule")}</th>
                    <th className="px-4 py-3 text-start">{t("campaigns.colNextRun")}</th>
                    <th className="px-4 py-3 text-start">{t("campaigns.colStatus")}</th>
                    <th className="px-4 py-3 text-start">{t("campaigns.colResults")}</th>
                    <th className="px-4 py-3 text-start">{t("campaigns.colLastRun")}</th>
                    <th className="px-4 py-3 text-end">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!list.loading && items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                        {list.error ?? t("campaigns.empty")}
                      </td>
                    </tr>
                  )}
                  {items.map((c) => {
                    const Icon = CHANNEL_ICON[c.channel];
                    const summary = c.lastRunSummary;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{c.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                            <Icon className="size-3.5" />
                            {t(`campaigns.channel.${c.channel}`)} · {t(`campaigns.category.${c.category}`)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900">{t(`campaigns.segment.${c.segmentQuery.segment}`)}</div>
                          {c.segmentQuery.trigger && (
                            <div className="text-xs font-medium text-brand">
                              {t(`campaigns.trigger.${c.segmentQuery.trigger}`, {
                                count: c.segmentQuery.triggerValue ?? TRIGGER_DEFAULTS[c.segmentQuery.trigger],
                              })}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            {c.segmentQuery.cities?.length ? t("campaigns.citiesCount", { count: c.segmentQuery.cities.length }) : t("campaigns.allCities")}
                            {c.estimatedAudience != null && (
                              <>
                                {" · "}
                                <span className="font-medium text-gray-700 tabular-nums" data-estimated-audience>
                                  {t("campaigns.estimatedNow", { count: c.estimatedAudience })}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{scheduleLabel(c)}</td>
                        <td className="px-4 py-3 text-gray-700 tabular-nums">{c.nextRunAt ? formatDateTime(c.nextRunAt) : "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[c.status]}>{t(`campaigns.status.${c.status}`)}</Badge>
                          {c.lastError && (
                            <p className="mt-1 max-w-48 truncate text-xs text-red-600" title={c.lastError}>
                              {c.lastError}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">
                          {summary ? (
                            <>
                              <div className="tabular-nums">
                                {t("campaigns.resultLine", {
                                  audience: formatNumber(summary.audience),
                                  sent: formatNumber(summary.sent),
                                  failed: formatNumber(summary.failed),
                                  suppressed: formatNumber(summary.suppressed),
                                })}
                              </div>
                              {summary.dryRun && <span className="text-amber-700">{t("campaigns.dryRunTag")}</span>}
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 tabular-nums">{c.lastRunAt ? formatDateTime(c.lastRunAt) : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setToRun(c)}
                              disabled={c.status === "SENDING" || c.running}
                              title={t("campaigns.runNow")}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-brand disabled:opacity-40"
                            >
                              <Play className="size-4" />
                            </button>
                            {c.scheduleType !== "MANUAL" && (
                              <button
                                onClick={() => void toggleEnabled(c)}
                                disabled={busyId === c.id}
                                title={t(c.enabled ? "campaigns.pause" : "campaigns.resume")}
                                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
                              >
                                {c.enabled ? <Pause className="size-4" /> : <Play className="size-4 text-green-600" />}
                              </button>
                            )}
                            <button
                              onClick={() => setDialog({ open: true, campaign: c })}
                              title={t("common.edit")}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => setToDelete(c)}
                              title={t("common.delete")}
                              className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
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
              total={list.data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </div>

      {meta.data && (
        <CampaignDialog
          open={dialog.open}
          campaign={dialog.campaign}
          meta={meta.data}
          onClose={() => setDialog({ open: false, campaign: null })}
          onSaved={() => {
            setDialog({ open: false, campaign: null });
            reloadRef.current();
          }}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={t("campaigns.deleteTitle", { name: toDelete?.name ?? "" })}
        text={t("campaigns.deleteText")}
        confirmLabel={t("common.delete")}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
      <ConfirmDialog
        open={toRun !== null}
        title={t("campaigns.runTitle", { name: toRun?.name ?? "" })}
        text={t(dryRun ? "campaigns.runTextDry" : "campaigns.runTextLive")}
        confirmLabel={t("campaigns.runNow")}
        loading={starting}
        onConfirm={() => void confirmRun()}
        onCancel={() => setToRun(null)}
      />
    </div>
  );
}
