# ClubManagement — Fan Club CRM

Admin dashboard + backend for football fan-club management. First tenant: הפועל באר שבע.
Hebrew, RTL-first UI. Multi-tenant by design (per-club branding, data isolation).

## Structure

```
apps/
  api/     NestJS + Prisma + PostgreSQL — REST API
  admin/   React 19 + Vite + Tailwind v4 — RTL admin dashboard
packages/
  shared/  Shared TypeScript types & enums
docs/
  design-tokens.md   Design tokens from the Figma Make spec
  screens-spec.md    Screen-by-screen component spec
```

## Getting started

```bash
pnpm install
pnpm db:up                 # start local Postgres (Docker)
cp apps/api/.env.example apps/api/.env
pnpm prisma:migrate        # create schema
pnpm dev:api               # API on :3000
pnpm dev:admin             # dashboard on :5173 (proxies /api → :3000)
```

## Compliance notes (Israel PPL, Amendment 13)

The club is the data controller; this platform is a processor/holder. Baked in:
consent/opt-in flags per channel, consent audit log, message categories
(transactional/goodwill/marketing), suppression on opt-out, soft-delete + erasure
propagation, per-tenant theming/isolation, audit logs. Host in EU/Israel regions.
A signed DPA per club is required before importing real fan data.
