# ClubManagement — project handoff

Status snapshot written 2026-10-13 so the project can continue on another machine (and in a fresh Claude Code session) without the original chat history. Read this first, then `CLAUDE.md` for the working rules.

---

## 1. What this is

A fan-club CRM for football clubs. First tenant: **הפועל באר שבע (Hapoel Be'er Sheva)**. Hebrew/RTL-first admin dashboard with full English/LTR support, a NestJS API and a Postgres database. Multi-tenant by design (every row hangs off a `Club`).

**V1 scope decision:** V1 is a capabilities/design showcase. Dashboards run on mock data; the fans module and campaigns are already real (Postgres + API). Wiring the rest to live data is the next phase, after the external ticketing APIs are confirmed.

---

## 2. Where we stand (at a glance)

| Area | State |
|---|---|
| Auth | Email + password, and Google via Firebase popup (invite-only: the email must already exist as an admin). JWT in httpOnly cookie `club_session` (7d). Direct Google OAuth path exists but is unconfigured. |
| Onboarding wizard | 3 steps: owner name + team symbol + club name → logo upload + brand colour → initial Excel import. Club-level flag `Club.onboardedAt`. |
| Fans | **Real.** Postgres-backed. Paged list (max 100/page), Excel-style per-column filters with server facets, search, sort (asc → desc → none), profile/edit, soft delete, CSV/XLSX import (1,000-row chunks, cancellable, bulk INSERT/UPDATE) and export (walks pages). |
| Campaigns | **Real.** Postgres + InforU gateway (SMS / WhatsApp / email). Segment filters (all / subscribers / non-subscribers, cities, tier, score, app users) + behaviour triggers (birthday month, missed N games, inactive N days). Manual / once / cron schedules, dry-run by default, test send, per-fan message log with SUPPRESSED rows as consent evidence. |
| Dashboard, Subscriptions, Home/Away games, Behavior, Comparisons, Store | **Mock data** (`apps/admin/src/lib/mock-data.ts`). Behavior page has the full interactive design: segment × venue × period filters, KPIs, paged table, collapsible map (Leaflet) and pie (Recharts) with drill-down to the table. |
| i18n | Complete. `he.ts` is the master, `en.ts` is typed against it. Language switch in Settings. RTL/LTR layout flips. |
| Tests | `pnpm test` at repo root → Vitest, **18 files / 114 tests, all green** (2026-10-13). |
| Data model (target) | Designed and documented in `docs/db-model.html` / `docs/db-model.pdf`. **Not yet migrated** — the Prisma schema is still the V1 schema. See §6. |
| External systems | Eventim Inhouse (tickets + subscriptions), Fortress (stadium access / attendance), WooCommerce (merch store), fan app. Analysed; no connector built yet. See §7. |
| Git | Repo initialised 2026-10-13, remote `github.com/daniellkk/ClubManagement`. Use GitHub account `daniellkk`. |

---

## 3. Stack and layout

pnpm monorepo (pnpm 11 via corepack, Node ≥ 20; developed on Node 24).

```
apps/api        NestJS 11 + Prisma 6 + Postgres 16 (Docker)   → http://localhost:3000/api
apps/admin      React 19 + Vite 6 + Tailwind v4, react-router 7, i18next, Recharts 3,
                react-leaflet 5, SheetJS (xlsx), lucide-react  → http://localhost:5173 (proxies /api → :3000)
packages/shared Shared enums/types mirrored by the Prisma schema
scripts/        Ticketing-export merge scripts (see §5)
docs/           design-tokens.md, screens-spec.md, db-model.html + db-model.pdf
```

API modules: `auth`, `fans`, `campaigns`, `messaging` (InforU), `stats`, `health`, `prisma`.
Admin pages: Dashboard, Fans (+ profile, edit), Subscriptions, Campaigns, Home games, Away games, Behavior, Comparisons, Store, Settings, Login, Onboarding.

Prisma migrations so far: `init`, `club_onboarding`, `fan_import_fields`, `club_symbol`, `campaigns_scheduling`, `fan_birth_month`.

---

## 4. Running it on a new machine

### Prerequisites
Docker Desktop, Node ≥ 20, pnpm 11 (`corepack enable && corepack prepare pnpm@11 --activate`).

### Install and start
```bash
pnpm install
pnpm db:up                       # Postgres 16 in Docker (container clubmanagement-db, user club / db clubmanagement)
cp apps/api/.env.example apps/api/.env   # then fill it — see below
pnpm prisma:migrate              # applies all migrations (answer the "name" prompt with anything if asked)
pnpm dev:api                     # terminal 1 — wait for "API listening on http://localhost:3000/api"
pnpm dev:admin                   # terminal 2 — http://localhost:5173
```
Start order matters: Postgres must be up before the API boots (otherwise Prisma P1001).

### `apps/api/.env` — values are never in git or in chat; copy them from the Windows machine by hand
Required for local work:
- `DATABASE_URL` (the docker-compose default works as-is), `PORT`, `CORS_ORIGINS`
- `JWT_SECRET` (any long random string; a new value just logs everyone out)
- `ADMIN_APP_URL`
- `FIREBASE_WEB_CONFIG` — the Firebase web config object on one line; this alone enables Google sign-in. `FIREBASE_SERVICE_ACCOUNT` is optional.
- `INFORU_*` — leave `INFORU_DRY_RUN=true` unless you want real sends.
- `GOOGLE_CLIENT_ID/SECRET` — only for the direct OAuth path; currently empty everywhere.

### Bootstrapping the database (it starts empty on the Mac)
Invite-only login means an `AdminUser` row with your Google email must exist before you can sign in. Two options:

**A. Demo-populated (quickest).** Only on an empty database — the seed **wipes every table**:
```bash
pnpm --filter @club/api db:seed
```
Creates the club, seasons, demo games, 12 demo fans and a demo admin (`admin@hapoel-bs.demo`, password inside `apps/api/prisma/seed.cjs`). Then invite your own email:
```sql
insert into "AdminUser"(id,"clubId",email,name,role,"isActive","createdAt","updatedAt")
select gen_random_uuid()::text, id, '<your-google-email>', '', 'OWNER', true, now(), now()
from "Club" where slug='hapoel-beer-sheva';
```

**B. Clean (no demo data).**
```sql
insert into "Club"(id,slug,name,"primaryColor","sidebarColor","createdAt","updatedAt")
values (gen_random_uuid()::text,'hapoel-beer-sheva','הפועל באר שבע','#dc2626','#1a1a1a',now(),now());

insert into "Season"(id,"clubId",name,"startDate","endDate","isCurrent")
select gen_random_uuid()::text, id, '2026/27', '2026-07-01', '2027-06-30', true
from "Club" where slug='hapoel-beer-sheva';          -- the import attaches seat holders to the current season

insert into "AdminUser"(id,"clubId",email,name,role,"isActive","createdAt","updatedAt")
select gen_random_uuid()::text, id, '<your-google-email>', '', 'OWNER', true, now(), now()
from "Club" where slug='hapoel-beer-sheva';
```
Run SQL with `docker exec -it clubmanagement-db psql -U club -d clubmanagement`.

Then open http://localhost:5173 → "Sign in with Google" → the onboarding wizard runs (club not yet onboarded) → import the club CSV on step 3 or skip.

The club's import CSV columns are: `customerNumber, oldFirstName, oldLastName, oldEmail, oldId, area, row, seat, email` (email falls back to oldEmail). Header mapping is automatic, including Hebrew aliases.

### Windows-only gotchas you will not have on the Mac
pnpm shims vanish after reboots (`corepack enable` fixes it); dev servers die with the Claude Code session; a stray node process sometimes holds port 3000.

---

## 5. The ticketing exports and the merge scripts

The club exports two spreadsheets per season from Eventim Inhouse: **"season details"** (one row per customer: `Cust. no.`, name "Surname, First", contact, address, birthday, per-season sales/ticket counts) and **"season per seat"** (one row per seat: `Customer`, `Season`, `Series`, block/row/seat, price, order, invoice, pay type, number of years). Three seasons exist: 2024/25, 2025/26, 2026/27 (6 files). `Cust. no.` ↔ `Customer` is the key (leading zeros stripped).

Scripts (root `package.json` has `xlsx` as a devDependency):

```bash
node scripts/merge-season.cjs  --details <details.xlsx> --seats <seats.xlsx> --out merged-season26-27.xlsx [--per-seat] [--breakdowns]
node scripts/merge-seasons.cjs --merged merged-season24-25.xlsx --merged merged-season25-26.xlsx --merged merged-season26-27.xlsx --out all-seasons.xlsx [--all-columns]
```
- `merge-season.cjs` → workbook with **Summary**, **Merged** (clean identity columns + seat aggregates + every original `details: <col>`), **Delta** (customers missing from one file, with a likely reason), optional **Seats**/**Breakdowns**; a separate `<out>-columns.xlsx` documents every column.
- `merge-seasons.cjs` → all seasons per customer with a computed **Status** (subscriber every season / active subscriber / new in X / returned in X / churned after X / never subscribed), **Changes** per consecutive season pair, **Delta**, **Summary** with retention rates.
- Shared logic in `scripts/lib/season.cjs`; tests in `scripts/__tests__` run on synthetic fixtures in the OS temp dir.

**The real merged files (`merged-season*.xlsx`, `all-seasons*.xlsx`) contain 11k+ real fans and are git-ignored. Never commit them.** They live outside the repo on the Windows machine; copy them to the Mac separately if needed.

Figures learned from the real 2026/27 files: 11,624 customers in details, 12,300 seat rows, 11,595 subscribers, 29 details-only (cancelled/comp/single-ticket buyers), 0 seats-only.

---

## 6. Target database design (documented, not yet implemented)

Full spec with ER diagram, every column, and a "what every screen reads" table: **`docs/db-model.html`** (open in a browser) / **`docs/db-model.pdf`**.

Nine tables. Everything keys on **`customerId`** = Excel "Cust. no." = Eventim `CustNr` = the number after the club prefix in Fortress member ids.

| Table | One row per | Source |
|---|---|---|
| Fan | customer (identity, contacts, address, birthday, consent, score, source, enrichedAt, firstSeenAt) | merged Excel; shell rows created by syncs |
| Season | season | Excel "Season" |
| FanSeason | customer × season — the merged Excel row as is (series + tier, seats, prices, orders, pay type, years, season tickets, tickets, total sales, computed status) | merged Excel (+ Eventim later) |
| Game | Eventim event (title, date, venue, home/away, competition, capacity, result, Fortress product code, `lastFetchTimestampUtc` sync cursor) | Eventim `SearchEvents` |
| Ticket | one Eventim barcode (CustNr, order, row/seat/area, price, sales type, V/S status, booking date, subscription flag) | Eventim `FetchTicketData` |
| Attendance | customer × game (scanned, turnstile, time; `attended` null until scans exist) | Fortress scan log |
| StoreOrder | WooCommerce order (billing name/email/phone, optional customer number meta, status, totals, `modifiedAt` cursor) | WooCommerce `/wc/v3/orders` |
| StoreOrderItem | order line (product, variation, sku, name, category, qty, price) | WooCommerce line_items + `/products` |
| AppUser | app account (last login, 30-day activity, push token) | fan app |

Existing tables that stay unchanged: Club, AdminUser, Tag/FanTag, Campaign, MessageLog, ConsentLog, ImportJob, ActivityEvent, AuditLog. `Subscription` becomes `FanSeason`; `Shuttle*` is dropped.

Key decisions: seats are rows not fan columns; history is per season; external data is mirrored and never edited here; purchase ≠ attendance; derived values (score, status, aggregates) are rebuilt by jobs; PII only on Fan and the mirror rows. Matching for store/app: customer number → email → phone, first hit wins, `matchedBy` recorded, unmatched rows kept with `fanId = null` for manual linking. Shell fans created by syncs are enriched later from the Eventim customer endpoint (`enrichedAt`).

Deltas vs. today's Prisma schema (summary): Fan `customerNumber → customerId`, `city → town`, `memberSince → firstSeenAt`, add `mobile/street/houseNo/postalCode/source/enrichedAt`, drop `age/seatArea/seatRow/seatNumber/appSessionCount/preferredChannel/avatarUrl`; Subscription → FanSeason; Game + Eventim fields; TicketPurchase → Ticket (per barcode); Attendance + barcode/turnstile/scannedAt; new StoreOrder/StoreOrderItem/AppUser.

Engagement score v1 = the club's existing points rule found in their middleware: 50 points first membership season, 10 per further season, each game 5 points for members / 1 for others.

---

## 7. External systems

| System | Purpose | What we know | Status |
|---|---|---|---|
| **Eventim Inhouse** (EvaXML) | games, ticket purchases, subscriptions, customer details | `SearchEvents` (events: `_ID`, `Title`, `Date`, `VenueName`, `VenueShortCode`, `Genre`) and `FetchTicketData(EvID, Timestamp)` → per ticket `CustNr`, `BC` (barcode), `OID`, `BDate`, `Row/Seat/AreaText/EntryText`, `Price`, `SalesType`, `MdtNr` (6000 = skip), `Status` V/S, `CReason`, `SubscriptionFlag`, `PrintAtHomeFlag`; returns `NewTimestampUTC` for incremental pulls (per event). Customer endpoint `GetCustomerDataInhouseInt?CustomerNo=` (one per call, non-standard port, IP-whitelisted). No season field; seasons derived from dates. Club prefix in Eventim/Fortress is **SHF** (the app's own symbol is HFS). | API docs to be shared by the club. We will call it directly (the ls_techs middleware is being replaced). |
| **Fortress** | stadium access control, member cards, **attendance** | Existing integration only loads barcodes onto gates (`FullActiveExtract`, sell/cancel, cards). A per-game scan log exists (`mediaIdentifier` per scan) but no endpoint is integrated. Member barcodes change their first digit on reprint → match by customer no. + row + seat. | API docs to be shared. Until then attendance stays "unknown", never assumed. |
| **WooCommerce** | merchandise store only | REST `/wc/v3/orders` (billing email/phone/name, `customer_id` 0 for guests, status, totals, line_items) + `/products` for categories; `modified_after` cursor; `order.created/updated` webhooks (HMAC-SHA256). No customer number → recommend an optional "מספר לקוח" field saved as order meta `_club_customer_number`. | Needs read-only consumer key/secret + webhook secret. Decision pending on the customer-number field and which statuses count as revenue. |
| **Fan app** | logins, activity, push | Match by customer number (ask once in-app) → email → phone. | Backend not yet identified. |
| **InforU** | SMS / WhatsApp / email sending for campaigns | Integrated (`apps/api/src/messaging/inforu.service.ts`), dry-run by default. | Real credentials pending. |

Nightly sync plan (from the design): games → tickets per game from the stored timestamp → attendance from Fortress → WooCommerce orders since cursor → aggregates + score; contact enrichment on demand.

---

## 8. Working rules (non-negotiable)

1. **Never view, print, screenshot or paste real fan data** — not from the DB, not from the Excel files. Use counts and structure only. The fans table in the browser is checked structurally, never by content.
2. **Every list query is paged** (page/pageSize, max 100). Never query all rows; exports walk pages.
3. **Every async path shows a loader** (`Spinner`, `LoadingOverlay`, `Button loading`), in the club's primary colour.
4. **Never run `db:seed` on a database that holds real fans** — it wipes everything.
5. **Never read or print `.env`** or env-derived values. New variables go to `.env.example` with a comment.
6. **Ask when uncertain**; know exactly what you are doing and why. Do not over-build (a 28-table design was rejected in favour of 9).
7. The real export workbooks never enter git (`*.xlsx` / `*.csv` are ignored).

---

## 9. Gotchas and conventions

- pnpm 11: packages with postinstall scripts must be listed under `allowBuilds` in `pnpm-workspace.yaml` or every `pnpm <script>` fails with `ERR_PNPM_IGNORED_BUILDS`.
- All Recharts series use `isAnimationActive={false}` (charts rendered blank on first load otherwise).
- CSV imports are read as UTF-8 text before SheetJS (`XLSX.read(text, { type: "string" })`); exports prepend a BOM. Otherwise Hebrew becomes mojibake.
- `InfoTip` uses physical `left-1/2 -translate-x-1/2` (logical `start-*` misaligned in RTL).
- Sort state cycles asc → desc → none; `FilterableTh` loads facet options lazily from `GET /api/fans/facets`.
- Chrome MCP screenshots freeze once the Leaflet map is expanded; verify the behavior page with DOM/JS checks.
- Open semantic question for the club: with "all games" selected, the "last game" period counts two games (last home + last away).
- Team symbols live in `apps/api/src/auth/team-symbols.ts` (only HFS today); served by `GET /api/auth/team-symbols`.

---

## 10. API surface (all under `/api`, cookie auth unless marked public)

- `auth`: `POST login`, `GET config` (public), `POST firebase`, `GET google` / `google/callback`, `POST logout`, `GET me`, `GET team-symbols`, `POST onboarding`
- `fans`: `GET /` (paged, filters JSON, sortKey/sortDir), `GET facets`, `GET meta/cities`, `POST import` (≤ 2,000 rows), `POST exists` (≤ 1,000), `GET :id`, `PATCH :id`, `DELETE :id` (soft)
- `campaigns`: `GET meta`, `GET /`, `POST estimate`, `POST insights`, `POST /`, `GET :id`, `PUT :id`, `DELETE :id`, `POST :id/run`, `POST :id/enabled`, `POST :id/test`, `GET :id/messages`
- `stats`: `GET dashboard`
- `health`: `GET /`

---

## 11. Next steps (in order)

1. Get the **Eventim Inhouse** and **Fortress** API docs from the club; confirm the data-model assumptions in §6/§7 (subscription purchases per season, customer record fields incl. consent, scan log per game, away-game visibility).
2. Decide the WooCommerce customer-number field and revenue statuses; obtain read-only API keys.
3. Implement the schema migration to the 9-table model (FanSeason, Ticket, Attendance, StoreOrder(+Item), AppUser; Fan/Game column changes) and a loader for the **merged season workbooks** (oldest season first; the all-seasons Summary counts are the acceptance test).
4. Build the nightly sync jobs (Eventim → Fortress → WooCommerce → aggregates/score) with `ImportJob` rows and cursors.
5. Wire Dashboard, Subscriptions, Games, Behavior, Comparisons and Store from mock data to the API, keeping pagination and loaders.
6. Housekeeping: real InforU credentials, Google direct OAuth (optional), results feed or admin entry for match results, static town → coordinates lookup for the map.

---

## 12. Timeline

- 2026-08-26 — stack chosen (NestJS/Prisma/Postgres, React/Vite/Tailwind), compliance stance, design batches logged in `docs/`.
- 2026-09-01 — V1 = showcase on mock data; i18n RTL/LTR; behavior dashboard; store/app requirements from the app manager.
- 2026-09-03 — QA round: onboarding wizard, Excel-style filters, loaders, pagination everywhere; fans moved to Postgres with bulk cancellable import.
- 2026-09-08 — Firebase Google login, team symbols, 3-step onboarding, campaigns with InforU + scheduling + triggers; merge scripts for the season exports; unit suite green.
- 2026-09-09 / 10 — data model designed (`docs/db-model.*`), Eventim middleware analysed, WooCommerce mapped, every screen mapped to tables.
- 2026-10-13 — git repo initialised; this handoff written. Windows DB state at that time: club reset to not-onboarded, fans table emptied on request, one admin, 2 seasons, 9 games, 5 campaigns.
