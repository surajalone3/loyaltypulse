-- CreateEnum
CREATE TYPE "RewardDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN "discountType" "RewardDiscountType" NOT NULL DEFAULT 'PERCENTAGE';
ALTER TABLE "Reward" ADD COLUMN "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN "shopifyDiscountId" TEXT;
ALTER TABLE "Redemption" ADD COLUMN "discountType" "RewardDiscountType" NOT NULL DEFAULT 'PERCENTAGE';
ALTER TABLE "Redemption" ADD COLUMN "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 10;
