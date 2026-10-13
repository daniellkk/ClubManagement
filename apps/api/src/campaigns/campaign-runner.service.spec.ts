import { describe, expect, it, vi } from "vitest";
import type { InforuService } from "../messaging/inforu.service";
import type { PrismaService } from "../prisma/prisma.service";
import { audienceWhere, CampaignRunnerService, triggerWhere } from "./campaign-runner.service";

const campaignRow = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  clubId: "club1",
  name: "מבצע",
  channel: "SMS",
  category: "MARKETING",
  status: "DRAFT",
  subject: null,
  body: "שלום {{firstName}}",
  sender: null,
  templateId: null,
  segmentQuery: { segment: "all" },
  scheduleType: "MANUAL",
  enabled: true,
  sentAt: null,
  club: { name: "הפועל באר שבע" },
  ...over,
});

const fans = [
  { id: "f1", firstName: "דני", lastName: "כהן", customerNumber: "1", city: "באר שבע", phone: "050-1234567", email: null },
  { id: "f2", firstName: "רות", lastName: "לוי", customerNumber: "2", city: null, phone: "abc", email: null },
  { id: "f3", firstName: "יוסי", lastName: "דהן", customerNumber: "3", city: null, phone: "+972501234567", email: null },
];

function setup(opts: { campaign?: Record<string, unknown>; dryRun?: boolean; sendOk?: boolean } = {}) {
  const dryRun = opts.dryRun ?? false;
  const sendOk = opts.sendOk ?? true;
  const prisma = {
    campaign: {
      findUnique: vi.fn(async () => campaignRow(opts.campaign)),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => args.data),
    },
    fan: {
      findMany: vi.fn().mockResolvedValueOnce(fans).mockResolvedValue([]),
      count: vi.fn(async () => 42),
    },
    messageLog: { createMany: vi.fn(async (args: { data: unknown[] }) => ({ count: args.data.length })) },
  };
  const inforu = {
    dryRun: () => dryRun,
    optOutText: () => "להסרה השיבו הסר",
    sendSms: vi.fn(async (_input: { message: string; recipients: unknown[] }) => ({
      ok: sendOk,
      dryRun,
      batchId: "b",
      accepted: 1,
      status: "1",
      description: sendOk ? "Success" : "boom",
    })),
    sendWhatsApp: vi.fn(),
    sendEmail: vi.fn(),
  };
  const service = new CampaignRunnerService(prisma as unknown as PrismaService, inforu as unknown as InforuService);
  return { prisma, inforu, service };
}

describe("audienceWhere — consent is enforced in the query", () => {
  it("marketing SMS needs a phone, the SMS opt-in and no global unsubscribe", () => {
    const where = audienceWhere("club1", "SMS", "MARKETING", { segment: "all" });
    expect(where).toMatchObject({ clubId: "club1", deletedAt: null, status: { in: ["ACTIVE"] } });
    expect(where.AND).toEqual([{ phone: { not: null } }, { smsOptIn: true }, { unsubscribedAt: null }]);
  });

  it("a transactional message only needs an address", () => {
    const where = audienceWhere("club1", "EMAIL", "TRANSACTIONAL", { segment: "all" });
    expect(where.AND).toEqual([{ email: { not: null } }]);
  });

  it("applies segment, cities, subscription types, score and app filters", () => {
    const where = audienceWhere("club1", "WHATSAPP", "GOODWILL", {
      segment: "subscribers",
      cities: ["באר שבע"],
      subTypes: ["VIP"],
      minScore: 60,
      appUsersOnly: true,
      statuses: ["ACTIVE", "INACTIVE"],
    });
    expect(where.status).toEqual({ in: ["ACTIVE", "INACTIVE"] });
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { whatsappOptIn: true },
        { subscriptions: { some: { season: { isCurrent: true }, status: "ACTIVE" } } },
        { city: { in: ["באר שבע"] } },
        { subscriptions: { some: { season: { isCurrent: true }, type: { in: ["VIP"] } } } },
        { engagementScore: { gte: 60 } },
        { appLastLoginAt: { not: null } },
      ]),
    );
  });
});

describe("triggerWhere — behaviour triggers resolved at run time", () => {
  const now = new Date("2026-09-09T10:00:00.000Z");

  it("birthday this month → the fan's birth month equals the current month", async () => {
    const prisma = { game: { findMany: vi.fn() } };
    expect(await triggerWhere(prisma as never, "club1", { segment: "all", trigger: "birthdayMonth" }, now)).toEqual({ birthMonth: 9 });
  });

  it("inactive N days → last app login before the cutoff", async () => {
    const prisma = { game: { findMany: vi.fn() } };
    const where = await triggerWhere(prisma as never, "club1", { segment: "all", trigger: "inactiveDays", triggerValue: 30 }, now);
    expect(where).toEqual({ appLastLoginAt: { lt: new Date("2026-08-10T10:00:00.000Z") } });
  });

  it("missed N games → no attendance at the last N played home games, nobody when there are none", async () => {
    const prisma = { game: { findMany: vi.fn(async () => [{ id: "g1" }, { id: "g2" }]) } };
    const where = await triggerWhere(prisma as never, "club1", { segment: "all", trigger: "missedGames", triggerValue: 2 }, now);
    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clubId: "club1", venue: "HOME", status: "PLAYED", kickoffAt: { lte: now } }, take: 2 }),
    );
    expect(where).toEqual({ attendances: { none: { gameId: { in: ["g1", "g2"] }, attended: true } } });

    const empty = { game: { findMany: vi.fn(async () => []) } };
    expect(await triggerWhere(empty as never, "club1", { segment: "all", trigger: "missedGames" }, now)).toEqual({ id: { in: [] } });
  });

  it("insights count the base audience and each trigger's share", async () => {
    const { service, prisma } = setup();
    (prisma as unknown as { game: unknown }).game = { findMany: vi.fn(async () => [{ id: "g1" }]) };
    const insights = await service.insights("club1", "SMS", "TRANSACTIONAL", { segment: "subscribers", trigger: "missedGames", triggerValue: 3 });
    expect(insights).toMatchObject({ total: 42, birthdayMonth: 42, missedGames: 42, inactiveDays: 42, values: { missedGames: 3, inactiveDays: 30 } });
    expect(prisma.fan.count).toHaveBeenCalledTimes(4);
  });
});

describe("CampaignRunnerService.run", () => {
  it("sends a personalised body one recipient at a time, suppressing invalid and duplicate numbers", async () => {
    const { service, prisma, inforu } = setup();
    const summary = await service.run("c1", "manual");
    expect(summary).toMatchObject({ audience: 3, sent: 1, failed: 0, suppressed: 2, dryRun: false, trigger: "manual" });
    // only דני is reachable: f2 has no valid phone, f3 is the same number as f1
    expect(inforu.sendSms).toHaveBeenCalledTimes(1);
    expect(inforu.sendSms.mock.calls[0][0]).toMatchObject({
      message: "שלום דני\nלהסרה השיבו הסר",
      recipients: [{ phone: "+972501234567", firstName: "דני" }],
    });
    const rows = prisma.messageLog.createMany.mock.calls[0][0].data as { fanId: string; status: string; error: string | null }[];
    expect(rows.map((r) => [r.fanId, r.status, r.error])).toEqual([
      ["f2", "SUPPRESSED", "invalid_address"],
      ["f3", "SUPPRESSED", "duplicate"],
      ["f1", "SENT", null],
    ]);
    const final = prisma.campaign.update.mock.calls.at(-1)![0].data;
    expect(final).toMatchObject({ status: "SENT", reach: 3, sentCount: { increment: 1 }, suppressedCount: { increment: 2 } });
  });

  it("batches a fixed text and writes nothing per fan in dry-run", async () => {
    const { service, prisma, inforu } = setup({ campaign: { body: "טקסט קבוע" }, dryRun: true });
    const summary = await service.run("c1", "manual");
    expect(summary).toMatchObject({ sent: 1, suppressed: 2, dryRun: true });
    expect(inforu.sendSms).toHaveBeenCalledTimes(1);
    expect(prisma.messageLog.createMany).not.toHaveBeenCalled();
    const final = prisma.campaign.update.mock.calls.at(-1)![0].data;
    expect(final.sentCount).toBeUndefined();
    expect(final.lastRunSummary).toMatchObject({ dryRun: true, audience: 3 });
  });

  it("records provider failures on the campaign and the log rows", async () => {
    const { service, prisma } = setup({ sendOk: false });
    const summary = await service.run("c1", "manual");
    expect(summary).toMatchObject({ sent: 0, failed: 1 });
    const final = prisma.campaign.update.mock.calls.at(-1)![0].data;
    expect(final.lastError).toBe("boom");
    const rows = prisma.messageLog.createMany.mock.calls[0][0].data as { status: string }[];
    expect(rows.map((r) => r.status)).toContain("FAILED");
  });

  it("keeps a recurring campaign scheduled and skips scheduled ticks while paused", async () => {
    const cron = setup({ campaign: { scheduleType: "CRON", status: "SCHEDULED" } });
    const summary = await cron.service.run("c1", "schedule");
    expect(cron.prisma.campaign.update.mock.calls.at(-1)![0].data.status).toBe("SCHEDULED");
    expect(summary.skipped).toBeUndefined();

    const paused = setup({ campaign: { scheduleType: "CRON", status: "PAUSED", enabled: false } });
    expect((await paused.service.run("c1", "schedule")).skipped).toBe("disabled");
    expect(paused.inforu.sendSms).not.toHaveBeenCalled();
  });

  it("never overlaps two runs of the same campaign", async () => {
    const { service, inforu } = setup();
    const first = service.run("c1", "manual");
    const second = await service.run("c1", "manual");
    expect(second.skipped).toBe("running");
    await first;
    expect(inforu.sendSms).toHaveBeenCalledTimes(1);
  });
});
