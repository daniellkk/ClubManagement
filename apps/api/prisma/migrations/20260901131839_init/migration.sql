-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "FanStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING', 'OVERDUE', 'REFUNDED');

-- CreateEnum
CREATE TYPE "Venue" AS ENUM ('HOME', 'AWAY');

-- CreateEnum
CREATE TYPE "Competition" AS ENUM ('LEAGUE', 'CUP', 'EUROPE', 'FRIENDLY', 'OTHER');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'PLAYED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('SUBSCRIPTION', 'TICKET', 'SHUTTLE', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "TicketBuyerType" AS ENUM ('SUBSCRIBER', 'NON_SUBSCRIBER', 'VIP');

-- CreateEnum
CREATE TYPE "ShuttleRegStatus" AS ENUM ('REGISTERED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "MessageCategory" AS ENUM ('TRANSACTIONAL', 'GOODWILL', 'MARKETING');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "ConsentAction" AS ENUM ('OPT_IN', 'OPT_OUT');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('IMPORT', 'ADMIN_UI', 'FAN_REQUEST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#dc2626',
    "sidebarColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fan" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "customerNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "age" INTEGER,
    "city" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" "FanStatus" NOT NULL DEFAULT 'ACTIVE',
    "memberSince" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "appLastLoginAt" TIMESTAMP(3),
    "appSessionCount" INTEGER NOT NULL DEFAULT 0,
    "emailOptIn" BOOLEAN NOT NULL DEFAULT false,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "pushOptIn" BOOLEAN NOT NULL DEFAULT false,
    "preferredChannel" "Channel",
    "unsubscribedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanTag" (
    "fanId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "FanTag_pkey" PRIMARY KEY ("fanId","tagId")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "seat" TEXT,
    "price" DECIMAL(10,2),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL,
    "competition" "Competition" NOT NULL DEFAULT 'LEAGUE',
    "opponent" TEXT NOT NULL,
    "stadium" TEXT,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'SCHEDULED',
    "capacity" INTEGER,
    "ticketsSold" INTEGER NOT NULL DEFAULT 0,
    "subscriberAttendees" INTEGER NOT NULL DEFAULT 0,
    "totalAttendance" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "checkedInAt" TIMESTAMP(3),

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPurchase" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "fanId" TEXT,
    "buyerType" "TicketBuyerType",
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DECIMAL(10,2),
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shuttle" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "departureLocation" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price" DECIMAL(10,2),

    CONSTRAINT "Shuttle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleRegistration" (
    "id" TEXT NOT NULL,
    "shuttleId" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "status" "ShuttleRegStatus" NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "category" "MessageCategory" NOT NULL DEFAULT 'MARKETING',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "segmentQuery" JSONB,
    "gameId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "reach" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "campaignId" TEXT,
    "channel" "Channel" NOT NULL,
    "category" "MessageCategory" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "subject" TEXT,
    "body" TEXT,
    "triggerReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "channel" "Channel",
    "action" "ConsentAction" NOT NULL,
    "source" "ConsentSource" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_googleId_key" ON "AdminUser"("googleId");

-- CreateIndex
CREATE INDEX "AdminUser_clubId_idx" ON "AdminUser"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_clubId_name_key" ON "Season"("clubId", "name");

-- CreateIndex
CREATE INDEX "Fan_clubId_status_idx" ON "Fan"("clubId", "status");

-- CreateIndex
CREATE INDEX "Fan_clubId_city_idx" ON "Fan"("clubId", "city");

-- CreateIndex
CREATE INDEX "Fan_clubId_engagementScore_idx" ON "Fan"("clubId", "engagementScore");

-- CreateIndex
CREATE UNIQUE INDEX "Fan_clubId_customerNumber_key" ON "Fan"("clubId", "customerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_clubId_name_key" ON "Tag"("clubId", "name");

-- CreateIndex
CREATE INDEX "Subscription_seasonId_status_idx" ON "Subscription"("seasonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_fanId_seasonId_key" ON "Subscription"("fanId", "seasonId");

-- CreateIndex
CREATE INDEX "Game_clubId_seasonId_venue_idx" ON "Game"("clubId", "seasonId", "venue");

-- CreateIndex
CREATE INDEX "Game_clubId_kickoffAt_idx" ON "Game"("clubId", "kickoffAt");

-- CreateIndex
CREATE INDEX "Attendance_gameId_idx" ON "Attendance"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_fanId_gameId_key" ON "Attendance"("fanId", "gameId");

-- CreateIndex
CREATE INDEX "TicketPurchase_gameId_idx" ON "TicketPurchase"("gameId");

-- CreateIndex
CREATE INDEX "TicketPurchase_fanId_idx" ON "TicketPurchase"("fanId");

-- CreateIndex
CREATE INDEX "Shuttle_gameId_idx" ON "Shuttle"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleRegistration_shuttleId_fanId_key" ON "ShuttleRegistration"("shuttleId", "fanId");

-- CreateIndex
CREATE INDEX "Campaign_clubId_status_idx" ON "Campaign"("clubId", "status");

-- CreateIndex
CREATE INDEX "MessageLog_fanId_idx" ON "MessageLog"("fanId");

-- CreateIndex
CREATE INDEX "MessageLog_clubId_category_createdAt_idx" ON "MessageLog"("clubId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentLog_fanId_createdAt_idx" ON "ConsentLog"("fanId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_clubId_createdAt_idx" ON "ImportJob"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_clubId_createdAt_idx" ON "ActivityEvent"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_clubId_createdAt_idx" ON "AuditLog"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fan" ADD CONSTRAINT "Fan_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanTag" ADD CONSTRAINT "FanTag_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanTag" ADD CONSTRAINT "FanTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPurchase" ADD CONSTRAINT "TicketPurchase_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPurchase" ADD CONSTRAINT "TicketPurchase_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shuttle" ADD CONSTRAINT "Shuttle_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleRegistration" ADD CONSTRAINT "ShuttleRegistration_shuttleId_fkey" FOREIGN KEY ("shuttleId") REFERENCES "Shuttle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleRegistration" ADD CONSTRAINT "ShuttleRegistration_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
