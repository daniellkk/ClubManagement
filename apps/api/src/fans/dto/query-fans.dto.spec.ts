import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { QueryFansDto } from "./query-fans.dto";

describe("QueryFansDto", () => {
  it("defaults to page 1 / 25 rows", async () => {
    const dto = plainToInstance(QueryFansDto, {});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(25);
  });

  it("rejects page sizes above 100 — the API can never be asked for everything", async () => {
    const dto = plainToInstance(QueryFansDto, { pageSize: "500" });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain("pageSize");
  });

  it("parses the filters JSON and drops columns outside the whitelist", async () => {
    const dto = plainToInstance(QueryFansDto, {
      filters: JSON.stringify({ city: ["באר שבע"], status: ["ACTIVE"], password: ["x"], age: "notArray" }),
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.filters).toEqual({ city: ["באר שבע"], status: ["ACTIVE"] });
  });

  it("accepts only whitelisted sort keys and directions", async () => {
    const bad = plainToInstance(QueryFansDto, { sortKey: "passwordHash", sortDir: "sideways" });
    const errors = await validate(bad);
    expect(errors.map((e) => e.property).sort()).toEqual(["sortDir", "sortKey"]);
    const good = plainToInstance(QueryFansDto, { sortKey: "score", sortDir: "desc" });
    expect(await validate(good)).toHaveLength(0);
  });
});
