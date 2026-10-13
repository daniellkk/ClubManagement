import { describe, expect, it } from "vitest";
import { MAX_PAGE_SIZE, paginate } from "../paging";

const rows = Array.from({ length: 230 }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns the requested page and the total", () => {
    const page = paginate(rows, 2, 25);
    expect(page.items[0]).toBe(26);
    expect(page.items).toHaveLength(25);
    expect(page.total).toBe(230);
    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(25);
  });

  it("returns a short last page and an empty page past the end", () => {
    expect(paginate(rows, 10, 25).items).toEqual([226, 227, 228, 229, 230]);
    expect(paginate(rows, 11, 25).items).toEqual([]);
  });

  it("never serves more than MAX_PAGE_SIZE rows — 'query all' is impossible", () => {
    const page = paginate(rows, 1, 100000);
    expect(page.items).toHaveLength(MAX_PAGE_SIZE);
    expect(page.pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("clamps nonsensical page numbers and sizes", () => {
    expect(paginate(rows, 0, 0).page).toBe(1);
    expect(paginate(rows, -3, 10).items[0]).toBe(1);
    expect(paginate(rows, 1, 0).pageSize).toBe(1);
  });
});
