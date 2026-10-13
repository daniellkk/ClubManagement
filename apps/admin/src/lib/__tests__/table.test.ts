import { describe, expect, it } from "vitest";
import { compareValues, sortRows } from "../table";

describe("compareValues", () => {
  it("orders numbers numerically in both directions", () => {
    expect(compareValues(2, 10, "asc")).toBeLessThan(0);
    expect(compareValues(2, 10, "desc")).toBeGreaterThan(0);
  });

  it("orders strings with locale + numeric awareness", () => {
    expect(compareValues("10", "9", "asc")).toBeGreaterThan(0); // numeric: 10 > 9
    expect(compareValues("א", "ב", "asc")).toBeLessThan(0);
  });

  it("always puts null / undefined last, regardless of direction", () => {
    expect(compareValues(null, 5, "asc")).toBeGreaterThan(0);
    expect(compareValues(null, 5, "desc")).toBeGreaterThan(0);
    expect(compareValues(5, undefined, "desc")).toBeLessThan(0);
    expect(compareValues(null, null, "asc")).toBe(0);
  });

  it("treats booleans as 0 / 1", () => {
    expect(compareValues(false, true, "asc")).toBeLessThan(0);
  });
});

describe("sortRows", () => {
  const rows = [{ n: 3 }, { n: null }, { n: 1 }, { n: 2 }];

  it("sorts without mutating the input", () => {
    const sorted = sortRows(rows, (r) => r.n, "asc");
    expect(sorted.map((r) => r.n)).toEqual([1, 2, 3, null]);
    expect(rows.map((r) => r.n)).toEqual([3, null, 1, 2]);
  });

  it("keeps nulls last when descending", () => {
    expect(sortRows(rows, (r) => r.n, "desc").map((r) => r.n)).toEqual([3, 2, 1, null]);
  });
});
