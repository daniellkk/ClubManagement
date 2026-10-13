# ClubManagement — instructions for Claude Code

Read `HANDOFF.md` first: it holds the project status, how to run everything, the target data model and the open questions. This file holds the rules that apply to every task.

## Hard rules

1. **Privacy.** Never select, print, screenshot, paste or summarise real fan rows (database, API responses, Excel exports, browser). Verify with counts, schema and structure only. Test with synthetic data in a temp dir.
2. **Pagination.** Every list endpoint and every UI list is paged (page/pageSize, max 100). Never load all rows; exports iterate pages.
3. **Loaders.** Every fetch/patch/delete/import shows a loader (`Spinner`, `LoadingOverlay`, `Button loading`) in the club's primary colour.
4. **Seed.** Never run `pnpm --filter @club/api db:seed` against a database with real data; it wipes every table. Fresh, empty databases only.
5. **Secrets.** Never read, print or echo `.env` files or env-derived values. New variables go to `apps/api/.env.example` with a comment. Nothing from `.env` goes into chat, git or docs.
6. **Data files.** `*.xlsx` and `*.csv` are git-ignored on purpose: the ticketing exports hold real PII. Do not force-add them.
7. **Ask when uncertain.** If a request can be read in materially different ways, ask one short question before building. Keep designs as small as the need (the 9-table model replaced a rejected 28-table one). Do not ask questions that have a conventional answer.

## Conventions

- pnpm monorepo: `pnpm dev:api`, `pnpm dev:admin`, `pnpm test` (Vitest, root config covers admin `*.test.ts`, api `*.spec.ts`, scripts `*.test.mjs`). Start Postgres (`pnpm db:up`) before the API.
- pnpm 11: new packages with postinstall scripts must be added to `allowBuilds` in `pnpm-workspace.yaml`.
- i18n: `apps/admin/src/locales/he.ts` is the master; `en.ts` is typed against it. Every user-facing string goes through `t()`. Layout must work in RTL and LTR.
- Tailwind v4 with `--tenant-primary` CSS variables (`bg-brand` etc.); the colour comes from `Club.primaryColor`.
- Recharts: every series `isAnimationActive={false}`. CSV import: read as UTF-8 text, then `XLSX.read(text, { type: "string" })`; CSV export prepends a BOM.
- Tables: `FilterableTh` (Excel-style filters, async facets), `useSort` cycles asc → desc → none, `Pagination` component, `useAsync` / `useDebounced` for data.
- API: NestJS with a global `JwtAuthGuard` (`@Public()` to opt out), class-validator DTOs, Prisma migrations via `pnpm prisma:migrate` (never `db push`).
- Mock data for the showcase pages lives in `apps/admin/src/lib/mock-data.ts`; fans and campaigns are API-backed and must stay that way.
- Ticketing identifiers: customer number = Excel "Cust. no." = Eventim `CustNr`; Eventim/Fortress club prefix is `SHF`, the app's own symbol is `HFS`.
