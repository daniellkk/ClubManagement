import { describe, expect, it } from "vitest";
import { birthMonthOf, parseBirthDate } from "./birth-date";

describe("parseBirthDate — spreadsheet birthdays", () => {
  it("reads dd/mm/yyyy, dd.mm.yyyy, ISO and Excel serials", () => {
    expect(parseBirthDate("15/03/1988")?.toISOString()).toBe("1988-03-15T00:00:00.000Z");
    expect(parseBirthDate("5.3.1988")?.toISOString()).toBe("1988-03-05T00:00:00.000Z");
    expect(parseBirthDate("1988-03-15")?.toISOString()).toBe("1988-03-15T00:00:00.000Z");
    expect(parseBirthDate("1988-03-15T00:00:00.000Z")?.toISOString()).toBe("1988-03-15T00:00:00.000Z");
    expect(parseBirthDate("32217")?.toISOString()).toBe("1988-03-15T00:00:00.000Z");
  });

  it("rejects impossible or empty values", () => {
    expect(parseBirthDate("31/02/1988")).toBeNull();
    expect(parseBirthDate("15/03/1800")).toBeNull();
    expect(parseBirthDate("")).toBeNull();
    expect(parseBirthDate("yesterday")).toBeNull();
    expect(parseBirthDate(undefined)).toBeNull();
  });

  it("derives the month used by birthday campaigns", () => {
    expect(birthMonthOf(parseBirthDate("15/03/1988"))).toBe(3);
    expect(birthMonthOf(null)).toBeNull();
  });
});
