#!/usr/bin/env node
/**
 * merge-seasons — merges ALL seasons into one workbook with the cross-season picture.
 *
 * Simplest: feed it the per-season workbooks produced by merge-season.cjs
 * (oldest season first):
 *
 *   node scripts/merge-seasons.cjs --merged "merged 2024-25.xlsx" --merged "merged 2025-26.xlsx" --merged "merged 2026-27.xlsx" --out all-seasons.xlsx
 *
 * Or from the raw exports (details + per-seat file per season):
 *
 *   node scripts/merge-seasons.cjs \
 *     --season "2024/25" --details "2024.25-Details.xlsx" --seats "2024.25-per seats.xlsx" \
 *     --season "2025/26" --details "2025.26-Details.xlsx" --seats "2025.26-per seats.xlsx" \
 *     --season "2026/27" --details "2026.27-Details.xlsx" --seats "2026.27-per seats.xlsx" \
 *     --out "all-seasons.xlsx"
 *
 * --season labels are optional: without them the label is read from the "Season"
 * column of the seat file / Merged sheet.
 *
 * Output workbook sheets:
 *   Summary — per-season counts + season-to-season retention (retained / churned / new / returned)
 *   Merged  — one row per customer across all seasons: identity, status, per-season seat data
 *   Delta   — per-season delta (customers present in only one of the season's two files)
 *   Changes — every churned / new / returned customer between consecutive seasons, with contact details
 *
 * A second file "<out>-columns.xlsx" documents the Merged columns.
 *
 * Optional flags:
 *   --all-columns   also add every original "season details" column, per season, to Merged
 */
const path = require("path");
const { XLSX, loadSeason, loadMergedSeason, pct, sheetFrom, uniq } = require("./lib/season.cjs");

// ── CLI: repeated --merged, or --season/--details/--seats groups ─────────────
const args = process.argv.slice(2);
const groups = [];
let outPath = "all-seasons.xlsx";
let allColumns = false;
const openGroup = (field) => {
  if (!groups.length || groups[groups.length - 1][field]) groups.push({});
  return groups[groups.length - 1];
};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => args[++i];
  if (a === "--season") groups.push({ label: next() });
  else if (a === "--merged") openGroup("mergedPath").mergedPath = next();
  else if (a === "--details") openGroup("detailsPath").detailsPath = next();
  else if (a === "--seats") openGroup("seatsPath").seatsPath = next();
  else if (a === "--out") outPath = next();
  else if (a === "--all-columns") allColumns = true;
}
const valid = groups.filter((g) => g.mergedPath || (g.detailsPath && g.seatsPath));
if (valid.length < 2) {
  console.error('Usage: node scripts/merge-seasons.cjs --merged <merged season 1.xlsx> --merged <merged season 2.xlsx> [--merged …] --out all-seasons.xlsx');
  console.error('   or: node scripts/merge-seasons.cjs [--season "2024/25"] --details <file> --seats <file> [--season …] … --out all-seasons.xlsx [--all-columns]');
  console.error("Need at least two seasons, oldest first.");
  process.exit(1);
}

// ── Load every season ────────────────────────────────────────────────────────
const seasons = valid.map((g) => (g.mergedPath ? loadMergedSeason(g) : loadSeason(g)));
const labels = seasons.map((s) => s.label);
const latest = seasons[seasons.length - 1];
console.log(`Seasons: ${labels.join(" → ")}`);

const hasSeat = (season, key) => (season.customers.get(key)?.seatCols["Seats count"] ?? 0) > 0;

// ── Per-customer history across seasons ──────────────────────────────────────
const allKeys = uniq(seasons.flatMap((s) => [...s.customers.keys()])).sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true }),
);

/** Best identity: latest season where the field is present */
function bestIdentity(key) {
  const out = { firstName: "", lastName: "", email: "", mobile: "", phone: "", town: "", street: "", house: "", postcode: "", birthday: "" };
  for (const season of [...seasons].reverse()) {
    const c = season.customers.get(key);
    if (!c) continue;
    for (const f of Object.keys(out)) if (!out[f] && c.identity[f]) out[f] = c.identity[f];
  }
  return out;
}

function statusOf(key) {
  const seatSeasons = seasons.filter((s) => hasSeat(s, key)).map((s) => s.label);
  const inLatest = hasSeat(latest, key);
  if (seatSeasons.length === 0) return "never subscribed";
  if (seatSeasons.length === seasons.length) return "subscriber every season";
  if (inLatest) {
    const prev = seasons[seasons.length - 2];
    if (hasSeat(prev, key)) return "active subscriber";
    return seatSeasons.length === 1 ? `new in ${latest.label}` : `returned in ${latest.label}`;
  }
  return `churned after ${seatSeasons[seatSeasons.length - 1]}`;
}

const merged = allKeys.map((key) => {
  const id = bestIdentity(key);
  const seatSeasons = seasons.filter((s) => hasSeat(s, key)).map((s) => s.label);
  const row = {
    "Customer no.": key,
    "First name": id.firstName,
    "Last name": id.lastName,
    Email: id.email,
    Mobile: id.mobile,
    Phone: id.phone,
    Town: id.town,
    Street: id.street,
    "House no.": id.house,
    "Postal code": id.postcode,
    Birthday: id.birthday,
    Status: statusOf(key),
    "Seasons with seat": seatSeasons.length,
    "Seat seasons": seatSeasons.join("; "),
    "Seats total (all seasons)": seasons.reduce((sum, s) => sum + (s.customers.get(key)?.seatCols["Seats count"] ?? 0), 0),
    "Revenue total (all seasons)": seasons.reduce((sum, s) => sum + (s.customers.get(key)?.seatCols["Seats total price"] ?? 0), 0),
  };
  for (const season of seasons) {
    const c = season.customers.get(key);
    const p = `${season.label} · `;
    row[`${p}Source`] = c ? c.source : "not in season";
    row[`${p}Seats count`] = c ? c.seatCols["Seats count"] : "";
    row[`${p}Seats`] = c ? c.seatCols.Seats : "";
    row[`${p}Blocks`] = c ? c.seatCols.Blocks : "";
    row[`${p}Seat status`] = c ? c.seatCols["Seat status"] : "";
    row[`${p}Seats total price`] = c ? c.seatCols["Seats total price"] : "";
    row[`${p}Pay. type`] = c ? c.seatCols["Pay. type"] : "";
    row[`${p}Number of years`] = c ? c.seatCols["Number of years"] : "";
    row[`${p}Season tickets (details)`] = c ? c.detailStats["Number of season tickets"] : "";
    row[`${p}No. of tickets (details)`] = c ? c.detailStats["No. of tickets"] : "";
    row[`${p}Total sales (details)`] = c ? c.detailStats["Total sales"] : "";
    if (allColumns) {
      for (const h of season.details.headers) {
        if (h) row[`${p}details: ${h}`] = c?.detailsRow ? c.detailsRow[h] ?? "" : "";
      }
    }
  }
  return row;
});

// ── Season-to-season changes ─────────────────────────────────────────────────
const changes = [];
const transitions = [];
for (let i = 1; i < seasons.length; i++) {
  const from = seasons[i - 1];
  const to = seasons[i];
  const earlier = seasons.slice(0, i - 1);
  const fromSubs = [...from.seatsByKey.keys()];
  const toSubs = [...to.seatsByKey.keys()];
  const retained = fromSubs.filter((k) => hasSeat(to, k));
  const churned = fromSubs.filter((k) => !hasSeat(to, k));
  const arrived = toSubs.filter((k) => !hasSeat(from, k));
  const returned = arrived.filter((k) => earlier.some((s) => hasSeat(s, k)));
  const brandNew = arrived.filter((k) => !earlier.some((s) => hasSeat(s, k)));
  transitions.push({ from: from.label, to: to.label, fromSubs: fromSubs.length, toSubs: toSubs.length, retained: retained.length, churned: churned.length, brandNew: brandNew.length, returned: returned.length });

  const push = (change, keys) => {
    const ordered = [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const key of ordered) {
      const id = bestIdentity(key);
      const a = from.customers.get(key);
      const b = to.customers.get(key);
      changes.push({
        Change: change,
        "From season": from.label,
        "To season": to.label,
        "Customer no.": key,
        "First name": id.firstName,
        "Last name": id.lastName,
        Email: id.email,
        Mobile: id.mobile || id.phone,
        Town: id.town,
        [`Seats in ${from.label}`]: a ? a.seatCols.Seats : "",
        [`Seats in ${to.label}`]: b ? b.seatCols.Seats : "",
        "Number of years": (b ?? a)?.seatCols["Number of years"] ?? "",
        "Last season ticket purchase (details)": (b ?? a)?.detailStats["Last Sea.Tic. purchase"] ?? "",
        [`Still a customer in ${to.label}`]: b ? "yes" : "no",
      });
    }
  };
  push("churned", churned);
  push("new", brandNew);
  push("returned", returned);
}

// ── Summary ──────────────────────────────────────────────────────────────────
const summary = [];
const add = (metric, value, share = "") => summary.push({ Metric: metric, Value: value, Share: share });
const heading = (title) => summary.push({ Metric: `— ${title} —`, Value: "", Share: "" });

heading("All seasons");
add("Seasons", labels.join(" → "));
add("Unique customers across all seasons", allKeys.length);
add("Subscriber in every season", merged.filter((m) => m.Status === "subscriber every season").length, pct(merged.filter((m) => m.Status === "subscriber every season").length, allKeys.length));
add(`Subscribers in ${latest.label}`, latest.stats.subscribers, pct(latest.stats.subscribers, allKeys.length));
add("Never subscribed", merged.filter((m) => m.Status === "never subscribed").length, pct(merged.filter((m) => m.Status === "never subscribed").length, allKeys.length));
add("Revenue total (sum of seat prices, all seasons)", seasons.reduce((sum, s) => sum + s.stats.revenue, 0));

for (const tr of transitions) {
  heading(`${tr.from} → ${tr.to}`);
  add(`Subscribers in ${tr.from}`, tr.fromSubs);
  add(`Subscribers in ${tr.to}`, tr.toSubs);
  add("Retained (seat in both)", tr.retained, pct(tr.retained, tr.fromSubs));
  add(`Churned (seat in ${tr.from}, none in ${tr.to})`, tr.churned, pct(tr.churned, tr.fromSubs));
  add(`New in ${tr.to} (never had a seat before)`, tr.brandNew, pct(tr.brandNew, tr.toSubs));
  add(`Returned in ${tr.to} (had a seat in an earlier season)`, tr.returned, pct(tr.returned, tr.toSubs));
  add("Retention rate", pct(tr.retained, tr.fromSubs));
}

for (const s of seasons) {
  heading(`${s.label} — files`);
  add("Season details file", path.basename(s.detailsPath));
  add("Season per seat file", path.basename(s.seatsPath));
  add("Customers in season details", s.stats.detailsCustomers);
  if (s.stats.detailsDuplicates) add("Duplicate customer rows in season details", s.stats.detailsDuplicates);
  add("Subscribers (customers with seats)", s.stats.subscribers);
  add("Seat rows", s.stats.seatRows);
  add("In both files", s.stats.matched, pct(s.stats.matched, s.stats.unique));
  add("In season details only (no seat)", s.stats.onlyDetails, pct(s.stats.onlyDetails, s.stats.unique));
  for (const [reason, count] of s.stats.reasons) add(`   ↳ ${reason}`, count, pct(count, s.stats.onlyDetails));
  add("In seats only (missing from details)", s.stats.onlySeats, pct(s.stats.onlySeats, s.stats.unique));
  add("Season-ticket revenue (sum of seat prices)", s.stats.revenue);
}

// ── Column documentation (separate file) ─────────────────────────────────────
const columnDocs = [
  ["Customer no.", "details Cust. no. / seats Customer", "Trimmed, leading zeros removed; the same customer is matched across seasons by this number"],
  ["First name … Birthday", "latest season where the field is present", "Same rules as the single-season merge (seat-file name split, details fallback, phone formatting)"],
  ["Status", "computed", "subscriber every season · active subscriber · new in <latest> · returned in <latest> · churned after <season> · never subscribed"],
  ["Seasons with seat / Seat seasons", "computed", "How many / which seasons the customer held at least one seat"],
  ["Seats total / Revenue total (all seasons)", "computed", "Sum of seat counts / seat prices over all seasons"],
  ["<season> · Source", "computed", "both / season details only / seats only / not in season"],
  ["<season> · Seats count, Seats, Blocks, Seat status, Seats total price, Pay. type, Number of years", "that season's seat file", "Aggregated per customer exactly like the single-season merge"],
  ["<season> · Season tickets / No. of tickets / Total sales (details)", "that season's details file", "Copied as is"],
  ["<season> · details: <column>", "that season's details file", "Only with --all-columns: every original column, untouched"],
].map(([col, source, how]) => ({ "Merged column": col, "Comes from": source, "How it is built": how }));

// ── Write ────────────────────────────────────────────────────────────────────
const delta = seasons.flatMap((s) => s.delta);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheetFrom(summary, { Metric: 56, Value: 24 }), "Summary");
XLSX.utils.book_append_sheet(wb, sheetFrom(merged, { Email: 28, "Seat seasons": 24 }), "Merged");
XLSX.utils.book_append_sheet(wb, sheetFrom(delta, { Email: 28, "Likely reason": 48, "Seats (seat file)": 40 }), "Delta");
XLSX.utils.book_append_sheet(wb, sheetFrom(changes, { Email: 28 }), "Changes");
wb.Workbook = { Views: [{ RTL: true }] };
XLSX.writeFile(wb, outPath);

const columnsPath = outPath.replace(/(\.xlsx?)$/i, "") + "-columns.xlsx";
const cwb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(cwb, sheetFrom(columnDocs, { "Merged column": 40, "Comes from": 40, "How it is built": 60 }), "Columns");
XLSX.writeFile(cwb, columnsPath);

console.log(`✔ wrote ${outPath}`);
console.log(`✔ wrote ${columnsPath} (column documentation)`);
for (const s of summary) {
  if (s.Metric.startsWith("—")) console.log(`\n${s.Metric}`);
  else console.log(`  ${s.Metric}: ${s.Value}${s.Share ? ` (${s.Share})` : ""}`);
}
