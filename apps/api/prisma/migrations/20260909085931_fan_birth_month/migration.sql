-- AlterTable
ALTER TABLE "Fan" ADD COLUMN     "birthMonth" INTEGER;

-- CreateIndex
CREATE INDEX "Fan_clubId_birthMonth_idx" ON "Fan"("clubId", "birthMonth");

-- Backfill: month of the birthdays we already have
UPDATE "Fan" SET "birthMonth" = EXTRACT(MONTH FROM "birthDate")::int WHERE "birthDate" IS NOT NULL;
