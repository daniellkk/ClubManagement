/**
 * Shared loader for a season's two ticketing exports:
 *   "season details"  — one row per customer
 *   "season per seat" — one row per seat
 * Used by merge-season.cjs (one season) and merge-seasons.cjs (all seasons).
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

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

// ── Column maps ──────────────────────────────────────────────────────────────
function detailColumns(headers) {
  return {
    key: findCol(headers, "Cust. no.", "Customer", "Customer no.", "Cust no"),
    name: findCol(headers, "Name"),
    email: findCol(headers, "Email address 1", "Email"),
    areaPhone: findCol(headers, "Area code (1st phone no.)"),
    phone: findCol(headers, "Direct line (1st phone no.)"),
    areaMobile: findCol(headers, "Area code (cell 1)"),
    mobile: findCol(headers, "Mobile 1 direct dial"),
    town: findCol(headers, "Town"),
    street: findCol(headers, "Street"),
    house: findCol(headers, "House no."),
    postcode: findCol(headers, "Post.cd.", "Postal code"),
    birthday: findCol(headers, "Birthday"),
    seasonTickets: findCol(headers, "Number of season tickets"),
    seasonTicketSales: findCol(headers, "Sales volume - season tickets"),
    lastSeasonTicket: findCol(headers, "Last Sea.Tic. purchase"),
    tickets: findCol(headers, "No. of tickets"),
    lastTicket: findCol(headers, "Last ticket sale"),
    totalSales: findCol(headers, "Total sales"),
  };
}
function seatColumns(headers) {
  return {
    key: findCol(headers, "Customer", "Cust. no.", "Customer no."),
    name: findCol(headers, "Name"),
    season: findCol(headers, "Season"),
    series: findCol(headers, "Series"),
    status: findCol(headers, "Seat status"),
    blockName: findCol(headers, "Block name"),
    blockCode: findCol(headers, "Block code"),
    row: findCol(headers, "Row"),
    seat: findCol(headers, "Seat"),
    price: findCol(headers, "Price"),
    currency: findCol(headers, "Currency"),
    order: findCol(headers, "Order"),
    invoice: findCol(headers, "Invoice"),
    lastName: findCol(headers, "Surname or company 1"),
    firstName: findCol(headers, "First name or company 2"),
    email: findCol(headers, "Email address 1", "Email"),
    areaPhone: findCol(headers, "Area code (1st phone no.)"),
    phone: findCol(headers, "Direct line (1st phone no.)"),
    payType: findCol(headers, "Pay. type", "Payment type"),
    years: findCol(headers, "Number of years"),
    town: findCol(headers, "Town (street address)", "Town"),
  };
}

// ── Load one season ──────────────────────────────────────────────────────────
/**
 * Returns everything the reports need for one season:
 *   customers: Map<key, { key, source, identity, seatCols, detailsRow, seatRows }>
 *   delta:     rows for customers present in only one file
 *   stats:     counts for the summary
 */
function loadSeason({ detailsPath, seatsPath, label }) {
  const details = readSheet(detailsPath);
  const seats = readSheet(seatsPath);
  const D = detailColumns(details.headers);
  const S = seatColumns(seats.headers);
  if (!D.key) throw new Error(`${path.basename(detailsPath)}: customer number column not found. Headers: ${details.headers.join(" | ")}`);
  if (!S.key) throw new Error(`${path.basename(seatsPath)}: customer column not found. Headers: ${seats.headers.join(" | ")}`);

  const detailsByKey = new Map();
  let detailsDuplicates = 0;
  for (const row of details.rows) {
    const k = keyOf(row[D.key]);
    if (!k) continue;
    if (detailsByKey.has(k)) detailsDuplicates += 1;
    detailsByKey.set(k, row);
  }
  const seatsByKey = new Map();
  for (const row of seats.rows) {
    const k = keyOf(row[S.key]);
    if (!k) continue;
    if (!seatsByKey.has(k)) seatsByKey.set(k, []);
    seatsByKey.get(k).push(row);
  }

  // Season label: explicit, else the most common "Season" value in the seat file, else the file name
  const seasonLabel =
    label || tally(seats.rows.map((r) => get(r, S.season)))[0]?.[0] || path.basename(seatsPath, path.extname(seatsPath));

  const seatLabel = (r) => {
    const block = get(r, S.blockCode) || get(r, S.blockName);
    return [block, get(r, S.row) && `row ${get(r, S.row)}`, get(r, S.seat) && `seat ${get(r, S.seat)}`].filter(Boolean).join(" · ");
  };

  const likelyReason = (source, d) => {
    if (source === "seats only") return "seat holder missing from the season-details export";
    const seasonTickets = num(get(d, D.seasonTickets));
    const tickets = num(get(d, D.tickets));
    if (seasonTickets > 0) return "season ticket without a seat → check cancellation / refund / transfer / seatless product";
    if (tickets > 0) return "single-match tickets only (not a subscriber)";
    return "no ticket purchases in the file";
  };

  const allKeys = uniq([...detailsByKey.keys(), ...seatsByKey.keys()]).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  const customers = new Map();
  const delta = [];
  let matched = 0;
  for (const k of allKeys) {
    const d = detailsByKey.get(k);
    const srows = seatsByKey.get(k) || [];
    const s0 = srows[0];
    const source = d && srows.length ? "both" : d ? "season details only" : "seats only";
    if (source === "both") matched += 1;

    const nameFromDetails = splitName(get(d, D.name));
    const identity = {
      firstName: get(s0, S.firstName) || nameFromDetails.firstName,
      lastName: get(s0, S.lastName) || nameFromDetails.lastName,
      email: get(d, D.email) || get(s0, S.email),
      mobile: phone(get(d, D.areaMobile), get(d, D.mobile)),
      phone: phone(get(d, D.areaPhone), get(d, D.phone)) || phone(get(s0, S.areaPhone), get(s0, S.phone)),
      town: get(d, D.town) || get(s0, S.town),
      street: get(d, D.street),
      house: get(d, D.house),
      postcode: get(d, D.postcode),
      birthday: get(d, D.birthday),
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

    const detailStats = {
      "Number of season tickets": get(d, D.seasonTickets),
      "Sales volume - season tickets": get(d, D.seasonTicketSales),
      "Last Sea.Tic. purchase": get(d, D.lastSeasonTicket),
      "No. of tickets": get(d, D.tickets),
      "Last ticket sale": get(d, D.lastTicket),
      "Total sales": get(d, D.totalSales),
    };

    customers.set(k, { key: k, source, identity, seatCols, detailStats, detailsRow: d, seatRows: srows });

    if (source !== "both") {
      delta.push({
        Season: seasonLabel,
        "Customer no.": k,
        "Missing from": source === "season details only" ? "season per seat" : "season details",
        "Likely reason": likelyReason(source, d),
        "First name": identity.firstName,
        "Last name": identity.lastName,
        Email: identity.email,
        Mobile: identity.mobile || identity.phone,
        Town: identity.town,
        ...detailStats,
        "Seats (seat file)": seatCols.Seats,
      });
    }
  }

  const onlyDetails = delta.filter((r) => r["Missing from"] === "season per seat");
  const stats = {
    detailsRows: details.rows.length,
    detailsCustomers: detailsByKey.size,
    detailsDuplicates,
    seatRows: seats.rows.length,
    subscribers: seatsByKey.size,
    matched,
    onlyDetails: onlyDetails.length,
    onlySeats: delta.length - onlyDetails.length,
    unique: allKeys.length,
    reasons: tally(onlyDetails.map((r) => r["Likely reason"])),
    revenue: seats.rows.reduce((sum, r) => sum + num(get(r, S.price)), 0),
    paidSeats: seats.rows.filter((r) => num(get(r, S.price)) > 0).length,
  };

  return { label: seasonLabel, detailsPath, seatsPath, details, seats, D, S, detailsByKey, seatsByKey, customers, delta, stats, seatLabel };
}

// ── Load one season from a per-season merged workbook ────────────────────────
/**
 * Same shape as loadSeason(), but sourced from the workbook that
 * merge-season.cjs produced (sheets "Merged" + "Delta"), so the all-seasons
 * report can be built from 3 merged files instead of 6 raw exports.
 */
function loadMergedSeason({ mergedPath, label }) {
  const wb = XLSX.readFile(mergedPath);
  const mergedWs = wb.Sheets.Merged;
  if (!mergedWs) throw new Error(`${path.basename(mergedPath)}: no "Merged" sheet — is this a file produced by merge-season.cjs?`);
  const rows = XLSX.utils.sheet_to_json(mergedWs, { defval: "", raw: false }).map(cleanRow);
  const deltaRows = wb.Sheets.Delta
    ? XLSX.utils.sheet_to_json(wb.Sheets.Delta, { defval: "", raw: false }).map(cleanRow)
    : [];

  const DETAILS_PREFIX = "details: ";
  const detailHeaders = Object.keys(rows[0] ?? {})
    .filter((h) => h.startsWith(DETAILS_PREFIX))
    .map((h) => h.slice(DETAILS_PREFIX.length));

  const seasonLabel =
    label ||
    tally(rows.map((r) => r.Season)).find(([v]) => v !== "(blank)")?.[0] ||
    path.basename(mergedPath, path.extname(mergedPath));

  const customers = new Map();
  const detailsByKey = new Map();
  const seatsByKey = new Map();
  let matched = 0;
  let seatRows = 0;
  let revenue = 0;
  for (const r of rows) {
    const k = keyOf(r["Customer no."]);
    if (!k) continue;
    const source = r.Source || "both";
    const seatsCount = num(r["Seats count"]);
    const price = num(r["Seats total price"]);
    const detailsRow =
      source !== "seats only"
        ? Object.fromEntries(detailHeaders.map((h) => [h, r[DETAILS_PREFIX + h] ?? ""]))
        : undefined;
    if (detailsRow) detailsByKey.set(k, detailsRow);
    if (seatsCount > 0) seatsByKey.set(k, Array(seatsCount).fill(null));
    if (source === "both") matched += 1;
    seatRows += seatsCount;
    revenue += price;

    customers.set(k, {
      key: k,
      source,
      identity: {
        firstName: r["First name"] ?? "",
        lastName: r["Last name"] ?? "",
        email: r.Email ?? "",
        mobile: r.Mobile ?? "",
        phone: r.Phone ?? "",
        town: r.Town ?? "",
        street: r.Street ?? "",
        house: r["House no."] ?? "",
        postcode: r["Postal code"] ?? "",
        birthday: r.Birthday ?? "",
      },
      seatCols: {
        Season: r.Season ?? "",
        Series: r.Series ?? "",
        "Seats count": seatsCount,
        Seats: r.Seats ?? "",
        Blocks: r.Blocks ?? "",
        "Seat status": r["Seat status"] ?? "",
        "Seats total price": price,
        Currency: r.Currency ?? "",
        Orders: r.Orders ?? "",
        Invoices: r.Invoices ?? "",
        "Pay. type": r["Pay. type"] ?? "",
        "Number of years": r["Number of years"] ?? "",
        "Name (seats file)": r["Name (seats file)"] ?? "",
      },
      detailStats: {
        "Number of season tickets": r[`${DETAILS_PREFIX}Number of season tickets`] ?? "",
        "Sales volume - season tickets": r[`${DETAILS_PREFIX}Sales volume - season tickets`] ?? "",
        "Last Sea.Tic. purchase": r[`${DETAILS_PREFIX}Last Sea.Tic. purchase`] ?? "",
        "No. of tickets": r[`${DETAILS_PREFIX}No. of tickets`] ?? "",
        "Last ticket sale": r[`${DETAILS_PREFIX}Last ticket sale`] ?? "",
        "Total sales": r[`${DETAILS_PREFIX}Total sales`] ?? "",
      },
      detailsRow,
      seatRows: [],
    });
  }

  const delta = deltaRows.map((r) => ({ Season: seasonLabel, ...r, Season: seasonLabel }));
  const onlyDetails = delta.filter((r) => r["Missing from"] === "season per seat");
  const stats = {
    detailsRows: detailsByKey.size,
    detailsCustomers: detailsByKey.size,
    detailsDuplicates: 0,
    seatRows,
    subscribers: seatsByKey.size,
    matched,
    onlyDetails: onlyDetails.length,
    onlySeats: delta.length - onlyDetails.length,
    unique: customers.size,
    reasons: tally(onlyDetails.map((r) => r["Likely reason"])),
    revenue,
    paidSeats: rows.filter((r) => num(r["Seats total price"]) > 0).length,
  };

  return {
    label: seasonLabel,
    detailsPath: mergedPath,
    seatsPath: mergedPath,
    details: { headers: detailHeaders, rows: [] },
    seats: { headers: [], rows: [] },
    detailsByKey,
    seatsByKey,
    customers,
    delta,
    stats,
  };
}

// ── Workbook helpers ─────────────────────────────────────────────────────────
function sheetFrom(rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "(empty)": "" }]);
  if (rows.length) {
    ws["!cols"] = Object.keys(rows[0]).map((h) => ({ wch: Math.min(48, Math.max(10, h.length + 2, widths?.[h] ?? 0)) }));
    ws["!autofilter"] = { ref: ws["!ref"] };
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  }
  return ws;
}

module.exports = { XLSX, readSheet, findCol, get, keyOf, splitName, phone, num, uniq, pct, tally, loadSeason, loadMergedSeason, sheetFrom };
