import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Campaign, CampaignStatus, Prisma } from "@prisma/client";
import { InforuService } from "../messaging/inforu.service";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignRunnerService } from "./campaign-runner.service";
import { CampaignSchedulerService } from "./campaign-scheduler.service";
import { CRON_PRESETS, DEFAULT_TIMEZONE, SEGMENTS, type SegmentQuery } from "./campaign.types";
import {
  CAMPAIGN_CATEGORIES,
  CAMPAIGN_CHANNELS,
  SCHEDULE_TYPES,
  type CampaignInputDto,
  type EstimateDto,
  type PagedQueryDto,
  type QueryCampaignsDto,
  type TestSendDto,
} from "./dto/campaign.dto";

/** "+972501234567" → "+97250***567", "dan@x.com" → "d***@x.com" — enough to recognise, not to dial. */
export function maskRecipient(value: string | null): string | null {
  if (!value) return null;
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 1)}***@${domain}`;
  }
  return value.length > 6 ? `${value.slice(0, value.length - 6)}***${value.slice(-3)}` : "***";
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: CampaignRunnerService,
    private readonly scheduler: CampaignSchedulerService,
    private readonly inforu: InforuService,
  ) {}

  meta() {
    return {
      channels: CAMPAIGN_CHANNELS,
      categories: CAMPAIGN_CATEGORIES,
      segments: SEGMENTS,
      scheduleTypes: SCHEDULE_TYPES,
      cronPresets: CRON_PRESETS,
      timezone: DEFAULT_TIMEZONE,
      inforu: this.inforu.status(),
    };
  }

  async list(clubId: string, query: QueryCampaignsDto) {
    const where: Prisma.CampaignWhereInput = {
      clubId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q?.trim() ? { name: { contains: query.q.trim(), mode: "insensitive" } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    // "how many would get it right now" per row — one count query each, bounded by the page size
    const estimates = await Promise.all(
      items.map((c) =>
        this.runner
          .estimate(clubId, c.channel, c.category, this.segmentOf(c))
          .catch(() => null),
      ),
    );
    return {
      items: items.map((c, i) => ({ ...this.toApi(c), estimatedAudience: estimates[i] })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  insights(clubId: string, dto: EstimateDto) {
    return this.runner.insights(clubId, dto.channel, dto.category, dto.segment);
  }

  async get(clubId: string, id: string) {
    return this.toApi(await this.find(clubId, id));
  }

  estimate(clubId: string, dto: EstimateDto): Promise<{ count: number }> {
    return this.runner.estimate(clubId, dto.channel, dto.category, dto.segment).then((count) => ({ count }));
  }

  async create(clubId: string, adminId: string | null, dto: CampaignInputDto) {
    const data = this.normalize(dto);
    const created = await this.prisma.campaign.create({
      data: { clubId, createdById: adminId, status: this.initialStatus(dto), ...data },
    });
    return this.afterSave(created);
  }

  async update(clubId: string, id: string, dto: CampaignInputDto) {
    const existing = await this.find(clubId, id);
    if (existing.status === "SENDING" || this.runner.isRunning(id)) {
      throw new ConflictException("הקמפיין נשלח כרגע — אפשר לערוך אותו כשהשליחה תסתיים");
    }
    const data = this.normalize(dto);
    const keepSent = existing.status === "SENT" && dto.scheduleType !== "CRON";
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { ...data, status: keepSent ? "SENT" : this.initialStatus(dto) },
    });
    return this.afterSave(updated);
  }

  async setEnabled(clubId: string, id: string, enabled: boolean) {
    const existing = await this.find(clubId, id);
    let status: CampaignStatus = existing.status;
    if (existing.scheduleType !== "MANUAL") status = enabled ? "SCHEDULED" : "PAUSED";
    const updated = await this.prisma.campaign.update({ where: { id }, data: { enabled, status } });
    return this.afterSave(updated);
  }

  async remove(clubId: string, id: string) {
    await this.find(clubId, id);
    if (this.runner.isRunning(id)) throw new ConflictException("הקמפיין נשלח כרגע");
    this.scheduler.remove(id);
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }

  /** Starts the send in the background; the client polls the campaign row for progress. */
  async run(clubId: string, id: string) {
    const campaign = await this.find(clubId, id);
    if (this.runner.isRunning(id)) throw new ConflictException("הקמפיין כבר נשלח כרגע");
    if (campaign.channel === "WHATSAPP" && !campaign.templateId) {
      throw new BadRequestException("קמפיין WhatsApp דורש מזהה תבנית של InforU");
    }
    this.runner
      .run(id, "manual")
      .catch((e: unknown) => this.logger.error(`Manual run of ${id} failed: ${(e as Error).message}`));
    return { started: true, dryRun: this.inforu.dryRun() };
  }

  async testSend(clubId: string, id: string, dto: TestSendDto) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, clubId }, include: { club: { select: { name: true } } } });
    if (!campaign) throw new NotFoundException("הקמפיין לא נמצא");
    if (campaign.channel === "EMAIL" && !dto.email) throw new BadRequestException("נדרשת כתובת אימייל לבדיקה");
    if (campaign.channel !== "EMAIL" && !dto.phone) throw new BadRequestException("נדרש מספר טלפון לבדיקה");
    const result = await this.runner.testSend(campaign, dto);
    return { ok: result.ok, dryRun: result.dryRun, status: result.status, description: result.description };
  }

  async messages(clubId: string, id: string, query: PagedQueryDto) {
    await this.find(clubId, id);
    const where: Prisma.MessageLogWhereInput = { campaignId: id, clubId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: { id: true, status: true, recipient: true, error: true, sentAt: true, createdAt: true, providerBatchId: true },
      }),
      this.prisma.messageLog.count({ where }),
    ]);
    const byStatus = await this.prisma.messageLog.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      orderBy: { status: "asc" },
    });
    return {
      items: rows.map((r) => ({ ...r, recipient: maskRecipient(r.recipient) })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async find(clubId: string, id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, clubId } });
    if (!campaign) throw new NotFoundException("הקמפיין לא נמצא");
    return campaign;
  }

  private initialStatus(dto: CampaignInputDto): CampaignStatus {
    if (dto.scheduleType === "MANUAL") return "DRAFT";
    return dto.enabled === false ? "PAUSED" : "SCHEDULED";
  }

  /** Cross-field rules the decorators cannot express. */
  private normalize(dto: CampaignInputDto) {
    if (dto.scheduleType === "ONCE") {
      if (!dto.scheduledAt) throw new BadRequestException("קמפיין חד־פעמי דורש מועד שליחה");
      if (new Date(dto.scheduledAt).getTime() <= Date.now()) throw new BadRequestException("מועד השליחה חייב להיות בעתיד");
    }
    if (dto.scheduleType === "CRON" && !dto.cronExpression) throw new BadRequestException("קמפיין מחזורי דורש ביטוי cron");
    if (dto.channel === "WHATSAPP" && !dto.templateId?.trim()) throw new BadRequestException("קמפיין WhatsApp דורש מזהה תבנית");
    if (dto.channel === "EMAIL" && !dto.subject?.trim()) throw new BadRequestException("קמפיין אימייל דורש נושא");
    const segment: SegmentQuery = { ...dto.segment };
    return {
      name: dto.name.trim(),
      channel: dto.channel,
      category: dto.category,
      subject: dto.subject?.trim() || null,
      body: dto.body.trim(),
      sender: dto.sender?.trim() || null,
      templateId: dto.templateId?.trim() || null,
      segmentQuery: segment as unknown as Prisma.InputJsonValue,
      scheduleType: dto.scheduleType,
      scheduledAt: dto.scheduleType === "ONCE" && dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      cronExpression: dto.scheduleType === "CRON" ? dto.cronExpression!.trim() : null,
      timezone: dto.timezone?.trim() || DEFAULT_TIMEZONE,
      enabled: dto.enabled ?? true,
    };
  }

  /** Re-registers the job and stores the next run so the list can show it without the registry. */
  private async afterSave(campaign: Campaign) {
    const next = this.scheduler.sync(campaign);
    const updated = await this.prisma.campaign.update({ where: { id: campaign.id }, data: { nextRunAt: next } });
    return this.toApi(updated);
  }

  private segmentOf(campaign: Campaign): SegmentQuery {
    return (campaign.segmentQuery as unknown as SegmentQuery | null) ?? { segment: "all" };
  }

  private toApi(campaign: Campaign) {
    return {
      ...campaign,
      segmentQuery: this.segmentOf(campaign),
      nextRunAt: this.scheduler.nextRun(campaign.id) ?? campaign.nextRunAt,
      running: this.runner.isRunning(campaign.id),
    };
  }
}
