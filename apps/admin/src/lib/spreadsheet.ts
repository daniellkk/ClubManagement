import * as XLSX from "xlsx";

export type ImportField =
  | "customerNumber"
  | "firstName"
  | "lastName"
  | "oldFirstName"
  | "oldLastName"
  | "email"
  | "oldEmail"
  | "oldId"
  | "phone"
  | "city"
  | "age"
  | "birthDate"
  | "seatArea"
  | "seatRow"
  | "seatNumber";

export const IMPORT_FIELDS: ImportField[] = [
  "customerNumber",
  "firstName",
  "lastName",
  "oldFirstName",
  "oldLastName",
  "email",
  "oldEmail",
  "oldId",
  "phone",
  "city",
  "age",
  "birthDate",
  "seatArea",
  "seatRow",
  "seatNumber",
];

// Header aliases (normalized: lower-case, no spaces/punctuation), Hebrew included
const ALIASES: Record<ImportField, string[]> = {
  customerNumber: ["customernumber", "customerno", "customerid", "clientnumber", "מספרלקוח", "מספרמנוי", "לקוח"],
  firstName: ["firstname", "givenname", "שםפרטי"],
  lastName: ["lastname", "surname", "familyname", "שםמשפחה"],
  oldFirstName: ["oldfirstname", "שםפרטיישן"],
  oldLastName: ["oldlastname", "שםמשפחהישן"],
  email: ["email", "mail", "emailaddress", "אימייל", "דואל", "מייל"],
  oldEmail: ["oldemail", "oldmail", "previousemail", "אימיילישן", "מיילישן"],
  oldId: ["oldid", "legacyid", "previousid", "מזההישן"],
  phone: ["phone", "mobile", "mobilephone", "cellphone", "cellular", "tel", "telephone", "טלפון", "נייד", "טלפוןנייד", "סלולרי"],
  city: ["city", "town", "עיר", "ישוב", "יישוב"],
  age: ["age", "גיל"],
  birthDate: ["birthdate", "birthday", "dateofbirth", "dob", "תאריךלידה", "יוםהולדת"],
  seatArea: ["area", "section", "block", "אזור", "גוש", "יציע"],
  seatRow: ["row", "שורה"],
  seatNumber: ["seat", "seatnumber", "seatno", "מושב", "כיסא", "מקום"],
};

export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_\-."'()]/g, "");
}

export function guessField(header: string): ImportField | null {
  const key = normalizeHeader(header);
  for (const field of IMPORT_FIELDS) {
    if (ALIASES[field].includes(key)) return field;
  }
  return null;
}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
  /** every sheet in the workbook, so the user can switch (a CSV has one) */
  sheetNames: string[];
  sheetName: string;
}

function sheetRowCount(sheet: XLSX.WorkSheet): number {
  return sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).e.r : 0;
}

/**
 * Picks the sheet to import: the requested one, otherwise the sheet with the
 * most rows — workbooks like the season merge put a small Summary sheet first
 * and the data in "Merged".
 */
export function pickSheet(workbook: XLSX.WorkBook, requested?: string): string {
  if (requested && workbook.Sheets[requested]) return requested;
  let best = workbook.SheetNames[0] ?? "";
  let bestRows = -1;
  for (const name of workbook.SheetNames) {
    const rows = sheetRowCount(workbook.Sheets[name]);
    if (rows > bestRows) {
      best = name;
      bestRows = rows;
    }
  }
  return best;
}

/** Reads one sheet of an .xlsx/.xls/.csv file into string rows. */
export async function parseSpreadsheet(file: File, sheetName?: string): Promise<ParsedSheet> {
  // CSV must be decoded as UTF-8 text (Hebrew!) — SheetJS would treat raw
  // bytes as Latin-1. Binary formats (.xlsx/.xls) are read as an array.
  const isCsv = /\.(csv|txt)$/i.test(file.name) || file.type === "text/csv";
  const workbook = isCsv
    ? XLSX.read((await file.text()).replace(/^﻿/, ""), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const chosen = pickSheet(workbook, sheetName);
  const sheet = workbook.Sheets[chosen];
  if (!sheet) return { headers: [], rows: [], sheetNames: workbook.SheetNames, sheetName: chosen };
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headerRow = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0] ?? [];
  const headers = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);
  const rows = raw.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? "").trim()]),
    ),
  );
  return {
    headers: headers.length ? headers : Object.keys(rows[0] ?? {}),
    rows,
    sheetNames: workbook.SheetNames,
    sheetName: chosen,
  };
}

/** Downloads rows as .xlsx or as UTF-8 CSV with BOM (so Excel shows Hebrew). */
export function exportRows(
  rows: Record<string, unknown>[],
  format: "csv" | "xlsx",
  filename: string,
) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Fans");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return;
  }
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
