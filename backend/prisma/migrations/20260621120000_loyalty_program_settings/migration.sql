-- AlterTable
ALTER TABLE "LoyaltyProgram" ADD COLUMN "programName" TEXT NOT NULL DEFAULT 'Stars';
ALTER TABLE "LoyaltyProgram" ADD COLUMN "welcomeBonus" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyProgram" ADD COLUMN "referralBonus" INTEGER NOT NULL DEFAULT 0;

-- Backfill program name from existing points label
UPDATE "LoyaltyProgram"
SET "programName" = INITCAP("pointsName")
WHERE "programName" = 'Stars' AND "pointsName" IS NOT NULL AND "pointsName" <> 'points';

UPDATE "LoyaltyProgram"
SET "programName" = "pointsName"
WHERE "pointsName" IS NOT NULL AND "programName" = 'Stars';
