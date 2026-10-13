import { Injectable, NotFoundException } from "@nestjs/common";
import {
  Channel,
  ConsentAction,
  ConsentSource,
  FanStatus,
  ImportStatus,
  Prisma,
  SubscriptionStatus,
  Venue,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { birthMonthOf, parseBirthDate } from "./birth-date";
import { ExistsDto, ImportFansDto, ImportRowDto } from "./dto/import-fans.dto";
import {
  FacetsQueryDto,
  QueryFansDto,
  type FanColumn,
  type FanFilters,
} from "./dto/query-fans.dto";
import { UpdateFanDto } from "./dto/update-fan.dto";

/** Facet key for "no value" — must match the admin client */
export const EMPTY_TOKEN = "__EMPTY__";
const FACET_LIMIT = 50;
const SEP = "|";
const DEFAULT_IMPORT_SUB_TYPE = "רגיל";

const CONSENT_FIELDS: Array<{
  key: "emailOptIn" | "smsOptIn" | "whatsappOptIn" | "pushOptIn";
  channel: Channel;
}> = [
  { key: "emailOptIn", channel: Channel.EMAIL },
  { key: "smsOptIn", channel: Channel.SMS },
  { key: "whatsappOptIn", channel: Channel.WHATSAPP },
  { key: "pushOptIn", channel: Channel.PUSH },
];

export interface FacetOption {
  key: string;
  value: string | number | null;
  count: number;
}

const CURRENT_SEASON = { season: { isCurrent: true } } as const;

function dayKey(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : EMPTY_TOKEN;
}

function dayRange(key: string): { gte: Date; lt: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const gte = new Date(`${key}T00:00:00.000Z`);
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

function clean(v: string | undefined): string | undefined {
  const s = v?.trim();
  return s ? s : undefined;
}

@Injectable()
export class FansService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO(auth): resolve the club from the authenticated admin user.
  // Single-tenant dev mode: use the first (seeded) club.
  private async clubId(): Promise<string> {
    const club = await this.prisma.club.findFirst({ select: { id: true } });
    if (!club) throw new NotFoundException("No club configured");
    return club.id;
  }

  // ── Where / order builders ───────────────────────────────────────────────

  private columnWhere(column: FanColumn, values: string[]): Prisma.FanWhereInput {
    const hasEmpty = values.includes(EMPTY_TOKEN);
    const vals = values.filter((v) => v !== EMPTY_TOKEN);
    const nums = vals.map(Number).filter((n) => !Number.isNaN(n));
    const or: Prisma.FanWhereInput[] = [];

    switch (column) {
      case "customerNumber":
        if (vals.length) or.push({ customerNumber: { in: vals } });
        break;
      case "name":
        for (const v of vals) {
          const [firstName, lastName = ""] = v.split(SEP);
          or.push({ firstName, lastName });
        }
        break;
      case "age":
        if (nums.length) or.push({ age: { in: nums } });
        if (hasEmpty) or.push({ age: null });
        break;
      case "city":
        if (vals.length) or.push({ city: { in: vals } });
        if (hasEmpty) or.push({ city: null });
        break;
      case "score":
        if (nums.length) or.push({ engagementScore: { in: nums } });
        break;
      case "status": {
        const statuses = vals.filter((v): v is FanStatus => v in FanStatus);
        if (statuses.length) or.push({ status: { in: statuses } });
        break;
      }
      case "seat":
        for (const v of vals) {
          const [seatArea = "", seatRow = "", seatNumber = ""] = v.split(SEP);
          or.push({
            seatArea: seatArea || null,
            seatRow: seatRow || null,
            seatNumber: seatNumber || null,
          });
        }
        if (hasEmpty) or.push({ seatArea: null, seatRow: null, seatNumber: null });
        break;
      case "subType":
        if (vals.length) {
          or.push({ subscriptions: { some: { ...CURRENT_SEASON, type: { in: vals } } } });
        }
        if (hasEmpty) or.push({ subscriptions: { none: CURRENT_SEASON } });
        break;
      case "lastLogin":
      case "lastActivity": {
        const field = column === "lastLogin" ? "appLastLoginAt" : "lastActivityAt";
        for (const v of vals) {
          const range = dayRange(v);
          if (range) or.push({ [field]: range });
        }
        if (hasEmpty) or.push({ [field]: null });
        break;
      }
    }
    // A filter that matches nothing valid excludes everything (like an empty Excel selection)
    return or.length ? { OR: or } : { id: { in: [] } };
  }

  private buildWhere(
    clubId: string,
    q: string | undefined,
    filters: FanFilters | undefined,
    except?: FanColumn,
  ): Prisma.FanWhereInput {
    const and: Prisma.FanWhereInput[] = [];
    const search = q?.trim();
    if (search) {
      and.push({
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { customerNumber: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
          { oldEmail: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
        ],
      });
    }
    for (const [column, values] of Object.entries(filters ?? {})) {
      if (column === except || !values) continue;
      and.push(this.columnWhere(column as FanColumn, values));
    }
    return { clubId, deletedAt: null, ...(and.length ? { AND: and } : {}) };
  }

  private orderBy(
    sortKey: FanColumn | undefined,
    sortDir: "asc" | "desc" = "asc",
  ): Prisma.FanOrderByWithRelationInput[] {
    const nullable = { sort: sortDir, nulls: "last" as const };
    switch (sortKey) {
      case "customerNumber":
        return [{ customerNumber: sortDir }];
      case "name":
        return [{ firstName: sortDir }, { lastName: sortDir }];
      case "age":
        return [{ age: nullable }];
      case "city":
        return [{ city: nullable }];
      case "score":
        return [{ engagementScore: sortDir }];
      case "status":
        return [{ status: sortDir }];
      case "lastLogin":
        return [{ appLastLoginAt: nullable }];
      case "lastActivity":
        return [{ lastActivityAt: nullable }];
      case "seat":
        return [{ seatArea: nullable }, { seatRow: nullable }, { seatNumber: nullable }];
      default:
        // subType lives on a relation — natural order
        return [{ customerNumber: "asc" }];
    }
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  async list(dto: QueryFansDto) {
    const clubId = await this.clubId();
    const where = this.buildWhere(clubId, dto.q, dto.filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.fan.findMany({
        where,
        orderBy: this.orderBy(dto.sortKey, dto.sortDir),
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        include: {
          subscriptions: {
            where: CURRENT_SEASON,
            select: { type: true, status: true, paymentStatus: true },
            take: 1,
          },
        },
      }),
      this.prisma.fan.count({ where }),
    ]);

    return {
      items: items.map(({ subscriptions, ...fan }) => ({
        ...fan,
        currentSubscription: subscriptions[0] ?? null,
      })),
      total,
      page: dto.page,
      pageSize: dto.pageSize,
    };
  }

  /** Distinct values (top 50 by frequency) of one column, other filters applied. */
  async facets(dto: FacetsQueryDto): Promise<FacetOption[]> {
    const clubId = await this.clubId();
    const where = this.buildWhere(clubId, dto.q, dto.filters, dto.column);
    const count = { _count: { _all: true } } as const;
    let options: FacetOption[] = [];

    switch (dto.column) {
      case "customerNumber": {
        const rows = await this.prisma.fan.groupBy({
          by: ["customerNumber"], where, ...count,
          orderBy: { _count: { customerNumber: "desc" } }, take: FACET_LIMIT,
        });
        options = rows.map((r) => ({ key: r.customerNumber, value: r.customerNumber, count: r._count._all }));
        break;
      }
      case "name": {
        const rows = await this.prisma.fan.groupBy({
          by: ["firstName", "lastName"], where, ...count,
          orderBy: { _count: { firstName: "desc" } }, take: FACET_LIMIT,
        });
        options = rows.map((r) => ({
          key: `${r.firstName}${SEP}${r.lastName}`,
          value: `${r.firstName} ${r.lastName}`.trim(),
          count: r._count._all,
        }));
        break;
      }
      case "age": {
        const rows = await this.prisma.fan.groupBy({
          by: ["age"], where, ...count, orderBy: { _count: { age: "desc" } }, take: FACET_LIMIT,
        });
        options = rows.map((r) => ({ key: r.age === null ? EMPTY_TOKEN : String(r.age), value: r.age, count: r._count._all }));
        break;
      }
      case "city": {
        const rows = await this.prisma.fan.groupBy({
          by: ["city"], where, ...count, orderBy: { _count: { city: "desc" } }, take: FACET_LIMIT,
        });
        options = rows.map((r) => ({ key: r.city ?? EMPTY_TOKEN, value: r.city, count: r._count._all }));
        break;
      }
      case "score": {
        const rows = await this.prisma.fan.groupBy({
          by: ["engagementScore"], where, ...count,
          orderBy: { _count: { engagementScore: "desc" } }, take: FACET_LIMIT,
        });
        options = rows.map((r) => ({ key: String(r.engagementScore), value: r.engagementScore, count: r._count._all }));
        break;
      }
      case "status": {
        const rows = await this.prisma.fan.groupBy({
          by: ["status"], where, ...count, orderBy: { _count: { status: "desc" } }, take: FACET_LIMIT,
        });
        options = rows.map((r) => ({ key: r.status, value: r.status, count: r._count._all }));
        break;
      }
      case "seat": {
        const rows = await this.prisma.fan.groupBy({
          by: ["seatArea", "seatRow", "seatNumber"], where, ...count,
          orderBy: { _count: { seatArea: "desc" } }, take: FACET_LIMIT,
        });
        options = rows.map((r) => {
          const empty = !r.seatArea && !r.seatRow && !r.seatNumber;
          const joined = [r.seatArea ?? "", r.seatRow ?? "", r.seatNumber ?? ""].join(SEP);
          return { key: empty ? EMPTY_TOKEN : joined, value: empty ? null : joined, count: r._count._all };
        });
        break;
      }
      case "subType": {
        const [rows, none] = await Promise.all([
          this.prisma.subscription.groupBy({
            by: ["type"],
            where: { ...CURRENT_SEASON, fan: where },
            ...count,
            orderBy: { _count: { type: "desc" } },
            take: FACET_LIMIT,
          }),
          this.prisma.fan.count({ where: { ...where, subscriptions: { none: CURRENT_SEASON } } }),
        ]);
        options = rows.map((r) => ({ key: r.type, value: r.type, count: r._count._all }));
        if (none > 0) options.push({ key: EMPTY_TOKEN, value: null, count: none });
        break;
      }
      case "lastLogin":
      case "lastActivity": {
        const field = dto.column === "lastLogin" ? "appLastLoginAt" : "lastActivityAt";
        // Timestamps are grouped per day; a few hundred groups is still an aggregate,
        // never fan rows.
        const rows = await this.prisma.fan.groupBy({
          by: [field], where, ...count, orderBy: { _count: { [field]: "desc" } }, take: 400,
        });
        const byDay = new Map<string, number>();
        for (const r of rows) {
          const key = dayKey(r[field]);
          byDay.set(key, (byDay.get(key) ?? 0) + r._count._all);
        }
        options = [...byDay.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, FACET_LIMIT)
          .map(([key, c]) => ({ key, value: key === EMPTY_TOKEN ? null : key, count: c }));
        break;
      }
    }

    // Empty last, then natural order — the same shape the client used for mock data
    return options.sort((a, b) => {
      if (a.key === EMPTY_TOKEN) return 1;
      if (b.key === EMPTY_TOKEN) return -1;
      if (typeof a.value === "number" && typeof b.value === "number") return a.value - b.value;
      return String(a.value).localeCompare(String(b.value), ["he", "en"], { numeric: true });
    });
  }

  async cities() {
    const clubId = await this.clubId();
    const rows = await this.prisma.fan.findMany({
      where: { clubId, deletedAt: null, city: { not: null } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
      take: 200,
    });
    return rows.map((r) => r.city);
  }

  async detail(id: string) {
    const clubId = await this.clubId();
    const fan = await this.prisma.fan.findFirst({
      where: { id, clubId, deletedAt: null },
      include: {
        subscriptions: {
          include: { season: true },
          orderBy: { season: { startDate: "desc" } },
          take: 3,
        },
        attendances: {
          include: { game: true },
          orderBy: { game: { kickoffAt: "desc" } },
          take: 10,
        },
        fanTags: { include: { tag: true } },
      },
    });
    if (!fan) throw new NotFoundException("Fan not found");

    const attended = fan.attendances.filter((a) => a.attended);
    const home = attended.filter((a) => a.game.venue === Venue.HOME).length;
    const away = attended.filter((a) => a.game.venue === Venue.AWAY).length;

    const { attendances, fanTags, subscriptions, ...rest } = fan;
    return {
      ...rest,
      tags: fanTags.map((ft) => ft.tag.name),
      currentSubscription: subscriptions.find((s) => s.season.isCurrent) ?? null,
      subscriptionHistory: subscriptions,
      attendanceStats: { total: attended.length, home, away },
      matchHistory: attendances.map((a) => ({
        gameId: a.gameId,
        opponent: a.game.opponent,
        venue: a.game.venue,
        date: a.game.kickoffAt,
        attended: a.attended,
      })),
    };
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateFanDto) {
    const clubId = await this.clubId();
    const existing = await this.prisma.fan.findFirst({
      where: { id, clubId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Fan not found");

    // Record every consent flip in the immutable consent ledger
    const consentEntries = CONSENT_FIELDS.filter(
      ({ key }) => dto[key] !== undefined && dto[key] !== existing[key],
    ).map(({ key, channel }) => ({
      fanId: id,
      channel,
      action: dto[key] ? ConsentAction.OPT_IN : ConsentAction.OPT_OUT,
      source: ConsentSource.ADMIN_UI,
    }));

    const [fan] = await this.prisma.$transaction([
      this.prisma.fan.update({ where: { id }, data: { ...dto, lastActivityAt: new Date() } }),
      ...(consentEntries.length
        ? [this.prisma.consentLog.createMany({ data: consentEntries })]
        : []),
    ]);
    return fan;
  }

  /** Soft delete — the row stays for audit; a purge job hard-deletes later. */
  async remove(id: string) {
    const clubId = await this.clubId();
    const existing = await this.prisma.fan.findFirst({
      where: { id, clubId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Fan not found");
    await this.prisma.fan.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async exists(dto: ExistsDto) {
    const clubId = await this.clubId();
    const numbers = [...new Set(dto.customerNumbers.map((n) => n.trim()).filter(Boolean))];
    if (!numbers.length) return { existing: [] };
    const rows = await this.prisma.fan.findMany({
      where: { clubId, deletedAt: null, customerNumber: { in: numbers } },
      select: { customerNumber: true },
    });
    return { existing: rows.map((r) => r.customerNumber) };
  }

  /**
   * Imports one chunk (≤ 2,000 rows) with a fixed number of bulk statements —
   * one INSERT for new fans, one UPDATE … FROM (VALUES …) for existing ones —
   * so a 1,000-row chunk costs a handful of round trips, not a thousand.
   */
  async importRows(dto: ImportFansDto, createdById: string | null) {
    const clubId = await this.clubId();
    const now = new Date();
    const season = await this.prisma.season.findFirst({
      where: { clubId, isCurrent: true },
      select: { id: true },
    });

    // Last occurrence of a customer number in the chunk wins
    const byNumber = new Map<string, ImportRowDto>();
    for (const row of dto.rows) {
      const cn = row.customerNumber.trim();
      if (cn) byNumber.set(cn, row);
    }
    const numbers = [...byNumber.keys()];
    if (!numbers.length) return { added: 0, updated: 0, fanIds: [] as string[] };

    const rows = numbers.map((customerNumber) => {
      const row = byNumber.get(customerNumber)!;
      const birthDate = parseBirthDate(row.birthDate);
      return {
        customerNumber,
        firstName: clean(row.firstName) ?? null,
        lastName: clean(row.lastName) ?? null,
        // Club rule: fall back to the old email when there is no new one
        email: clean(row.email) ?? clean(row.oldEmail) ?? null,
        oldEmail: clean(row.oldEmail) ?? null,
        legacyId: clean(row.legacyId) ?? null,
        phone: clean(row.phone) ?? null,
        city: clean(row.city) ?? null,
        age: row.age ?? null,
        birthDate,
        birthMonth: birthMonthOf(birthDate),
        seatArea: clean(row.seatArea) ?? null,
        seatRow: clean(row.seatRow) ?? null,
        seatNumber: clean(row.seatNumber) ?? null,
      };
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = new Set(
        (
          await tx.fan.findMany({
            where: { clubId, customerNumber: { in: numbers } },
            select: { customerNumber: true },
          })
        ).map((r) => r.customerNumber),
      );
      const toCreate = rows.filter((r) => !existing.has(r.customerNumber));
      const toUpdate = rows.filter((r) => existing.has(r.customerNumber));

      // 1) New fans — a single INSERT
      if (toCreate.length) {
        await tx.fan.createMany({
          data: toCreate.map((r) => ({
            clubId,
            ...r,
            firstName: r.firstName ?? "",
            lastName: r.lastName ?? "",
            engagementScore: 50,
            importedAt: now,
            lastActivityAt: now,
          })),
          skipDuplicates: true,
        });
      }

      // 2) Existing fans — a single UPDATE; blank cells in the file keep the current value
      if (toUpdate.length) {
        const values = Prisma.join(
          toUpdate.map(
            (r) =>
              Prisma.sql`(${r.customerNumber}::text, ${r.firstName}::text, ${r.lastName}::text, ${r.email}::text, ${r.oldEmail}::text, ${r.legacyId}::text, ${r.phone}::text, ${r.city}::text, ${r.age}::int, ${r.birthDate}::timestamptz, ${r.birthMonth}::int, ${r.seatArea}::text, ${r.seatRow}::text, ${r.seatNumber}::text)`,
          ),
        );
        await tx.$executeRaw`
          UPDATE "Fan" AS f SET
            "firstName"      = COALESCE(v."firstName", f."firstName"),
            "lastName"       = COALESCE(v."lastName", f."lastName"),
            "email"          = COALESCE(v."email", f."email"),
            "oldEmail"       = COALESCE(v."oldEmail", f."oldEmail"),
            "legacyId"       = COALESCE(v."legacyId", f."legacyId"),
            "phone"          = COALESCE(v."phone", f."phone"),
            "city"           = COALESCE(v."city", f."city"),
            "age"            = COALESCE(v."age", f."age"),
            "birthDate"      = COALESCE(v."birthDate", f."birthDate"),
            "birthMonth"     = COALESCE(v."birthMonth", f."birthMonth"),
            "seatArea"       = COALESCE(v."seatArea", f."seatArea"),
            "seatRow"        = COALESCE(v."seatRow", f."seatRow"),
            "seatNumber"     = COALESCE(v."seatNumber", f."seatNumber"),
            "lastActivityAt" = ${now},
            "updatedAt"      = ${now}
          FROM (VALUES ${values}) AS v(
            "customerNumber", "firstName", "lastName", "email", "oldEmail", "legacyId",
            "phone", "city", "age", "birthDate", "birthMonth", "seatArea", "seatRow", "seatNumber"
          )
          WHERE f."clubId" = ${clubId} AND f."customerNumber" = v."customerNumber"`;
      }

      // 3) Ids + seats of everything touched (bounded by the chunk size)
      const fans = await tx.fan.findMany({
        where: { clubId, customerNumber: { in: numbers } },
        select: { id: true, seatArea: true, seatRow: true, seatNumber: true },
      });

      // 4) A reserved seat implies a season subscription — one INSERT + one UPDATE
      if (season) {
        const holders = fans.filter((f) => f.seatArea || f.seatRow || f.seatNumber);
        if (holders.length) {
          const seatOf = (f: (typeof holders)[number]) =>
            [f.seatArea, f.seatRow, f.seatNumber].filter(Boolean).join("/");
          await tx.subscription.createMany({
            data: holders.map((f) => ({
              fanId: f.id,
              seasonId: season.id,
              type: DEFAULT_IMPORT_SUB_TYPE,
              seat: seatOf(f),
              status: SubscriptionStatus.ACTIVE,
            })),
            skipDuplicates: true,
          });
          const seatValues = Prisma.join(
            holders.map((f) => Prisma.sql`(${f.id}::text, ${seatOf(f)}::text)`),
          );
          await tx.$executeRaw`
            UPDATE "Subscription" AS s SET "seat" = v."seat", "updatedAt" = ${now}
            FROM (VALUES ${seatValues}) AS v("fanId", "seat")
            WHERE s."fanId" = v."fanId" AND s."seasonId" = ${season.id}`;
        }
      }

      await tx.importJob.create({
        data: {
          clubId,
          fileName: dto.fileName,
          status: ImportStatus.COMPLETED,
          totalRows: dto.rows.length,
          importedRows: fans.length,
          createdById,
          completedAt: now,
        },
      });

      return { added: toCreate.length, updated: toUpdate.length, fanIds: fans.map((f) => f.id) };
    }, { timeout: 60_000 });

    return result;
  }
}
