import { describe, expect, it } from "vitest";
import type { ColumnDef } from "../column-filters";
import { fanPopulation, type PopulationFan } from "../mock-data";
import { populationFacets, queryPopulation } from "../population-query";

const columns: ColumnDef<PopulationFan>[] = [
  { key: "name", getValue: (f) => f.name },
  { key: "city", getValue: (f) => f.cityId },
  { key: "score", getValue: (f) => f.score },
  { key: "tier", getValue: (f) => f.subscriptionType },
];

describe("queryPopulation", () => {
  it("pages, sorts and reports the total without returning everything", async () => {
    const page = await queryPopulation({
      rows: fanPopulation,
      page: 1,
      pageSize: 10,
      sortKey: "score",
      sortDir: "desc",
      columns,
      filters: {},
    });
    expect(page.items).toHaveLength(10);
    expect(page.total).toBe(fanPopulation.length);
    const scores = page.items.map((f) => f.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("applies search and column filters before paging", async () => {
    const city = fanPopulation[0].cityId;
    const page = await queryPopulation({
      rows: fanPopulation,
      page: 1,
      pageSize: 100,
      columns,
      filters: { city: new Set([city]) },
    });
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((f) => f.cityId === city)).toBe(true);
  });

  it("facets reflect the other filters", async () => {
    const city = fanPopulation[0].cityId;
    // "tier" has only a handful of distinct values, so the capped list still covers every fan
    const facets = await populationFacets(fanPopulation, columns, { city: new Set([city]) }, "tier");
    const inCity = fanPopulation.filter((f) => f.cityId === city).length;
    expect(facets.reduce((s, f) => s + f.count, 0)).toBe(inCity);
  });
});

describe("mock population invariants", () => {
  it("keeps short windows inside the season totals for every fan", () => {
    for (const f of fanPopulation) {
      expect(f.periods.last3Months.home).toBeLessThanOrEqual(f.homeAttended);
      expect(f.periods.lastMonth.home).toBeLessThanOrEqual(f.periods.last3Months.home);
      expect(f.periods.lastGame.home).toBeLessThanOrEqual(f.periods.lastMonth.home);
      expect(f.periods.last3Months.away).toBeLessThanOrEqual(f.awayAttended);
    }
  });

  it("only uses the three club tiers", () => {
    const tiers = new Set(fanPopulation.map((f) => f.subscriptionType).filter(Boolean));
    expect([...tiers].sort()).toEqual(["regular", "silver", "vip"]);
  });
});
