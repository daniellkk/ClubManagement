import { describe, expect, it, vi } from "vitest";
import { FansService } from "./fans.service";
import type { PrismaService } from "../prisma/prisma.service";

import { EMPTY_TOKEN as EMPTY } from "./fans.service";

/** Minimal Prisma stand-in: records calls, returns canned rows, no database. */
function fakePrisma(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[]> = {};
  const rec = (name: string, result: unknown) =>
    vi.fn(async (...args: unknown[]) => {
      (calls[name] ??= []).push(args[0]);
      return typeof result === "function" ? (result as (a: unknown) => unknown)(args[0]) : result;
    });
  const raw = vi.fn(async () => 1);
  const prisma = {
    club: { findFirst: rec("club.findFirst", { id: "club1" }) },
    season: { findFirst: rec("season.findFirst", { id: "season1" }) },
    fan: {
      findMany: rec("fan.findMany", []),
      count: rec("fan.count", 0),
      groupBy: rec("fan.groupBy", []),
      createMany: rec("fan.createMany", { count: 0 }),
      update: rec("fan.update", {}),
    },
    subscription: {
      groupBy: rec("subscription.groupBy", []),
      createMany: rec("subscription.createMany", { count: 0 }),
    },
    importJob: { create: rec("importJob.create", {}) },
    $executeRaw: raw,
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[]),
    ),
    ...overrides,
  };
  return { prisma, calls, raw };
}

const service = (p: ReturnType<typeof fakePrisma>) =>
  new FansService(p.prisma as unknown as PrismaService);

describe("FansService.list — paged, whitelisted filters", () => {
  it("pages with skip/take and never asks for everything", async () => {
    const p = fakePrisma();
    await service(p).list({ page: 3, pageSize: 25 });
    const args = p.calls["fan.findMany"][0] as { skip: number; take: number; where: unknown };
    expect(args.skip).toBe(50);
    expect(args.take).toBe(25);
    expect(args.where).toMatchObject({ clubId: "club1", deletedAt: null });
  });

  it("builds an AND of OR-clauses per column, including blank buckets", async () => {
    const p = fakePrisma();
    await service(p).list({
      page: 1,
      pageSize: 25,
      q: "כהן",
      filters: { city: ["באר שבע", EMPTY], status: ["ACTIVE", "BOGUS"], subType: [EMPTY] },
    });
    const where = (p.calls["fan.findMany"][0] as { where: { AND: unknown[] } }).where;
    expect(where.AND).toHaveLength(4); // search + 3 columns
    expect(where.AND[1]).toEqual({ OR: [{ city: { in: ["באר שבע"] } }, { city: null }] });
    expect(where.AND[2]).toEqual({ OR: [{ status: { in: ["ACTIVE"] } }] }); // BOGUS dropped
    expect(where.AND[3]).toEqual({ OR: [{ subscriptions: { none: { season: { isCurrent: true } } } }] });
  });

  it("turns a date filter into a day range and an impossible filter into no rows", async () => {
    const p = fakePrisma();
    await service(p).list({ page: 1, pageSize: 10, filters: { lastLogin: ["2026-08-31"], age: ["abc"] } });
    const where = (p.calls["fan.findMany"][0] as { where: { AND: unknown[] } }).where;
    expect(where.AND[0]).toEqual({
      OR: [{ appLastLoginAt: { gte: new Date("2026-08-31T00:00:00.000Z"), lt: new Date("2026-09-01T00:00:00.000Z") } }],
    });
    expect(where.AND[1]).toEqual({ id: { in: [] } });
  });

  it("only sorts on whitelisted columns and keeps nulls last", async () => {
    const p = fakePrisma();
    await service(p).list({ page: 1, pageSize: 10, sortKey: "age", sortDir: "desc" });
    expect((p.calls["fan.findMany"][0] as { orderBy: unknown }).orderBy).toEqual([{ age: { sort: "desc", nulls: "last" } }]);
    await service(p).list({ page: 1, pageSize: 10, sortKey: "subType", sortDir: "asc" });
    expect((p.calls["fan.findMany"][1] as { orderBy: unknown }).orderBy).toEqual([{ customerNumber: "asc" }]);
  });

  it("returns the current subscription flattened onto each fan", async () => {
    const p = fakePrisma({
      fan: {
        findMany: vi.fn(async () => [{ id: "f1", subscriptions: [{ type: "VIP", status: "ACTIVE", paymentStatus: "PAID" }] }, { id: "f2", subscriptions: [] }]),
        count: vi.fn(async () => 2),
      },
    });
    const res = await service(p).list({ page: 1, pageSize: 10 });
    expect(res.total).toBe(2);
    expect(res.items[0]).toMatchObject({ id: "f1", currentSubscription: { type: "VIP" } });
    expect(res.items[1]).toMatchObject({ id: "f2", currentSubscription: null });
  });
});

describe("FansService.facets", () => {
  it("groups by the column, sorts naturally and puts the blank bucket last", async () => {
    const p = fakePrisma({
      fan: {
        groupBy: vi.fn(async () => [
          { city: "דימונה", _count: { _all: 3 } },
          { city: null, _count: { _all: 2 } },
          { city: "באר שבע", _count: { _all: 40 } },
        ]),
      },
    });
    const facets = await service(p).facets({ column: "city" });
    expect(facets.map((f) => [f.key, f.count])).toEqual([["באר שבע", 40], ["דימונה", 3], [EMPTY, 2]]);
  });

  it("excludes the column's own filter when computing its options", async () => {
    const p = fakePrisma();
    await service(p).facets({ column: "city", filters: { city: ["x"], status: ["ACTIVE"] } });
    const where = (p.calls["fan.groupBy"][0] as { where: { AND?: unknown[] } }).where;
    expect(where.AND).toHaveLength(1);
    expect(where.AND![0]).toEqual({ OR: [{ status: { in: ["ACTIVE"] } }] });
  });
});

describe("FansService.importRows — bulk, not per row", () => {
  const rows = [
    { customerNumber: "1001", firstName: "א", lastName: "ב", oldEmail: "old@example.com", seatArea: "A", seatRow: "1", seatNumber: "2" },
    { customerNumber: "1002", firstName: "ג", lastName: "ד", email: "new@example.com" },
    { customerNumber: "1001", firstName: "א2", lastName: "ב2", oldEmail: "old@example.com" }, // duplicate → last one wins
    { customerNumber: "   ", firstName: "ignored" },
  ];

  it("inserts new fans in one createMany, updates existing ones in one raw UPDATE", async () => {
    const p = fakePrisma({
      fan: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ customerNumber: "1002" }]) // existence check
          .mockResolvedValueOnce([
            { id: "f1", seatArea: "A", seatRow: "1", seatNumber: "2" },
            { id: "f2", seatArea: null, seatRow: null, seatNumber: null },
          ]),
        createMany: vi.fn(async () => ({ count: 1 })),
      },
    });
    const res = await service(p).importRows({ fileName: "t.csv", rows }, "admin1");

    expect(res).toEqual({ added: 1, updated: 1, fanIds: ["f1", "f2"] });
    const created = (p.prisma.fan.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as { data: Record<string, unknown>[] };
    expect(created.data).toHaveLength(1);
    expect(created.data[0]).toMatchObject({
      customerNumber: "1001",
      firstName: "א2", // last occurrence wins
      email: "old@example.com", // falls back to the old email
      engagementScore: 50,
    });
    // one UPDATE … FROM (VALUES) for existing fans + one seat UPDATE for subscriptions
    expect(p.raw).toHaveBeenCalledTimes(2);
    expect((p.prisma.subscription.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      data: [{ fanId: "f1", seasonId: "season1", type: "רגיל", seat: "A/1/2" }],
      skipDuplicates: true,
    });
    expect(p.calls["importJob.create"][0]).toMatchObject({ data: { fileName: "t.csv", createdById: "admin1", importedRows: 2 } });
  });

  it("does nothing for a chunk without customer numbers", async () => {
    const p = fakePrisma();
    const res = await service(p).importRows({ fileName: "t.csv", rows: [{ customerNumber: " " }] }, null);
    expect(res).toEqual({ added: 0, updated: 0, fanIds: [] });
    expect(p.prisma.$transaction).not.toHaveBeenCalled();
  });
});
