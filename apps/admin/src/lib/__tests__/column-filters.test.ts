import { describe, expect, it } from "vitest";
import {
  applyColumnFilters,
  computeFacets,
  EMPTY_TOKEN,
  MAX_FACET_OPTIONS,
  valueKey,
  type ColumnDef,
} from "../column-filters";

interface Row {
  city: string | null;
  age: number | null;
  tier: string | null;
}

const rows: Row[] = [
  { city: "באר שבע", age: 34, tier: "vip" },
  { city: "באר שבע", age: 28, tier: "regular" },
  { city: "אופקים", age: 45, tier: "silver" },
  { city: null, age: null, tier: null },
  { city: "דימונה", age: 31, tier: null },
];

const columns: ColumnDef<Row>[] = [
  { key: "city", getValue: (r) => r.city },
  { key: "age", getValue: (r) => r.age },
  { key: "tier", getValue: (r) => r.tier },
];

describe("valueKey", () => {
  it("maps null, undefined and empty string to the empty token", () => {
    expect(valueKey(null)).toBe(EMPTY_TOKEN);
    expect(valueKey(undefined)).toBe(EMPTY_TOKEN);
    expect(valueKey("")).toBe(EMPTY_TOKEN);
  });

  it("stringifies everything else", () => {
    expect(valueKey(34)).toBe("34");
    expect(valueKey("באר שבע")).toBe("באר שבע");
    expect(valueKey(false)).toBe("false");
  });
});

describe("applyColumnFilters", () => {
  it("returns every row when no filter is set", () => {
    expect(applyColumnFilters(rows, columns, {})).toHaveLength(5);
    expect(applyColumnFilters(rows, columns, { city: undefined })).toHaveLength(5);
  });

  it("keeps only rows whose value key is selected", () => {
    const out = applyColumnFilters(rows, columns, { city: new Set(["באר שבע"]) });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.city === "באר שבע")).toBe(true);
  });

  it("selects blank cells through the empty token", () => {
    const out = applyColumnFilters(rows, columns, { tier: new Set([EMPTY_TOKEN]) });
    expect(out.map((r) => r.city)).toEqual([null, "דימונה"]);
  });

  it("combines filters on different columns with AND", () => {
    const out = applyColumnFilters(rows, columns, {
      city: new Set(["באר שבע", "אופקים"]),
      tier: new Set(["vip", "silver"]),
    });
    expect(out.map((r) => r.age)).toEqual([34, 45]);
  });

  it("an empty selection matches nothing (like Excel with every box unticked)", () => {
    expect(applyColumnFilters(rows, columns, { city: new Set() })).toHaveLength(0);
  });
});

describe("computeFacets", () => {
  it("counts distinct values and puts the blank bucket last", () => {
    const facets = computeFacets(rows, columns, {}, "city");
    expect(facets.map((f) => [f.key, f.count])).toEqual([
      ["אופקים", 1],
      ["באר שבע", 2],
      ["דימונה", 1],
      [EMPTY_TOKEN, 1],
    ]);
  });

  it("applies the OTHER columns' filters but ignores its own (Excel behaviour)", () => {
    const filters = { city: new Set(["באר שבע"]), tier: new Set(["vip"]) };
    // city facet ignores the city filter but honours tier=vip → only the vip row's city
    expect(computeFacets(rows, columns, filters, "city").map((f) => f.key)).toEqual(["באר שבע"]);
    // tier facet ignores the tier filter but honours city=באר שבע → vip + regular
    expect(computeFacets(rows, columns, filters, "tier").map((f) => f.key)).toEqual(["regular", "vip"]);
  });

  it("sorts numbers numerically", () => {
    expect(computeFacets(rows, columns, {}, "age").map((f) => f.value)).toEqual([28, 31, 34, 45, null]);
  });

  it("caps the list by frequency, never scanning into an unbounded option list", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ city: `city-${i % 120}`, age: i, tier: null }));
    const facets = computeFacets(many, columns, {}, "city");
    expect(facets.length).toBe(MAX_FACET_OPTIONS);
    // the most frequent values (those appearing twice) must survive the cap
    expect(facets.every((f) => f.count === 2)).toBe(true);
  });

  it("returns an empty list for an unknown column", () => {
    expect(computeFacets(rows, columns, {}, "nope")).toEqual([]);
  });
});
