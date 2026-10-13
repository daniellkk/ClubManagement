import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { Campaign } from "@prisma/client";
import { CronJob } from "cron";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignRunnerService } from "./campaign-runner.service";
import { DEFAULT_TIMEZONE } from "./campaign.types";

type Schedulable = Pick<Campaign, "id" | "scheduleType" | "cronExpression" | "scheduledAt" | "timezone" | "enabled" | "status">;

/**
 * One cron job per scheduled campaign, registered in Nest's SchedulerRegistry.
 * Jobs are (re)built from the campaign row on boot and after every save, so
 * editing a campaign's schedule updates its job immediately — no restart.
 */
@Injectable()
export class CampaignSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CampaignSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SchedulerRegistry,
    private readonly runner: CampaignRunnerService,
  ) {}

  async onModuleInit() {
    // Nothing can be mid-send right after boot: a SENDING row is a crash or seed leftover
    const stuck = await this.prisma.campaign.updateMany({ where: { status: "SENDING" }, data: { status: "DRAFT" } });
    if (stuck.count) this.logger.warn(`Reset ${stuck.count} campaign(s) stuck in SENDING to DRAFT`);

    const rows = await this.prisma.campaign.findMany({
      where: { enabled: true, scheduleType: { in: ["ONCE", "CRON"] }, status: "SCHEDULED" },
      select: { id: true, scheduleType: true, cronExpression: true, scheduledAt: true, timezone: true, enabled: true, status: true },
    });
    let registered = 0;
    for (const row of rows) {
      const next = this.sync(row);
      if (next) {
        registered += 1;
        await this.prisma.campaign.update({ where: { id: row.id }, data: { nextRunAt: next } });
      }
    }
    this.logger.log(`Registered ${registered} scheduled campaign job(s)`);
  }

  jobName(campaignId: string): string {
    return `campaign:${campaignId}`;
  }

  remove(campaignId: string): void {
    const name = this.jobName(campaignId);
    if (this.registry.doesExist("cron", name)) this.registry.deleteCronJob(name);
  }

  /** Replaces the campaign's job with one matching its current configuration. Returns the next run. */
  sync(campaign: Schedulable): Date | null {
    this.remove(campaign.id);
    if (!campaign.enabled || campaign.status === "CANCELLED" || campaign.status === "PAUSED") return null;

    let cronTime: string | Date;
    if (campaign.scheduleType === "CRON") {
      if (!campaign.cronExpression) return null;
      cronTime = campaign.cronExpression;
    } else if (campaign.scheduleType === "ONCE") {
      // a one-off in the past is never fired automatically — run it by hand instead
      if (!campaign.scheduledAt || campaign.scheduledAt.getTime() <= Date.now() || campaign.status === "SENT") return null;
      cronTime = campaign.scheduledAt;
    } else {
      return null;
    }

    const job = CronJob.from({
      cronTime,
      timeZone: campaign.timezone || DEFAULT_TIMEZONE,
      start: true,
      onTick: () => {
        this.runner
          .run(campaign.id, "schedule")
          .catch((e: unknown) => this.logger.error(`Scheduled run of ${campaign.id} failed: ${(e as Error).message}`));
        if (campaign.scheduleType === "ONCE") this.remove(campaign.id);
      },
    });
    this.registry.addCronJob(this.jobName(campaign.id), job);
    return this.nextRun(campaign.id);
  }

  nextRun(campaignId: string): Date | null {
    const name = this.jobName(campaignId);
    if (!this.registry.doesExist("cron", name)) return null;
    const next = this.registry.getCronJob(name).nextDate();
    return next ? next.toJSDate() : null;
  }
}
