import { request } from "./fans-api";
import type { PagedResult } from "./paging";

// Campaigns live in Postgres and are sent through InforU by the API — every call here is bounded/paged.

export type CampaignChannel = "SMS" | "WHATSAPP" | "EMAIL";
export type CampaignCategory = "TRANSACTIONAL" | "GOODWILL" | "MARKETING";
export type ScheduleType = "MANUAL" | "ONCE" | "CRON";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED" | "PAUSED";
export type Segment = "all" | "subscribers" | "nonSubscribers";
export type FanStatusCode = "ACTIVE" | "INACTIVE" | "ARCHIVED";

/** Behaviour triggers, re-evaluated on every run */
export type Trigger = "birthdayMonth" | "missedGames" | "inactiveDays";
export const TRIGGER_DEFAULTS: Record<Trigger, number> = { birthdayMonth: 0, missedGames: 2, inactiveDays: 30 };

export interface SegmentQuery {
  segment: Segment;
  cities?: string[];
  subTypes?: string[];
  minScore?: number;
  maxScore?: number;
  statuses?: FanStatusCode[];
  appUsersOnly?: boolean;
  trigger?: Trigger;
  /** games for missedGames, days for inactiveDays */
  triggerValue?: number;
}

/** Base audience + how many of it match each trigger (live counts) */
export interface AudienceInsights {
  total: number;
  birthdayMonth: number;
  missedGames: number;
  inactiveDays: number;
  values: { missedGames: number; inactiveDays: number; month: number };
}

export interface RunSummary {
  campaignId: string;
  trigger: "manual" | "schedule";
  dryRun: boolean;
  audience: number;
  sent: number;
  failed: number;
  suppressed: number;
  startedAt: string;
  finishedAt: string;
  skipped?: "running" | "disabled";
}

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  category: CampaignCategory;
  status: CampaignStatus;
  subject: string | null;
  body: string;
  sender: string | null;
  templateId: string | null;
  segmentQuery: SegmentQuery;
  scheduleType: ScheduleType;
  scheduledAt: string | null;
  cronExpression: string | null;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  lastRunSummary: RunSummary | null;
  runCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  reach: number;
  running: boolean;
  /** live count of who would get it right now (list endpoint only) */
  estimatedAudience?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignInput {
  name: string;
  channel: CampaignChannel;
  category: CampaignCategory;
  subject?: string;
  body: string;
  sender?: string;
  templateId?: string;
  segment: SegmentQuery;
  scheduleType: ScheduleType;
  scheduledAt?: string;
  cronExpression?: string;
  timezone?: string;
  enabled?: boolean;
}

export interface CampaignsMeta {
  channels: CampaignChannel[];
  categories: CampaignCategory[];
  segments: Segment[];
  scheduleTypes: ScheduleType[];
  cronPresets: { key: string; expression: string }[];
  timezone: string;
  inforu: { configured: boolean; dryRun: boolean; sender: string; optOutText: string };
}

export interface CampaignMessage {
  id: string;
  status: "QUEUED" | "SENT" | "FAILED" | "SUPPRESSED";
  recipient: string | null;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
  providerBatchId: string | null;
}

export interface CampaignMessagesResult extends PagedResult<CampaignMessage> {
  byStatus: Record<string, number>;
}

export interface CampaignListQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: CampaignStatus;
}

/** Placeholders the API renders per fan */
export const TEMPLATE_VARS = ["firstName", "lastName", "fullName", "customerNumber", "city", "clubName"] as const;

export function hasPlaceholders(body: string): boolean {
  return /{{\s*\w+\s*}}/.test(body);
}

export function renderPreview(body: string, vars: Record<string, string>): string {
  return body.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => vars[key] ?? "");
}

/** Hebrew forces UCS-2: 70 chars per SMS, 67 per part when concatenated (GSM-7: 160 / 153). */
export function smsSegments(text: string): number {
  const len = [...text].length;
  if (len === 0) return 0;
  const ucs2 = /[^\x00-\x7f]/.test(text);
  const single = ucs2 ? 70 : 160;
  const multi = ucs2 ? 67 : 153;
  return len <= single ? 1 : Math.ceil(len / multi);
}

export function fetchCampaignsMeta(): Promise<CampaignsMeta> {
  return request("/api/campaigns/meta");
}

export function queryCampaigns(query: CampaignListQuery): Promise<PagedResult<Campaign>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.status) params.set("status", query.status);
  return request(`/api/campaigns?${params.toString()}`);
}

export function fetchCampaign(id: string): Promise<Campaign> {
  return request(`/api/campaigns/${encodeURIComponent(id)}`);
}

export function createCampaign(input: CampaignInput): Promise<Campaign> {
  return request("/api/campaigns", { method: "POST", body: JSON.stringify(input) });
}

export function updateCampaign(id: string, input: CampaignInput): Promise<Campaign> {
  return request(`/api/campaigns/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteCampaign(id: string): Promise<{ ok: boolean }> {
  return request(`/api/campaigns/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function runCampaign(id: string): Promise<{ started: boolean; dryRun: boolean }> {
  return request(`/api/campaigns/${encodeURIComponent(id)}/run`, { method: "POST" });
}

export function setCampaignEnabled(id: string, enabled: boolean): Promise<Campaign> {
  return request(`/api/campaigns/${encodeURIComponent(id)}/enabled`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export function testSendCampaign(
  id: string,
  to: { phone?: string; email?: string },
): Promise<{ ok: boolean; dryRun: boolean; status: string; description: string }> {
  return request(`/api/campaigns/${encodeURIComponent(id)}/test`, { method: "POST", body: JSON.stringify(to) });
}

export function estimateAudience(input: {
  channel: CampaignChannel;
  category: CampaignCategory;
  segment: SegmentQuery;
}): Promise<{ count: number }> {
  return request("/api/campaigns/estimate", { method: "POST", body: JSON.stringify(input) });
}

export function audienceInsights(input: {
  channel: CampaignChannel;
  category: CampaignCategory;
  segment: SegmentQuery;
}): Promise<AudienceInsights> {
  return request("/api/campaigns/insights", { method: "POST", body: JSON.stringify(input) });
}

export function campaignMessages(id: string, page: number, pageSize: number): Promise<CampaignMessagesResult> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return request(`/api/campaigns/${encodeURIComponent(id)}/messages?${params.toString()}`);
}
