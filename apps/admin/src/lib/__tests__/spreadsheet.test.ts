import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { guessField, normalizeHeader, parseSpreadsheet } from "../spreadsheet";

describe("guessField — header auto-mapping", () => {
  it("recognises the club's CSV headers", () => {
    const expected: Record<string, string> = {
      customerNumber: "customerNumber",
      oldFirstName: "oldFirstName",
      oldLastName: "oldLastName",
      oldEmail: "oldEmail",
      oldId: "oldId",
      area: "seatArea",
      row: "seatRow",
      seat: "seatNumber",
      email: "email",
    };
    for (const [header, field] of Object.entries(expected)) {
      expect(guessField(header), header).toBe(field);
    }
  });

  it("is tolerant to spacing, case and punctuation", () => {
    expect(guessField("Customer Number")).toBe("customerNumber");
    expect(guessField("CUSTOMER_NUMBER")).toBe("customerNumber");
    expect(guessField("Cust. no.")).toBeNull(); // ticketing export header is handled by the merge script, not the importer
    expect(normalizeHeader("First-Name (old)")).toBe("firstnameold");
  });

  it("understands Hebrew headers", () => {
    expect(guessField("מספר לקוח")).toBe("customerNumber");
    expect(guessField("שם פרטי")).toBe("firstName");
    expect(guessField("אימייל")).toBe("email");
    expect(guessField("טלפון")).toBe("phone");
    expect(guessField("תאריך לידה")).toBe("birthDate");
    expect(guessField("Birthday")).toBe("birthDate");
    expect(guessField("עיר")).toBe("city");
    expect(guessField("שורה")).toBe("seatRow");
    expect(guessField("מושב")).toBe("seatNumber");
  });

  it("returns null for unknown headers", () => {
    expect(guessField("Total sales")).toBeNull();
    expect(guessField("")).toBeNull();
  });
});

describe("parseSpreadsheet", () => {
  it("reads a UTF-8 CSV with a BOM and keeps Hebrew intact", async () => {
    const csv = "﻿customerNumber,oldFirstName,oldLastName,email\n20001,רועי,אברהם,roi@example.com\n20002,ליאור,חדד,\n";
    const file = new File([csv], "fans.csv", { type: "text/csv" });
    const sheet = await parseSpreadsheet(file);
    expect(sheet.headers).toEqual(["customerNumber", "oldFirstName", "oldLastName", "email"]);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]).toMatchObject({ customerNumber: "20001", oldFirstName: "רועי", oldLastName: "אברהם" });
    expect(sheet.rows[1].email).toBe("");
  });

  it("reads an .xlsx workbook and stringifies every cell", async () => {
    const ws = XLSX.utils.json_to_sheet([
      { customerNumber: 30001, area: "A", row: 12, seat: 7 },
      { customerNumber: 30002, area: "B", row: 3, seat: 15 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = new File([buffer], "fans.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const sheet = await parseSpreadsheet(file);
    expect(sheet.headers).toEqual(["customerNumber", "area", "row", "seat"]);
    expect(sheet.rows[0]).toEqual({ customerNumber: "30001", area: "A", row: "12", seat: "7" });
  });

  it("auto-picks the biggest sheet of a workbook and lets the caller choose another", async () => {
    // Shaped like the season-merge output: a small Summary sheet first, the data in "Merged"
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([{ Metric: "Customers", Value: 2 }]),
      "Summary",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { "Customer no.": 777, "First name": "ישראל", "Last name": "ישראלי", Email: "a@x.com", Mobile: "052-1234567", Phone: "08-6412345", Town: "באר שבע" },
        { "Customer no.": 423, "First name": "תומר", "Last name": "בן עזרי", Email: "", Mobile: "", Phone: "", Town: "מיתר" },
      ]),
      "Merged",
    );
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = new File([buffer], "merged.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const auto = await parseSpreadsheet(file);
    expect(auto.sheetName).toBe("Merged");
    expect(auto.sheetNames).toEqual(["Summary", "Merged"]);
    expect(auto.rows).toHaveLength(2);
    expect(auto.rows[0]).toMatchObject({ "Customer no.": "777", Mobile: "052-1234567" });
    // the merged sheet's headers map straight onto the import fields; Mobile comes before Phone
    expect(auto.headers.map(guessField)).toEqual(["customerNumber", "firstName", "lastName", "email", "phone", "phone", "city"]);

    const summary = await parseSpreadsheet(file, "Summary");
    expect(summary.sheetName).toBe("Summary");
    expect(summary.headers).toEqual(["Metric", "Value"]);
  });

  it("returns no headers for an empty file", async () => {
    const sheet = await parseSpreadsheet(new File([""], "empty.csv", { type: "text/csv" }));
    expect(sheet.headers).toEqual([]);
    expect(sheet.rows).toEqual([]);
  });
});
