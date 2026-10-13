import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Campaign, CampaignStatus, Channel, MessageCategory, MessageStatus, Prisma } from "@prisma/client";
import {
  ensureOptOut,
  hasPlaceholders,
  InforuService,
  normalizeIsraeliPhone,
  renderTemplate,
  SMS_BATCH_SIZE,
  type InforuResult,
} from "../messaging/inforu.service";
import { PrismaService } from "../prisma/prisma.service";
import { TRIGGER_DEFAULTS, type AudienceInsights, type RunSummary, type SegmentQuery, type Trigger } from "./campaign.types";

/** Fans are walked in pages — a campaign never loads its whole audience into memory. */
const PAGE = 500;

const CURRENT_ACTIVE_SUBSCRIPTION = { season: { isCurrent: true }, status: "ACTIVE" as const };

type FanRow = {
  id: string;
  firstName: string;
  lastName: string;
  customerNumber: string;
  city: string | null;
  phone: string | null;
  email: string | null;
};

interface Target {
  fan: FanRow;
  address: string;
}

type CampaignWithClub = Campaign & { club: { name: string } };

/**
 * Who a campaign may reach. Consent is enforced here, not in the UI:
 * marketing / goodwill need the channel opt-in and no global unsubscribe;
 * transactional (service) messages only need an address.
 */
export function audienceWhere(
  clubId: string,
  channel: Channel,
  category: MessageCategory,
  segment: SegmentQuery,
): Prisma.FanWhereInput {
  const and: Prisma.FanWhereInput[] = [];
  const needsConsent = category !== "TRANSACTIONAL";
  if (channel === "EMAIL") {
    and.push({ email: { not: null } });
    if (needsConsent) and.push({ emailOptIn: true });
  } else {
    and.push({ phone: { not: null } });
    if (needsConsent) and.push(channel === "WHATSAPP" ? { whatsappOptIn: true } : { smsOptIn: true });
  }
  if (needsConsent) and.push({ unsubscribedAt: null });

  if (segment.segment === "subscribers") and.push({ subscriptions: { some: CURRENT_ACTIVE_SUBSCRIPTION } });
  if (segment.segment === "nonSubscribers") and.push({ subscriptions: { none: CURRENT_ACTIVE_SUBSCRIPTION } });
  if (segment.cities?.length) and.push({ city: { in: segment.cities } });
  if (segment.subTypes?.length) {
    and.push({ subscriptions: { some: { season: { isCurrent: true }, type: { in: segment.subTypes } } } });
  }
  if (segment.minScore !== undefined) and.push({ engagementScore: { gte: segment.minScore } });
  if (segment.maxScore !== undefined) and.push({ engagementScore: { lte: segment.maxScore } });
  if (segment.appUsersOnly) and.push({ appLastLoginAt: { not: null } });

  return {
    clubId,
    deletedAt: null,
    status: { in: segment.statuses?.length ? segment.statuses : ["ACTIVE"] },
    AND: and,
  };
}

/**
 * Behaviour triggers need live data (this month, the last N home games), so
 * they are resolved right before a run or an estimate — never stored.
 */
export async function triggerWhere(
  prisma: Pick<PrismaService, "game">,
  clubId: string,
  segment: SegmentQuery,
  now = new Date(),
): Promise<Prisma.FanWhereInput | null> {
  switch (segment.trigger) {
    case "birthdayMonth":
      return { birthMonth: now.getMonth() + 1 };
    case "inactiveDays": {
      const days = segment.triggerValue ?? TRIGGER_DEFAULTS.inactiveDays;
      return { appLastLoginAt: { lt: new Date(now.getTime() - days * 86_400_000) } };
    }
    case "missedGames": {
      const n = segment.triggerValue ?? TRIGGER_DEFAULTS.missedGames;
      const games = await prisma.game.findMany({
        where: { clubId, venue: "HOME", status: "PLAYED", kickoffAt: { lte: now } },
        orderBy: { kickoffAt: "desc" },
        take: n,
        select: { id: true },
      });
      // no played games yet → nobody "missed" anything (never blast everyone by accident)
      if (games.length === 0) return { id: { in: [] } };
      return { attendances: { none: { gameId: { in: games.map((g) => g.id) }, attended: true } } };
    }
    default:
      return null;
  }
}

export function describeSegment(segment: SegmentQuery): string {
  const parts = [`segment=${segment.segment}`];
  if (segment.cities?.length) parts.push(`cities=${segment.cities.length}`);
  if (segment.subTypes?.length) parts.push(`subTypes=${segment.subTypes.join("/")}`);
  if (segment.minScore !== undefined) parts.push(`minScore=${segment.minScore}`);
  if (segment.appUsersOnly) parts.push("appUsersOnly");
  if (segment.trigger) parts.push(`trigger=${segment.trigger}${segment.triggerValue ? `:${segment.triggerValue}` : ""}`);
  return parts.join(", ");
}

export function templateVars(fan: Pick<FanRow, "firstName" | "lastName" | "customerNumber" | "city">, clubName: string) {
  return {
    firstName: fan.firstName,
    lastName: fan.lastName,
    fullName: `${fan.firstName} ${fan.lastName}`.trim(),
    customerNumber: fan.customerNumber,
    city: fan.city ?? "",
    clubName,
  };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function textToHtml(text: string): string {
  return `<div dir="rtl" style="text-align:right;font-family:Arial,sans-serif;white-space:pre-line">${escapeHtml(text)}</div>`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

@Injectable()
export class CampaignRunnerService {
  private readonly logger = new Logger(CampaignRunnerService.name);
  /** campaigns currently sending — a cron tick never overlaps a running send */
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly inforu: InforuService,
  ) {}

  isRunning(campaignId: string): boolean {
    return this.running.has(campaignId);
  }

  /** Static filters + the trigger condition, ready for count / paging. */
  async resolveWhere(
    clubId: string,
    channel: Channel,
    category: MessageCategory,
    segment: SegmentQuery,
    now = new Date(),
  ): Promise<Prisma.FanWhereInput> {
    const where = audienceWhere(clubId, channel, category, segment);
    const extra = await triggerWhere(this.prisma, clubId, segment, now);
    if (extra) (where.AND as Prisma.FanWhereInput[]).push(extra);
    return where;
  }

  async estimate(clubId: string, channel: Channel, category: MessageCategory, segment: SegmentQuery): Promise<number> {
    return this.prisma.fan.count({ where: await this.resolveWhere(clubId, channel, category, segment) });
  }

  /** "Who is this for, and how many": the base audience and each trigger's share of it. */
  async insights(clubId: string, channel: Channel, category: MessageCategory, segment: SegmentQuery): Promise<AudienceInsights> {
    const now = new Date();
    const base: SegmentQuery = { ...segment, trigger: undefined, triggerValue: undefined };
    const values = {
      missedGames: segment.trigger === "missedGames" ? (segment.triggerValue ?? TRIGGER_DEFAULTS.missedGames) : TRIGGER_DEFAULTS.missedGames,
      inactiveDays: segment.trigger === "inactiveDays" ? (segment.triggerValue ?? TRIGGER_DEFAULTS.inactiveDays) : TRIGGER_DEFAULTS.inactiveDays,
      month: now.getMonth() + 1,
    };
    const count = async (trigger?: Trigger, triggerValue?: number) =>
      this.prisma.fan.count({ where: await this.resolveWhere(clubId, channel, category, { ...base, trigger, triggerValue }, now) });
    const [total, birthdayMonth, missedGames, inactiveDays] = await Promise.all([
      count(),
      count("birthdayMonth"),
      count("missedGames", values.missedGames),
      count("inactiveDays", values.inactiveDays),
    ]);
    return { total, birthdayMonth, missedGames, inactiveDays, values };
  }

  /** Sends the campaign to its whole audience, page by page. Returns the run summary. */
  async run(campaignId: string, trigger: "manual" | "schedule"): Promise<RunSummary> {
    const startedAt = new Date();
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { club: { select: { name: true } } },
    });
    if (!campaign) throw new NotFoundException("הקמפיין לא נמצא");
    const dryRun = this.inforu.dryRun();
    const base = { campaignId, trigger, dryRun, audience: 0, sent: 0, failed: 0, suppressed: 0, startedAt: startedAt.toISOString() };

    if (this.running.has(campaignId)) {
      return { ...base, finishedAt: new Date().toISOString(), skipped: "running" };
    }
    if (trigger === "schedule" && (!campaign.enabled || campaign.status === "PAUSED" || campaign.status === "CANCELLED")) {
      return { ...base, finishedAt: new Date().toISOString(), skipped: "disabled" };
    }

    this.running.add(campaignId);
    await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: "SENDING", lastError: null } });
    this.logger.log(`Campaign ${campaignId} started (${trigger}${dryRun ? ", dry-run" : ""})`);

    const segment = (campaign.segmentQuery as unknown as SegmentQuery | null) ?? { segment: "all" };
    const where = await this.resolveWhere(campaign.clubId, campaign.channel, campaign.category, segment, startedAt);
    const body =
      campaign.category === "TRANSACTIONAL" ? campaign.body : ensureOptOut(campaign.body, this.inforu.optOutText());
    const personalized = hasPlaceholders(body);
    const seen = new Set<string>();
    let cursor: string | undefined;
    let audience = 0;
    let sent = 0;
    let failed = 0;
    let suppressed = 0;
    let lastError: string | null = null;

    try {
      for (;;) {
        const page = await this.prisma.fan.findMany({
          where,
          orderBy: { id: "asc" },
          take: PAGE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          select: { id: true, firstName: true, lastName: true, customerNumber: true, city: true, phone: true, email: true },
        });
        if (page.length === 0) break;
        cursor = page[page.length - 1].id;
        audience += page.length;

        const logs: Prisma.MessageLogCreateManyInput[] = [];
        const targets: Target[] = [];
        for (const fan of page) {
          const address =
            campaign.channel === "EMAIL" ? fan.email?.trim().toLowerCase() || null : normalizeIsraeliPhone(fan.phone);
          const reason = !address ? "invalid_address" : seen.has(address) ? "duplicate" : null;
          if (reason || !address) {
            suppressed += 1;
            logs.push(this.logRow(campaign, fan.id, "SUPPRESSED", null, null, reason));
            continue;
          }
          seen.add(address);
          targets.push({ fan, address });
        }

        // Personalized bodies go one recipient per request; a fixed text goes in batches
        const batches = personalized ? targets.map((t) => [t]) : chunk(targets, SMS_BATCH_SIZE);
        for (const batch of batches) {
          const message = personalized ? renderTemplate(body, templateVars(batch[0].fan, campaign.club.name)) : body;
          const result = await this.dispatch(campaign, message, batch);
          if (result.ok) sent += batch.length;
          else {
            failed += batch.length;
            lastError = result.description;
          }
          for (const t of batch) {
            logs.push(
              this.logRow(campaign, t.fan.id, result.ok ? "SENT" : "FAILED", t.address, result.batchId, result.ok ? null : result.description),
            );
          }
        }
        // A dry run simulates only — nothing is written per fan
        if (!dryRun && logs.length) await this.prisma.messageLog.createMany({ data: logs });
        if (page.length < PAGE) break;
      }
    } catch (e) {
      lastError = (e as Error).message;
      this.logger.error(`Campaign ${campaignId} failed: ${lastError}`);
    } finally {
      this.running.delete(campaignId);
    }

    const finishedAt = new Date();
    const summary: RunSummary = { ...base, audience, sent, failed, suppressed, finishedAt: finishedAt.toISOString() };
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: this.finalStatus(campaign),
        lastRunAt: finishedAt,
        lastError,
        lastRunSummary: summary as unknown as Prisma.InputJsonValue,
        runCount: { increment: 1 },
        reach: audience,
        ...(dryRun
          ? {}
          : {
              sentAt: campaign.sentAt ?? finishedAt,
              sentCount: { increment: sent },
              failedCount: { increment: failed },
              suppressedCount: { increment: suppressed },
            }),
      },
    });
    this.logger.log(
      `Campaign "${campaign.name}" (${trigger}) ran on ${audience} fans matching its settings [${describeSegment(segment)}]: ` +
        `sent ${sent}, failed ${failed}, suppressed ${suppressed}${dryRun ? " — dry-run, nothing was sent" : ""}`,
    );
    return summary;
  }

  /** One rendered message to one address — for the "test send" button. */
  async testSend(campaign: CampaignWithClub, to: { phone?: string; email?: string }): Promise<InforuResult> {
    const sample = { id: "test", firstName: "ישראל", lastName: "ישראלי", customerNumber: "12345", city: "באר שבע", phone: null, email: null };
    const body =
      campaign.category === "TRANSACTIONAL" ? campaign.body : ensureOptOut(campaign.body, this.inforu.optOutText());
    const message = renderTemplate(body, templateVars(sample, campaign.club.name));
    const address = campaign.channel === "EMAIL" ? to.email?.trim().toLowerCase() || null : normalizeIsraeliPhone(to.phone);
    if (!address) {
      return { ok: false, dryRun: this.inforu.dryRun(), batchId: "", accepted: 0, status: "invalid", description: "invalid_address" };
    }
    return this.dispatch(campaign, message, [{ fan: sample, address }]);
  }

  private finalStatus(campaign: Campaign): CampaignStatus {
    if (campaign.scheduleType === "CRON") return campaign.enabled ? "SCHEDULED" : "PAUSED";
    return "SENT";
  }

  private dispatch(campaign: CampaignWithClub, message: string, batch: Target[]): Promise<InforuResult> {
    const recipients = batch.map((t) => ({
      phone: campaign.channel === "EMAIL" ? null : t.address,
      email: campaign.channel === "EMAIL" ? t.address : null,
      firstName: t.fan.firstName,
      lastName: t.fan.lastName,
    }));
    switch (campaign.channel) {
      case "SMS":
        return this.inforu.sendSms({ message, recipients, sender: campaign.sender ?? undefined });
      case "WHATSAPP":
        if (!campaign.templateId) {
          return Promise.resolve({ ok: false, dryRun: this.inforu.dryRun(), batchId: "", accepted: 0, status: "config", description: "missing_template_id" });
        }
        return this.inforu.sendWhatsApp({
          templateId: campaign.templateId,
          parameters: [{ name: "[#1#]", value: message }],
          recipients,
        });
      case "EMAIL":
        return this.inforu.sendEmail({
          subject: campaign.subject?.trim() || campaign.name,
          html: textToHtml(message),
          recipients,
          campaignName: campaign.name,
        });
      default:
        return Promise.resolve({ ok: false, dryRun: this.inforu.dryRun(), batchId: "", accepted: 0, status: "config", description: `unsupported_channel:${campaign.channel}` });
    }
  }

  private logRow(
    campaign: Campaign,
    fanId: string,
    status: MessageStatus,
    recipient: string | null,
    batchId: string | null,
    error: string | null,
  ): Prisma.MessageLogCreateManyInput {
    return {
      clubId: campaign.clubId,
      fanId,
      campaignId: campaign.id,
      channel: campaign.channel,
      category: campaign.category,
      status,
      subject: campaign.subject,
      triggerReason: `campaign:${campaign.id}`,
      recipient,
      providerBatchId: batchId,
      error,
      sentAt: status === "SENT" ? new Date() : null,
    };
  }
}
