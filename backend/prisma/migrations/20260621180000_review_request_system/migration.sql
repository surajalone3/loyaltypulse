-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('PENDING', 'SENT', 'COMPLETED');

-- AlterTable
ALTER TABLE "LoyaltyProgram" ADD COLUMN "reviewRequestDelayDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "LoyaltyProgram" ADD COLUMN "reviewRequestsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ReviewRequest" ADD COLUMN "status" "ReviewRequestStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ReviewRequest" ADD COLUMN "scheduledSendAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ReviewRequest_storeId_status_idx" ON "ReviewRequest"("storeId", "status");
CREATE INDEX "ReviewRequest_scheduledSendAt_idx" ON "ReviewRequest"("scheduledSendAt");

-- Backfill status from timestamps
UPDATE "ReviewRequest"
SET "status" = 'COMPLETED'
WHERE "reviewedAt" IS NOT NULL;

UPDATE "ReviewRequest"
SET "status" = 'SENT'
WHERE "reviewedAt" IS NULL AND "sentAt" IS NOT NULL;

-- Backfill scheduled send date for pending requests
UPDATE "ReviewRequest"
SET "scheduledSendAt" = "createdAt" + INTERVAL '7 days'
WHERE "status" = 'PENDING' AND "scheduledSendAt" IS NULL;
