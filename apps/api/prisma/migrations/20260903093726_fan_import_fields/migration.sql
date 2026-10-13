-- AlterTable
ALTER TABLE "Fan" ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "oldEmail" TEXT,
ADD COLUMN     "seatArea" TEXT,
ADD COLUMN     "seatNumber" TEXT,
ADD COLUMN     "seatRow" TEXT;
