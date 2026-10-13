#!/usr/bin/env node
/**
 * merge-season — joins the two ticketing exports of a season into one workbook.
 *
 *   node scripts/merge-season.cjs --details "season details.xlsx" --seats "season per seat.xlsx" --out merged.xlsx
 *
 * Inputs may be .xlsx / .xls / .csv (CSV is read as UTF-8, Hebrew-safe).
 * Output workbook sheets:
 *   Summary — the essential counts (customers, delta + reasons, seats, revenue, contact coverage)
 *   Merged  — one row per customer: clean columns + seat data aggregated + every "season details" column
 *   Delta   — customers present in only one of the two files, with a likely reason
 *
 * A second file "<out>-columns.xlsx" documents where every Merged column comes from.
 *
 * Optional flags:
 *   --breakdowns   add a "Breakdowns" sheet (seat status, series, pay type, years, blocks, towns, …)
 *   --per-seat     add a "Seats" sheet with one row per seat joined to the customer
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
}
const detailsPath = flag("details");
const seatsPath = flag("seats");
const outPath = flag("out", "merged-season.xlsx");
const perSeat = args.includes("--per-seat");
const withBreakdowns = args.includes("--breakdowns");
if (!detailsPath || !seatsPath) {
  console.error('Usage: node scripts/merge-season.cjs --details "<season details file>" --seats "<season per seat file>" [--out merged.xlsx] [--breakdowns] [--per-seat]');
  process.exit(1);
}

// ── Reading ──────────────────────────────────────────────────────────────────
function readSheet(file) {
  const isCsv = /\.(csv|txt)$/i.test(file);
  const wb = isCsv
    ? XLSX.read(fs.readFileSync(file, "utf8").replace(/^﻿/, ""), { type: "string" })
    : XLSX.read(fs.readFileSync(file), { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || []).map((h) => String(h ?? "").trim());
  return { headers, rows: rows.map(cleanRow) };
}
function cleanRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k.trim()] = typeof v === "string" ? v.trim() : v;
  return out;
}

// Header lookup that tolerates spacing / case / punctuation differences
const norm = (s) => String(s ?? "").toLowerCase().replace(/[\s.,()_-]/g, "");
function findCol(headers, ...candidates) {
  for (const c of candidates) {
    const hit = headers.find((h) => norm(h) === norm(c));
    if (hit) return hit;
  }
  return null;
}
const get = (row, col) => (row && col ? String(row[col] ?? "").trim() : "");

// ── Normalizers ──────────────────────────────────────────────────────────────
/** Customer numbers as strings without leading zeros so "000423" and "423" match */
const keyOf = (v) => String(v ?? "").trim().replace(/^0+(?=\d)/, "");

/** "Surname, First name" → { lastName, firstName }; strips stray dots/commas */
function splitName(name) {
  const cleaned = String(name ?? "").replace(/^[\s.,]+|[\s.,]+$/g, "");
  if (!cleaned) return { firstName: "", lastName: "" };
  const i = cleaned.indexOf(",");
  if (i === -1) return { firstName: "", lastName: cleaned };
  return {
    lastName: cleaned.slice(0, i).replace(/^[\s.,]+|[\s.,]+$/g, ""),
    firstName: cleaned.slice(i + 1).replace(/^[\s.,]+|[\s.,]+$/g, ""),
  };
}

/** Israeli phone from area code + direct line, or a bare mobile like 507853622 → 050-7853622 */
function phone(area, direct) {
  const a = String(area ?? "").replace(/\D/g, "");
  const d = String(direct ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (a) {
    const code = a.startsWith("0") ? a : `0${a}`;
    return `${code}-${d}`;
  }
  if (d.length === 9 && d.startsWith("5")) return `0${d.slice(0, 2)}-${d.slice(2)}`;
  if (d.length === 10 && d.startsWith("05")) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 8) return `0${d.slice(0, 1)}-${d.slice(1)}`;
  return d;
}

const num = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "");

/** Counts occurrences of each value; returns [[value, count], …] sorted by count desc */
function tally(values) {
  const m = new Map();
  for (const v of values) {
    const k = v === "" || v === undefined || v === null ? "(blank)" : String(v);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ── Load ─────────────────────────────────────────────────────────────────────
const details = readSheet(detailsPath);
const seats = readSheet(seatsPath);

const D = {
  key: findCol(details.headers, "Cust. no.", "Customer", "Customer no.", "Cust no"),
  name: findCol(details.headers, "Name"),
  email: findCol(details.headers, "Email address 1", "Email"),
  areaPhone: findCol(details.headers, "Area code (1st phone no.)"),
  phone: findCol(details.headers, "Direct line (1st phone no.)"),
  areaMobile: findCol(details.headers, "Area code (cell 1)"),
  mobile: findCol(details.headers, "Mobile 1 direct dial"),
  town: findCol(details.headers, "Town"),
  street: findCol(details.headers, "Street"),
  house: findCol(details.headers, "House no."),
  postcode: findCol(details.headers, "Post.cd.", "Postal code"),
  birthday: findCol(details.headers, "Birthday"),
  seasonTickets: findCol(details.headers, "Number of season tickets"),
  seasonTicketSales: findCol(details.headers, "Sales volume - season tickets"),
  lastSeasonTicket: findCol(details.headers, "Last Sea.Tic. purchase"),
  tickets: findCol(details.headers, "No. of tickets"),
  lastTicket: findCol(details.headers, "Last ticket sale"),
  totalSales: findCol(details.headers, "Total sales"),
};
const S = {
  key: findCol(seats.headers, "Customer", "Cust. no.", "Customer no."),
  name: findCol(seats.headers, "Name"),
  season: findCol(seats.headers, "Season"),
  series: findCol(seats.headers, "Series"),
  status: findCol(seats.headers, "Seat status"),
  blockName: findCol(seats.headers, "Block name"),
  blockCode: findCol(seats.headers, "Block code"),
  row: findCol(seats.headers, "Row"),
  seat: findCol(seats.headers, "Seat"),
  price: findCol(seats.headers, "Price"),
  currency: findCol(seats.headers, "Currency"),
  order: findCol(seats.headers, "Order"),
  invoice: findCol(seats.headers, "Invoice"),
  lastName: findCol(seats.headers, "Surname or company 1"),
  firstName: findCol(seats.headers, "First name or company 2"),
  email: findCol(seats.headers, "Email address 1", "Email"),
  areaPhone: findCol(seats.headers, "Area code (1st phone no.)"),
  phone: findCol(seats.headers, "Direct line (1st phone no.)"),
  payType: findCol(seats.headers, "Pay. type", "Payment type"),
  years: findCol(seats.headers, "Number of years"),
  town: findCol(seats.headers, "Town (street address)", "Town"),
};
if (!D.key) throw new Error(`Season details: customer number column not found. Headers: ${details.headers.join(" | ")}`);
if (!S.key) throw new Error(`Season per seat: customer column not found. Headers: ${seats.headers.join(" | ")}`);

// ── Index ────────────────────────────────────────────────────────────────────
const detailsByKey = new Map();
let detailsDuplicates = 0;
for (const row of details.rows) {
  const k = keyOf(row[D.key]);
  if (!k) continue;
  if (detailsByKey.has(k)) detailsDuplicates += 1;
  detailsByKey.set(k, row); // last row wins if duplicated
}
const seatsByKey = new Map();
for (const row of seats.rows) {
  const k = keyOf(row[S.key]);
  if (!k) continue;
  if (!seatsByKey.has(k)) seatsByKey.set(k, []);
  seatsByKey.get(k).push(row);
}

const seatLabel = (r) => {
  const block = get(r, S.blockCode) || get(r, S.blockName);
  return [block, get(r, S.row) && `row ${get(r, S.row)}`, get(r, S.seat) && `seat ${get(r, S.seat)}`].filter(Boolean).join(" · ");
};

// ── Merge (one row per customer, union of both files) ────────────────────────
const allKeys = uniq([...detailsByKey.keys(), ...seatsByKey.keys()]).sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true }),
);

const merged = [];
const delta = [];
let matched = 0;

function likelyReason(source, d) {
  if (source === "seats only") return "seat holder missing from the season-details export";
  const seasonTickets = num(get(d, D.seasonTickets));
  const tickets = num(get(d, D.tickets));
  if (seasonTickets > 0) return "season ticket without a seat → check cancellation / refund / transfer / seatless product";
  if (tickets > 0) return "single-match tickets only (not a subscriber)";
  return "no ticket purchases in the file";
}

for (const k of allKeys) {
  const d = detailsByKey.get(k);
  const srows = seatsByKey.get(k) || [];
  const s0 = srows[0];
  const source = d && srows.length ? "both" : d ? "season details only" : "seats only";
  if (source === "both") matched += 1;

  const nameFromDetails = splitName(get(d, D.name));
  const firstName = get(s0, S.firstName) || nameFromDetails.firstName;
  const lastName = get(s0, S.lastName) || nameFromDetails.lastName;
  const email = get(d, D.email) || get(s0, S.email);
  const mobile = phone(get(d, D.areaMobile), get(d, D.mobile));
  const landline = phone(get(d, D.areaPhone), get(d, D.phone)) || phone(get(s0, S.areaPhone), get(s0, S.phone));

  const base = {
    "Customer no.": k,
    "First name": firstName,
    "Last name": lastName,
    Email: email,
    Mobile: mobile,
    Phone: landline,
    Town: get(d, D.town) || get(s0, S.town),
    Street: get(d, D.street),
    "House no.": get(d, D.house),
    "Postal code": get(d, D.postcode),
    Birthday: get(d, D.birthday),
    Source: source,
  };

  const seatCols = {
    Season: uniq(srows.map((r) => get(r, S.season))).join("; "),
    Series: uniq(srows.map((r) => get(r, S.series))).join("; "),
    "Seats count": srows.length,
    Seats: srows.map(seatLabel).join("; "),
    Blocks: uniq(srows.map((r) => get(r, S.blockName))).join("; "),
    "Seat status": uniq(srows.map((r) => get(r, S.status))).join("; "),
    "Seats total price": srows.reduce((sum, r) => sum + num(get(r, S.price)), 0),
    Currency: uniq(srows.map((r) => get(r, S.currency))).join("; "),
    Orders: uniq(srows.map((r) => get(r, S.order))).join("; "),
    Invoices: uniq(srows.map((r) => get(r, S.invoice))).join("; "),
    "Pay. type": uniq(srows.map((r) => get(r, S.payType))).join("; "),
    "Number of years": uniq(srows.map((r) => get(r, S.years))).join("; "),
    "Name (seats file)": get(s0, S.name),
  };

  // Every original "season details" column follows, prefixed to avoid clashes
  const detailCols = {};
  for (const h of details.headers) {
    if (!h) continue;
    detailCols[`details: ${h}`] = d ? d[h] ?? "" : "";
  }

  merged.push({ ...base, ...seatCols, ...detailCols, _srows: srows, _d: d });

  if (source !== "both") {
    delta.push({
      "Customer no.": k,
      "Missing from": source === "season details only" ? "season per seat" : "season details",
      "Likely reason": likelyReason(source, d),
      "First name": firstName,
      "Last name": lastName,
      Email: email,
      Mobile: mobile || landline,
      Town: base.Town,
      "Number of season tickets": get(d, D.seasonTickets),
      "Sales volume - season tickets": get(d, D.seasonTicketSales),
      "Last Sea.Tic. purchase": get(d, D.lastSeasonTicket),
      "No. of tickets": get(d, D.tickets),
      "Last ticket sale": get(d, D.lastTicket),
      "Total sales": get(d, D.totalSales),
      "Seats (seat file)": seatCols.Seats,
      Season: seatCols.Season,
    });
  }
}

// ── Optional per-seat sheet ──────────────────────────────────────────────────
let perSeatRows = [];
if (perSeat) {
  perSeatRows = seats.rows.map((r) => {
    const k = keyOf(r[S.key]);
    const d = detailsByKey.get(k);
    return {
      "Customer no.": k,
      "In season details": d ? "yes" : "no",
      Seat: seatLabel(r),
      ...r,
      ...(d ? Object.fromEntries(Object.entries(d).map(([h, v]) => [`details: ${h}`, v])) : {}),
    };
  });
}

// ── Summary ──────────────────────────────────────────────────────────────────
const subscribers = merged.filter((m) => m["Seats count"] > 0);
const onlyDetails = delta.filter((r) => r["Missing from"] === "season per seat");
const onlySeats = delta.length - onlyDetails.length;
const reasonTally = tally(onlyDetails.map((r) => r["Likely reason"]));

const seatsPerCustomer = tally(subscribers.map((m) => (m["Seats count"] >= 4 ? "4+" : String(m["Seats count"]))));
const seatPrices = seats.rows.map((r) => num(get(r, S.price)));
const revenue = seatPrices.reduce((a, b) => a + b, 0);
const paidSeats = seatPrices.filter((p) => p > 0);
const yearsBucket = (y) => {
  const n = num(y);
  if (!y || Number.isNaN(n)) return "(blank)";
  if (n <= 1) return "1 (new)";
  if (n === 2) return "2";
  if (n <= 4) return "3–4";
  if (n <= 9) return "5–9";
  return "10+";
};

const withEmail = merged.filter((m) => m.Email).length;
const withMobile = merged.filter((m) => m.Mobile).length;
const withAnyPhone = merged.filter((m) => m.Mobile || m.Phone).length;
const noContact = merged.filter((m) => !m.Email && !m.Mobile && !m.Phone).length;
const withBirthday = merged.filter((m) => m.Birthday).length;
const withTown = merged.filter((m) => m.Town).length;

const multiSeat = subscribers.filter((m) => m["Seats count"] > 1).length;

// Compact summary: one line per essential fact
const summary = [];
const add = (metric, value, share = "") => summary.push({ Metric: metric, Value: value, Share: share });
add("Season details file", path.basename(detailsPath));
add("Season per seat file", path.basename(seatsPath));
add("Customers in season details", detailsByKey.size);
if (detailsDuplicates) add("Duplicate customer rows in season details", detailsDuplicates);
add("Subscribers (customers with seats)", seatsByKey.size, pct(seatsByKey.size, allKeys.length));
add("Seat rows", seats.rows.length);
add("Customers in both files", matched, pct(matched, allKeys.length));
add("In season details only (no seat)", onlyDetails.length, pct(onlyDetails.length, allKeys.length));
for (const [reason, count] of reasonTally) add(`   ↳ ${reason}`, count, pct(count, onlyDetails.length));
add("In seats only (missing from details)", onlySeats, pct(onlySeats, allKeys.length));
add("Total unique customers", allKeys.length);
add("Average seats per subscriber", seatsByKey.size ? (seats.rows.length / seatsByKey.size).toFixed(2) : "");
add("Subscribers with more than one seat", multiSeat, pct(multiSeat, subscribers.length));
add("Season-ticket revenue (sum of seat prices)", revenue);
add("Average price per paid seat", paidSeats.length ? Math.round(revenue / paidSeats.length) : "");
add("Customers with email", withEmail, pct(withEmail, allKeys.length));
add("Customers with mobile", withMobile, pct(withMobile, allKeys.length));
add("Unreachable (no email, no phone)", noContact, pct(noContact, allKeys.length));

// Detailed breakdowns live on their own sheet, only when asked for
const breakdowns = [];
const breakdown = (name, pairs, whole, limit) => {
  for (const [value, count] of pairs.slice(0, limit ?? pairs.length)) {
    breakdowns.push({ Breakdown: name, Value: value, Count: count, Share: pct(count, whole) });
  }
  if (limit && pairs.length > limit) breakdowns.push({ Breakdown: name, Value: `… ${pairs.length - limit} more`, Count: "", Share: "" });
};
if (withBreakdowns) {
  breakdown("Seats per subscriber", seatsPerCustomer.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })), subscribers.length);
  breakdown("Seat status", tally(seats.rows.map((r) => get(r, S.status))), seats.rows.length);
  breakdown("Series", tally(seats.rows.map((r) => get(r, S.series))), seats.rows.length);
  breakdown("Season", tally(seats.rows.map((r) => get(r, S.season))), seats.rows.length);
  breakdown("Pay. type", tally(seats.rows.map((r) => get(r, S.payType))), seats.rows.length);
  breakdown("Number of years (loyalty)", tally(seats.rows.map((r) => yearsBucket(get(r, S.years)))).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })), seats.rows.length);
  breakdown("Blocks", tally(seats.rows.map((r) => get(r, S.blockName) || get(r, S.blockCode))), seats.rows.length, 20);
  breakdown("Seat price", [["Seats with a price > 0", paidSeats.length], ["Highest seat price", paidSeats.length ? Math.max(...paidSeats) : 0], ["Lowest paid seat price", paidSeats.length ? Math.min(...paidSeats) : 0]], 0);
  breakdown("Contact coverage", [["With any phone (mobile or landline)", withAnyPhone], ["With email AND mobile", merged.filter((m) => m.Email && m.Mobile).length], ["With birthday", withBirthday], ["With town", withTown]], allKeys.length);
  breakdown("Towns", tally(merged.map((m) => m.Town)), allKeys.length, 20);
}

// ── Columns sheet (provenance of every Merged column) ────────────────────────
const columnDocs = [
  ["Customer no.", `details "${D.key}" / seats "${S.key}"`, "Trimmed; leading zeros removed so both files match. Original kept in 'details: Cust. no.'"],
  ["First name", `seats "${S.firstName}"`, `Fallback: text after the comma in details "${D.name}" ("Surname, First")`],
  ["Last name", `seats "${S.lastName}"`, `Fallback: text before the comma in details "${D.name}"; stray dots/commas removed`],
  ["Email", `details "${D.email}"`, `Fallback: seats "${S.email}"`],
  ["Mobile", `details "${D.areaMobile}" + "${D.mobile}"`, "Digits only, formatted 05X-XXXXXXX (a leading 0 is added when missing)"],
  ["Phone", `details "${D.areaPhone}" + "${D.phone}"`, `Fallback: seats "${S.areaPhone}" + "${S.phone}"; formatted 0X-XXXXXXX`],
  ["Town", `details "${D.town}"`, `Fallback: seats "${S.town}"`],
  ["Street", `details "${D.street}"`, "As is"],
  ["House no.", `details "${D.house}"`, "As is"],
  ["Postal code", `details "${D.postcode}"`, "As is"],
  ["Birthday", `details "${D.birthday}"`, "As is"],
  ["Source", "computed", "both / season details only / seats only"],
  ["Season", `seats "${S.season}"`, "Distinct values of the customer's seat rows, joined with ;"],
  ["Series", `seats "${S.series}"`, "Distinct values, joined with ;"],
  ["Seats count", "computed", "Number of seat rows for the customer"],
  ["Seats", `seats "${S.blockCode}" (or "${S.blockName}") + "${S.row}" + "${S.seat}"`, "One entry per seat row: 'G10 · row 18 · seat 1', joined with ;"],
  ["Blocks", `seats "${S.blockName}"`, "Distinct values, joined with ;"],
  ["Seat status", `seats "${S.status}"`, "Distinct values, joined with ;"],
  ["Seats total price", `seats "${S.price}"`, "Sum over the customer's seat rows"],
  ["Currency", `seats "${S.currency}"`, "Distinct values"],
  ["Orders", `seats "${S.order}"`, "Distinct values, joined with ;"],
  ["Invoices", `seats "${S.invoice}"`, "Distinct values, joined with ;"],
  ["Pay. type", `seats "${S.payType}"`, "Distinct values, joined with ;"],
  ["Number of years", `seats "${S.years}"`, "Distinct values, joined with ;"],
  ["Name (seats file)", `seats "${S.name}"`, "As is, from the first seat row"],
  ["details: <column>", "season details", "Every original column of the season-details file, untouched, prefixed with 'details: '"],
].map(([col, source, how]) => ({ "Merged column": col, "Comes from": source, "How it is built": how }));

// ── Write ────────────────────────────────────────────────────────────────────
function sheetFrom(rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (rows.length) {
    ws["!cols"] = Object.keys(rows[0]).map((h) => ({ wch: Math.min(48, Math.max(10, h.length + 2, widths?.[h] ?? 0)) }));
    ws["!autofilter"] = { ref: ws["!ref"] };
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  }
  return ws;
}
const mergedOut = merged.map(({ _srows, _d, ...row }) => row);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheetFrom(summary, { Metric: 52, Value: 22 }), "Summary");
XLSX.utils.book_append_sheet(wb, sheetFrom(mergedOut, { Seats: 40, Email: 28 }), "Merged");
XLSX.utils.book_append_sheet(wb, sheetFrom(delta, { Email: 28, "Seats (seat file)": 40, "Likely reason": 48 }), "Delta");
if (withBreakdowns) XLSX.utils.book_append_sheet(wb, sheetFrom(breakdowns, { Breakdown: 26, Value: 36 }), "Breakdowns");
if (perSeat) XLSX.utils.book_append_sheet(wb, sheetFrom(perSeatRows), "Seats");
wb.Workbook = { Views: [{ RTL: true }] };
XLSX.writeFile(wb, outPath);

// Column documentation goes to its own file (for the developer, not the club)
const columnsPath = outPath.replace(/(\.xlsx?)$/i, "") + "-columns.xlsx";
const cwb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(cwb, sheetFrom(columnDocs, { "Merged column": 22, "Comes from": 48, "How it is built": 48 }), "Columns");
XLSX.writeFile(cwb, columnsPath);

console.log(`✔ wrote ${outPath}`);
console.log(`✔ wrote ${columnsPath} (column documentation)`);
for (const s of summary) console.log(`  ${s.Metric}: ${s.Value}${s.Share ? ` (${s.Share})` : ""}`);
