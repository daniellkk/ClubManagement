import { defineConfig } from "vitest/config";

// One runner for the whole monorepo:
//   apps/admin  → *.test.ts   (pure TypeScript libs: filters, sorting, paging, spreadsheet, API client)
//   apps/api    → *.spec.ts   (services with a fake Prisma, DTO validation — no database needed)
//   scripts     → *.test.mjs  (CLI scripts run end-to-end on fixtures)
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "apps/admin/src/**/*.test.ts",
      "apps/api/src/**/*.spec.ts",
      "scripts/**/*.test.mjs",
    ],
    reporters: "default",
  },
});
