import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IMPORT_CHUNK,
  checkExisting,
  importFans,
  queryFans,
  seatLabel,
  statusLabel,
  subTypeLabel,
  type ImportRow,
} from "../fans-api";

const t = (key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${Object.values(opts).join("/")}` : key;

describe("display helpers", () => {
  it("folds legacy subscription labels into the three club tiers", () => {
    expect(subTypeLabel("רגיל", t)).toBe("subTypes.regular");
    expect(subTypeLabel("סטודנט", t)).toBe("subTypes.regular");
    expect(subTypeLabel("זהב", t)).toBe("subTypes.silver");
    expect(subTypeLabel("ותיק", t)).toBe("subTypes.silver");
    expect(subTypeLabel("כסף", t)).toBe("subTypes.silver");
    expect(subTypeLabel("VIP", t)).toBe("subTypes.vip");
    expect(subTypeLabel("vip", t)).toBe("subTypes.vip");
  });

  it("shows unknown types as-is and nothing for no subscription", () => {
    expect(subTypeLabel("מנוי משפחתי", t)).toBe("מנוי משפחתי");
    expect(subTypeLabel(null, t)).toBeNull();
    expect(subTypeLabel(undefined, t)).toBeNull();
  });

  it("translates fan status codes", () => {
    expect(statusLabel("ACTIVE", t)).toBe("status.active");
    expect(statusLabel("ARCHIVED", t)).toBe("status.archived");
  });

  it("formats a reserved seat and stays empty without one", () => {
    expect(seatLabel({ seatArea: "A", seatRow: "12", seatNumber: "7" }, t)).toBe("fans.seatFormat:A/12/7");
    expect(seatLabel({ seatArea: null, seatRow: null, seatNumber: null }, t)).toBe("");
    expect(seatLabel({ seatArea: "G10", seatRow: null, seatNumber: "1" }, t)).toBe("fans.seatFormat:G10/—/1");
  });
});

describe("API client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("queryFans sends page, size, sort and the active filters as JSON — never 'all'", async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [], total: 0, page: 2, pageSize: 25 }));
    await queryFans({
      page: 2,
      pageSize: 25,
      q: "  כהן ",
      sortKey: "score",
      sortDir: "desc",
      filters: { city: new Set(["באר שבע"]), status: undefined },
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost");
    expect(url.pathname).toBe("/api/fans");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("25");
    expect(url.searchParams.get("q")).toBe("כהן");
    expect(url.searchParams.get("sortKey")).toBe("score");
    expect(url.searchParams.get("sortDir")).toBe("desc");
    expect(JSON.parse(url.searchParams.get("filters")!)).toEqual({ city: ["באר שבע"] });
  });

  it("surfaces the API error message", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: ["pageSize must not be greater than 100"] }, 400));
    await expect(queryFans({ page: 1, pageSize: 500, filters: {} })).rejects.toThrow(
      "pageSize must not be greater than 100",
    );
  });

  it("checkExisting batches customer numbers and merges the answers", async () => {
    const numbers = Array.from({ length: 1500 }, (_, i) => String(i));
    fetchMock
      .mockResolvedValueOnce(json({ existing: ["1", "2"] }))
      .mockResolvedValueOnce(json({ existing: ["1200"] }));
    const found = await checkExisting(numbers);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).customerNumbers).toHaveLength(1000);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).customerNumbers).toHaveLength(500);
    expect([...found].sort()).toEqual(["1", "1200", "2"]);
  });

  it("importFans sends 1,000-row chunks and sums the results", async () => {
    const rows: ImportRow[] = Array.from({ length: 2500 }, (_, i) => ({ customerNumber: String(i) }));
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { rows: ImportRow[] };
      return json({ added: body.rows.length, updated: 0 });
    });
    const progress: number[] = [];
    const result = await importFans("fans.csv", rows, (done) => progress.push(done));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).rows).toHaveLength(IMPORT_CHUNK);
    expect(result).toMatchObject({ added: 2500, updated: 0, cancelled: false, done: 2500 });
    expect(progress).toEqual([1000, 2000, 2500]);
  });

  it("importFans stops after the chunk in flight when cancelled and reports what was saved", async () => {
    const rows: ImportRow[] = Array.from({ length: 2500 }, (_, i) => ({ customerNumber: String(i) }));
    const controller = new AbortController();
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { rows: ImportRow[] };
      // cancel while the first chunk is being processed
      controller.abort();
      return json({ added: body.rows.length, updated: 0 });
    });
    const result = await importFans("fans.csv", rows, undefined, controller.signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ added: 1000, updated: 0, cancelled: true, done: 1000 });
  });
});
