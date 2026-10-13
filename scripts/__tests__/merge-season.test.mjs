import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { beforeAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));

// Synthetic files with the ticketing system's real headers — no real customers.
const DETAILS = `Cust. no.,Name,Total sales,Last purchase,Number of season tickets,Country,Post.cd.,Town,Street,House no.,Birthday,Area code (1st phone no.),Direct line (1st phone no.),Area code (cell 1),Mobile 1 direct dial,Email address 1
216850,". יומברו,",0,12/08/2026,15,Israel,,,,,,,,,507853622,one@example.com
423,"בן עזרי, תומר",4200,01/07/2026,1,Israel,8502522,מיתר,דתלא,6,15/03/1988,,,,29592225,two@example.com
000777,"ישראלי, ישראל",8400,03/07/2026,2,Israel,8410000,באר שבע,הרצל,12,,8,6412345,,521234567,family@example.com
9001,"לבד, רק בפרטים",0,,0,Israel,,אשדוד,,,,,,,,only.details@example.com
`;
const SEATS = `Customer,Name,Season,Series,Seat status,Block name,Block code,Row,Seat,Price,Currency,Order,Invoice,Surname or company 1,First name or company 2,Town (street address),Area code (1st phone no.),Direct line (1st phone no.),Email address 1,Pay. type,Number of years
423,"בן עזרי, תומר",2026/2027,מנוי 2026/27,sold seat,שער 10,G10,18,1,4200,ILS,59550,36739,בן עזרי,תומר,מיתר,,29592225,two@example.com,transfer,5
777,"ישראלי, ישראל",2026/2027,מנוי 2026/27,sold seat,שער 5,G5,3,14,4200,ILS,59551,36740,ישראלי,ישראל,באר שבע,8,6412345,family@example.com,credit card,3
777,"ישראלי, ישראל",2026/2027,מנוי 2026/27,sold seat,שער 5,G5,3,15,4200,ILS,59551,36740,ישראלי,ישראל,באר שבע,8,6412345,family@example.com,credit card,3
9002,"מושב, רק",2026/2027,מנוי 2026/27,sold seat,שער 2,G2,7,9,3800,ILS,59560,36750,מושב,רק,דימונה,,,only.seats@example.com,cash,1
`;

describe("scripts/merge-season.cjs", () => {
  let wb;

  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "merge-season-"));
    fs.writeFileSync(path.join(dir, "details.csv"), "﻿" + DETAILS, "utf8");
    fs.writeFileSync(path.join(dir, "seats.csv"), SEATS, "utf8");
    execFileSync(
      process.execPath,
      [
        path.resolve(here, "..", "merge-season.cjs"),
        "--details", path.join(dir, "details.csv"),
        "--seats", path.join(dir, "seats.csv"),
        "--out", path.join(dir, "out.xlsx"),
        "--per-seat",
      ],
      { stdio: "pipe" },
    );
    wb = XLSX.readFile(path.join(dir, "out.xlsx"));
  });

  it("writes the four sheets", () => {
    expect(wb.SheetNames).toEqual(["Summary", "Merged", "Delta", "Seats"]);
  });

  it("summarises the match between the two files", () => {
    const summary = Object.fromEntries(XLSX.utils.sheet_to_json(wb.Sheets.Summary).map((r) => [r.Metric, r.Value]));
    expect(Number(summary["Customers in season details"])).toBe(4);
    expect(Number(summary["Seat rows"])).toBe(4);
    expect(Number(summary["Subscribers (customers with seats)"])).toBe(3);
    expect(Number(summary["Customers in both files"])).toBe(2);
    expect(Number(summary["In season details only (no seat)"])).toBe(2);
    expect(Number(summary["In seats only (missing from details)"])).toBe(1);
    expect(Number(summary["Total unique customers"])).toBe(5);
  });

  it("merges one row per customer, matching keys despite leading zeros", () => {
    const merged = XLSX.utils.sheet_to_json(wb.Sheets.Merged);
    const byNo = Object.fromEntries(merged.map((r) => [String(r["Customer no."]), r]));
    expect(byNo["777"]).toMatchObject({
      "First name": "ישראל",
      "Last name": "ישראלי",
      Mobile: "052-1234567",
      Phone: "08-6412345",
      Source: "both",
      "Seats count": 2,
      "Seats total price": 8400,
    });
    expect(byNo["777"].Seats).toBe("G5 · row 3 · seat 14; G5 · row 3 · seat 15");
    expect(byNo["216850"]).toMatchObject({ "Last name": "יומברו", Mobile: "050-7853622", Source: "season details only" });
    expect(byNo["216850"]["First name"] ?? "").toBe("");
    expect(byNo["9002"]).toMatchObject({ Source: "seats only", Town: "דימונה" });
    // every original details column is carried over, prefixed
    expect(String(byNo["423"]["details: Number of season tickets"])).toBe("1");
  });

  it("lists only the customers missing from one side in the Delta sheet", () => {
    const delta = XLSX.utils.sheet_to_json(wb.Sheets.Delta);
    expect(delta.map((r) => [String(r["Customer no."]), r["Missing from"]])).toEqual([
      ["9001", "season per seat"],
      ["9002", "season details"],
      ["216850", "season per seat"],
    ]);
  });

  it("adds a per-seat sheet joined to the customer when asked", () => {
    const seats = XLSX.utils.sheet_to_json(wb.Sheets.Seats);
    expect(seats).toHaveLength(4);
    expect(seats.find((r) => String(r["Customer no."]) === "9002")["In season details"]).toBe("no");
  });
});
