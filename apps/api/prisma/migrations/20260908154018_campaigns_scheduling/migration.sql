-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('MANUAL', 'ONCE', 'CRON');

-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "cronExpression" TEXT,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "lastRunSummary" JSONB,
ADD COLUMN     "nextRunAt" TIMESTAMP(3),
ADD COLUMN     "runCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduleType" "ScheduleType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sender" TEXT,
ADD COLUMN     "sentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suppressedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem';

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "error" TEXT,
ADD COLUMN     "providerBatchId" TEXT,
ADD COLUMN     "recipient" TEXT;

-- CreateIndex
CREATE INDEX "MessageLog_campaignId_status_idx" ON "MessageLog"("campaignId", "status");
