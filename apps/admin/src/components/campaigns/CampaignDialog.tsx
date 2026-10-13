import clsx from "clsx";
import { Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  audienceInsights,
  createCampaign,
  estimateAudience,
  hasPlaceholders,
  renderPreview,
  smsSegments,
  TEMPLATE_VARS,
  testSendCampaign,
  updateCampaign,
  type Campaign,
  type CampaignCategory,
  type CampaignChannel,
  type CampaignInput,
  type CampaignsMeta,
  type ScheduleType,
  type Segment,
  type SegmentQuery,
  type Trigger,
  TRIGGER_DEFAULTS,
} from "../../lib/campaigns-api";
import { fanFacets, request } from "../../lib/fans-api";
import { EMPTY_TOKEN } from "../../lib/column-filters";
import { useAsync, useDebounced } from "../../lib/use-async";
import { Button } from "../ui/Button";
import { InfoTip } from "../ui/InfoTip";
import { Spinner } from "../ui/Spinner";

interface CampaignDialogProps {
  open: boolean;
  campaign: Campaign | null;
  meta: CampaignsMeta;
  onClose: () => void;
  onSaved: (campaign: Campaign) => void;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";
const CUSTOM_CRON = "__custom__";

/** datetime-local wants local wall time without zone */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
        {label}
        {hint && <InfoTip text={hint} />}
      </span>
      {children}
    </label>
  );
}

export function CampaignDialog({ open, campaign, meta, onClose, onSaved }: CampaignDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("SMS");
  const [category, setCategory] = useState<CampaignCategory>("MARKETING");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sender, setSender] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [segment, setSegment] = useState<Segment>("subscribers");
  const [cities, setCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [subTypes, setSubTypes] = useState<string[]>([]);
  const [minScore, setMinScore] = useState("");
  const [appUsersOnly, setAppUsersOnly] = useState(false);
  const [trigger, setTrigger] = useState<Trigger | "none">("none");
  const [missedGamesN, setMissedGamesN] = useState(TRIGGER_DEFAULTS.missedGames);
  const [inactiveDaysN, setInactiveDaysN] = useState(TRIGGER_DEFAULTS.inactiveDays);
  const [scheduleType, setScheduleType] = useState<ScheduleType>("MANUAL");
  const [scheduledAt, setScheduledAt] = useState("");
  const [cronPreset, setCronPreset] = useState(meta.cronPresets[0]?.expression ?? "0 10 * * *");
  const [cronCustom, setCronCustom] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Reset the form for a new campaign / load the one being edited
  useEffect(() => {
    if (!open) return;
    setError(null);
    setTestResult(null);
    setTestTo("");
    setCitySearch("");
    const c = campaign;
    setName(c?.name ?? "");
    setChannel(c?.channel ?? "SMS");
    setCategory(c?.category ?? "MARKETING");
    setSubject(c?.subject ?? "");
    setBody(c?.body ?? "");
    setSender(c?.sender ?? "");
    setTemplateId(c?.templateId ?? "");
    setSegment(c?.segmentQuery.segment ?? "subscribers");
    setCities(c?.segmentQuery.cities ?? []);
    setSubTypes(c?.segmentQuery.subTypes ?? []);
    setMinScore(c?.segmentQuery.minScore !== undefined ? String(c.segmentQuery.minScore) : "");
    setAppUsersOnly(c?.segmentQuery.appUsersOnly ?? false);
    const savedTrigger = c?.segmentQuery.trigger ?? "none";
    setTrigger(savedTrigger);
    setMissedGamesN(savedTrigger === "missedGames" ? (c?.segmentQuery.triggerValue ?? TRIGGER_DEFAULTS.missedGames) : TRIGGER_DEFAULTS.missedGames);
    setInactiveDaysN(savedTrigger === "inactiveDays" ? (c?.segmentQuery.triggerValue ?? TRIGGER_DEFAULTS.inactiveDays) : TRIGGER_DEFAULTS.inactiveDays);
    setScheduleType(c?.scheduleType ?? "MANUAL");
    setScheduledAt(toLocalInput(c?.scheduledAt ?? null));
    const expr = c?.cronExpression ?? "";
    const preset = meta.cronPresets.find((p) => p.expression === expr);
    setCronPreset(expr ? (preset ? preset.expression : CUSTOM_CRON) : (meta.cronPresets[0]?.expression ?? CUSTOM_CRON));
    setCronCustom(expr && !preset ? expr : "");
    setEnabled(c?.enabled ?? true);
  }, [open, campaign, meta.cronPresets]);

  const { data: cityOptions, loading: citiesLoading } = useAsync(
    () => (open ? request<(string | null)[]>("/api/fans/meta/cities") : Promise.resolve([])),
    [open],
  );
  const { data: subTypeOptions } = useAsync(
    () => (open ? fanFacets("subType", { filters: {} }) : Promise.resolve([])),
    [open],
  );

  const segmentQuery = useMemo<SegmentQuery>(() => {
    const q: SegmentQuery = { segment };
    if (cities.length) q.cities = cities;
    if (subTypes.length) q.subTypes = subTypes;
    const score = Number.parseInt(minScore, 10);
    if (!Number.isNaN(score)) q.minScore = Math.min(100, Math.max(0, score));
    if (appUsersOnly) q.appUsersOnly = true;
    if (trigger !== "none") {
      q.trigger = trigger;
      if (trigger === "missedGames") q.triggerValue = missedGamesN;
      if (trigger === "inactiveDays") q.triggerValue = inactiveDaysN;
    }
    return q;
  }, [segment, cities, subTypes, minScore, appUsersOnly, trigger, missedGamesN, inactiveDaysN]);
  const segmentKey = useDebounced(JSON.stringify({ segmentQuery, channel, category }), 400);
  const { data: estimate, loading: estimating } = useAsync(
    () => (open ? estimateAudience({ channel, category, segment: segmentQuery }) : Promise.resolve({ count: 0 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, segmentKey],
  );
  // "who is it for and how many" — the base audience and each trigger's share of it
  const { data: insights, loading: insightsLoading } = useAsync(
    () => (open ? audienceInsights({ channel, category, segment: segmentQuery }) : Promise.resolve(null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, segmentKey],
  );

  const cronExpression = cronPreset === CUSTOM_CRON ? cronCustom.trim() : cronPreset;
  const previewBody = useMemo(() => {
    const rendered = renderPreview(body, {
      firstName: "ישראל",
      lastName: "ישראלי",
      fullName: "ישראל ישראלי",
      customerNumber: "12345",
      city: "באר שבע",
      clubName: t("nav.clubName"),
    });
    const needsOptOut = category !== "TRANSACTIONAL" && !/הסר|unsubscribe|\bstop\b/i.test(rendered);
    return needsOptOut ? `${rendered}\n${meta.inforu.optOutText}` : rendered;
  }, [body, category, meta.inforu.optOutText, t]);
  const segments = smsSegments(previewBody);

  const valid =
    name.trim().length >= 2 &&
    body.trim().length > 0 &&
    (channel !== "EMAIL" || subject.trim()) &&
    (channel !== "WHATSAPP" || templateId.trim()) &&
    (scheduleType !== "ONCE" || scheduledAt) &&
    (scheduleType !== "CRON" || cronExpression);

  function buildInput(): CampaignInput {
    return {
      name: name.trim(),
      channel,
      category,
      subject: subject.trim() || undefined,
      body: body.trim(),
      sender: sender.trim() || undefined,
      templateId: templateId.trim() || undefined,
      segment: segmentQuery,
      scheduleType,
      scheduledAt: scheduleType === "ONCE" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      cronExpression: scheduleType === "CRON" ? cronExpression : undefined,
      timezone: meta.timezone,
      enabled,
    };
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const saved = campaign ? await updateCampaign(campaign.id, buildInput()) : await createCampaign(buildInput());
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("campaigns.errSave"));
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!campaign) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSendCampaign(campaign.id, channel === "EMAIL" ? { email: testTo.trim() } : { phone: testTo.trim() });
      setTestResult(
        res.ok
          ? t(res.dryRun ? "campaigns.testDryRun" : "campaigns.testSent")
          : t("campaigns.testFailed", { reason: res.description }),
      );
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : t("campaigns.errSave"));
    } finally {
      setTesting(false);
    }
  }

  function insertVar(key: string) {
    setBody((b) => `${b}{{${key}}}`);
  }

  if (!open) return null;

  const filteredCities = (cityOptions ?? [])
    .filter((c): c is string => Boolean(c))
    .filter((c) => !citySearch.trim() || c.includes(citySearch.trim()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t(campaign ? "campaigns.editTitle" : "campaigns.newTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{t("campaigns.dialogSubtitle")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title={t("common.cancel")}>
            <X className="size-5" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-5">
          {/* ── Message ─────────────────────────────────────────────── */}
          <div className="space-y-4 lg:col-span-3">
            <Field label={t("campaigns.fName")}>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("campaigns.fChannel")}>
                <select value={channel} onChange={(e) => setChannel(e.target.value as CampaignChannel)} className={inputClass}>
                  {meta.channels.map((c) => (
                    <option key={c} value={c}>
                      {t(`campaigns.channel.${c}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("campaigns.fCategory")} hint={t("campaigns.categoryHint")}>
                <select value={category} onChange={(e) => setCategory(e.target.value as CampaignCategory)} className={inputClass}>
                  {meta.categories.map((c) => (
                    <option key={c} value={c}>
                      {t(`campaigns.category.${c}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {channel === "EMAIL" ? (
                <Field label={t("campaigns.fSubject")}>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className={inputClass} />
                </Field>
              ) : (
                <Field label={t("campaigns.fSender")} hint={t("campaigns.senderHint")}>
                  <input
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    placeholder={meta.inforu.sender}
                    maxLength={11}
                    dir="ltr"
                    className={inputClass}
                  />
                </Field>
              )}
              {channel === "WHATSAPP" && (
                <Field label={t("campaigns.fTemplateId")} hint={t("campaigns.templateHint")}>
                  <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} maxLength={40} dir="ltr" className={inputClass} />
                </Field>
              )}
            </div>

            <Field label={t("campaigns.fBody")} hint={t("campaigns.bodyHint")}>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1000} className={inputClass} />
            </Field>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-gray-500">{t("campaigns.placeholders")}</span>
              {TEMPLATE_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(v)}
                  className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-gray-700 hover:bg-gray-100"
                  dir="ltr"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>

            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
              <p className="mb-1 text-xs font-medium text-gray-500">{t("campaigns.preview")}</p>
              <p className="whitespace-pre-line text-gray-800">{previewBody || "—"}</p>
              {channel !== "EMAIL" && (
                <p className="mt-2 text-xs text-gray-500">
                  {t("campaigns.smsLength", { chars: [...previewBody].length, segments })}
                  {hasPlaceholders(body) && ` · ${t("campaigns.personalizedNote")}`}
                </p>
              )}
            </div>
          </div>

          {/* ── Audience + schedule ─────────────────────────────────── */}
          <div className="space-y-5 lg:col-span-2">
            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("campaigns.audience")}</h3>
              <div className="flex rounded-lg bg-gray-100 p-1 text-sm">
                {meta.segments.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSegment(s)}
                    className={clsx(
                      "flex-1 rounded-md px-2 py-1.5 font-medium",
                      segment === s ? "bg-brand text-white shadow-sm" : "text-gray-600 hover:text-gray-900",
                    )}
                  >
                    {t(`campaigns.segment.${s}`)}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-gray-700">{t("campaigns.fCities")}</p>
                <input
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder={t("campaigns.searchCity")}
                  className={clsx(inputClass, "mb-1 py-1.5 text-xs")}
                />
                <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 p-2 text-xs">
                  {citiesLoading ? (
                    <Spinner size="sm" />
                  ) : filteredCities.length === 0 ? (
                    <span className="text-gray-400">{t("table.empty")}</span>
                  ) : (
                    filteredCities.map((c) => (
                      <label key={c} className="flex items-center gap-2 py-0.5">
                        <input
                          type="checkbox"
                          checked={cities.includes(c)}
                          onChange={(e) => setCities((prev) => (e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)))}
                          className="accent-brand"
                        />
                        {c}
                      </label>
                    ))
                  )}
                </div>
                {cities.length > 0 && (
                  <button type="button" onClick={() => setCities([])} className="mt-1 text-xs text-brand hover:underline">
                    {t("campaigns.allCities")}
                  </button>
                )}
              </div>

              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-gray-700">{t("campaigns.fSubTypes")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(subTypeOptions ?? [])
                    .filter((o) => o.key !== EMPTY_TOKEN)
                    .map((o) => {
                      const active = subTypes.includes(o.key);
                      return (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setSubTypes((prev) => (active ? prev.filter((x) => x !== o.key) : [...prev, o.key]))}
                          className={clsx(
                            "rounded-full border px-2.5 py-0.5 text-xs",
                            active ? "border-brand bg-red-50 text-brand" : "border-gray-200 text-gray-600 hover:bg-gray-50",
                          )}
                        >
                          {o.key}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label={t("campaigns.fMinScore")}>
                  <input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(e.target.value)} className={inputClass} />
                </Field>
                <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
                  <input type="checkbox" checked={appUsersOnly} onChange={(e) => setAppUsersOnly(e.target.checked)} className="accent-brand" />
                  {t("campaigns.fAppUsers")}
                </label>
              </div>

              <div className="mt-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-700">
                  {t("campaigns.triggerTitle")}
                  <InfoTip text={t("campaigns.insightsHint")} />
                </p>
                <div className="space-y-1.5 text-sm">
                  {(["none", "birthdayMonth", "missedGames", "inactiveDays"] as const).map((k) => {
                    const count = k === "none" ? insights?.total : insights?.[k];
                    return (
                      <label key={k} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="trigger"
                          checked={trigger === k}
                          onChange={() => setTrigger(k)}
                          className="accent-brand"
                        />
                        <span className="flex-1">
                          {t(`campaigns.trigger.${k}`, { count: k === "missedGames" ? missedGamesN : inactiveDaysN })}
                        </span>
                        {k === "missedGames" && trigger === k && (
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={missedGamesN}
                            onChange={(e) => setMissedGamesN(Math.max(1, Number(e.target.value) || 1))}
                            className={clsx(inputClass, "w-16 py-1 text-xs")}
                          />
                        )}
                        {k === "inactiveDays" && trigger === k && (
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={inactiveDaysN}
                            onChange={(e) => setInactiveDaysN(Math.max(1, Number(e.target.value) || 1))}
                            className={clsx(inputClass, "w-16 py-1 text-xs")}
                          />
                        )}
                        <span className="min-w-10 text-end text-xs tabular-nums text-gray-500" data-trigger-count={k}>
                          {insightsLoading && !insights ? "…" : (count ?? 0).toLocaleString()}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5 text-gray-600">
                  {t("campaigns.estimate")}
                  <InfoTip text={t("campaigns.estimateHint")} />
                </span>
                <span className="text-lg font-bold tabular-nums text-gray-900">
                  {estimating ? <Spinner size="sm" /> : (estimate?.count ?? 0).toLocaleString()}
                </span>
              </div>
              {!estimating && estimate?.count === 0 && category !== "TRANSACTIONAL" && (
                <p className="mt-2 text-xs text-amber-700">{t("campaigns.noConsentHint")}</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("campaigns.schedule")}</h3>
              <div className="space-y-2 text-sm">
                {meta.scheduleTypes.map((s) => (
                  <label key={s} className="flex items-center gap-2">
                    <input type="radio" name="scheduleType" checked={scheduleType === s} onChange={() => setScheduleType(s)} className="accent-brand" />
                    {t(`campaigns.scheduleType.${s}`)}
                  </label>
                ))}
              </div>
              {scheduleType === "ONCE" && (
                <div className="mt-3">
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputClass} dir="ltr" />
                </div>
              )}
              {scheduleType === "CRON" && (
                <div className="mt-3 space-y-2">
                  <select value={cronPreset} onChange={(e) => setCronPreset(e.target.value)} className={inputClass}>
                    {meta.cronPresets.map((p) => (
                      <option key={p.key} value={p.expression}>
                        {t(`campaigns.cron.${p.key}`)}
                      </option>
                    ))}
                    <option value={CUSTOM_CRON}>{t("campaigns.cron.custom")}</option>
                  </select>
                  {cronPreset === CUSTOM_CRON && (
                    <input
                      value={cronCustom}
                      onChange={(e) => setCronCustom(e.target.value)}
                      placeholder="0 10 * * 0"
                      dir="ltr"
                      className={clsx(inputClass, "font-mono")}
                    />
                  )}
                  <p className="text-xs text-gray-500">
                    {t("campaigns.cronHint", { expression: cronExpression || "—", timezone: meta.timezone })}
                  </p>
                </div>
              )}
              {scheduleType !== "MANUAL" && (
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brand" />
                  {t("campaigns.fEnabled")}
                </label>
              )}
            </div>

            {campaign && (
              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("campaigns.testTitle")}</h3>
                <p className="mb-2 text-xs text-gray-500">
                  {t(meta.inforu.dryRun ? "campaigns.testHintDry" : "campaigns.testHintLive")}
                </p>
                <div className="flex gap-2">
                  <input
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder={channel === "EMAIL" ? "name@example.com" : "05x-xxxxxxx"}
                    dir="ltr"
                    className={inputClass}
                  />
                  <Button variant="ghost" icon={<Send className="size-4" />} loading={testing} disabled={!testTo.trim()} onClick={() => void sendTest()}>
                    {t("campaigns.testBtn")}
                  </Button>
                </div>
                {testResult && <p className="mt-2 text-xs text-gray-700">{testResult}</p>}
              </div>
            )}
          </div>
        </div>

        {error && <div className="mx-6 mb-3 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={() => void save()}>
            {t(campaign ? "common.save" : "campaigns.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
