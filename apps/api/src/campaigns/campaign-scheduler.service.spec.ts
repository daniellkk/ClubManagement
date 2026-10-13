import { SchedulerRegistry } from "@nestjs/schedule";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { CampaignRunnerService } from "./campaign-runner.service";
import { CampaignSchedulerService } from "./campaign-scheduler.service";

function setup() {
  const registry = new SchedulerRegistry();
  const prisma = {
    campaign: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const runner = { run: vi.fn(async () => ({})) };
  const service = new CampaignSchedulerService(
    prisma as unknown as PrismaService,
    registry,
    runner as unknown as CampaignRunnerService,
  );
  return { service, registry, prisma, runner };
}

const base = { id: "c1", scheduleType: "CRON" as const, cronExpression: "0 10 * * *", scheduledAt: null, timezone: "Asia/Jerusalem", enabled: true, status: "SCHEDULED" as const };

describe("CampaignSchedulerService — one dynamic cron job per campaign", () => {
  const registries: SchedulerRegistry[] = [];
  afterEach(() => {
    for (const r of registries) for (const name of r.getCronJobs().keys()) r.deleteCronJob(name);
    registries.length = 0;
  });

  it("registers a recurring campaign and reports the next run in the future", () => {
    const { service, registry } = setup();
    registries.push(registry);
    const next = service.sync(base);
    expect(registry.doesExist("cron", "campaign:c1")).toBe(true);
    expect(next).toBeInstanceOf(Date);
    expect(next!.getTime()).toBeGreaterThan(Date.now());
    expect(service.nextRun("c1")).toEqual(next);
  });

  it("re-syncing replaces the job instead of stacking a second one", () => {
    const { service, registry } = setup();
    registries.push(registry);
    service.sync(base);
    service.sync({ ...base, cronExpression: "0 12 * * *" });
    expect(registry.getCronJobs().size).toBe(1);
    expect(service.nextRun("c1")!.getHours()).toBe(12);
  });

  it("manual, paused and disabled campaigns get no job", () => {
    const { service, registry } = setup();
    registries.push(registry);
    expect(service.sync({ ...base, scheduleType: "MANUAL" })).toBeNull();
    expect(service.sync({ ...base, enabled: false })).toBeNull();
    expect(service.sync({ ...base, status: "PAUSED" })).toBeNull();
    expect(registry.getCronJobs().size).toBe(0);
  });

  it("schedules a one-off at its date, but never one in the past", () => {
    const { service, registry } = setup();
    registries.push(registry);
    const at = new Date(Date.now() + 60_000);
    expect(service.sync({ ...base, scheduleType: "ONCE", cronExpression: null, scheduledAt: at })?.getTime()).toBe(at.getTime());
    expect(service.sync({ ...base, id: "c2", scheduleType: "ONCE", cronExpression: null, scheduledAt: new Date(Date.now() - 1000) })).toBeNull();
    expect(registry.doesExist("cron", "campaign:c2")).toBe(false);
  });

  it("removes the job when the campaign is deleted", () => {
    const { service, registry } = setup();
    registries.push(registry);
    service.sync(base);
    service.remove("c1");
    expect(registry.doesExist("cron", "campaign:c1")).toBe(false);
    expect(service.nextRun("c1")).toBeNull();
  });

  it("re-registers enabled scheduled campaigns on boot", async () => {
    const { service, registry, prisma } = setup();
    registries.push(registry);
    prisma.campaign.findMany.mockResolvedValueOnce([base, { ...base, id: "c2", scheduleType: "ONCE", cronExpression: null, scheduledAt: new Date(Date.now() + 60_000) }] as never);
    await service.onModuleInit();
    expect(registry.getCronJobs().size).toBe(2);
    expect(prisma.campaign.update).toHaveBeenCalledTimes(2);
    // a row left in SENDING by a crash can never run again — boot releases it
    expect(prisma.campaign.updateMany).toHaveBeenCalledWith({ where: { status: "SENDING" }, data: { status: "DRAFT" } });
  });
});
