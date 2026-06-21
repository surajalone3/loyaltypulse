-- Core loyalty schema required before Reward / Redemption migrations.
-- The original init migration only created Session; Store and related tables
-- were previously applied via prisma db push in development but never migrated.

-- Session alignment with current schema
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Session_shop_idx" ON "Session"("shop");

-- Enums
CREATE TYPE "Plan" AS ENUM ('FREE', 'GROWTH', 'PRO', 'ENTERPRISE');
CREATE TYPE "CustomerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');
CREATE TYPE "PointsTransactionType" AS ENUM ('EARNED', 'REDEEMED', 'BONUS');

-- Store
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Store_shop_key" ON "Store"("shop");

-- LoyaltyProgram (base columns; settings added in later migrations)
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "pointsPerDollar" INTEGER NOT NULL DEFAULT 10,
    "rewardThreshold" INTEGER NOT NULL DEFAULT 100,
    "pointsName" TEXT NOT NULL DEFAULT 'points',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyProgram_storeId_key" ON "LoyaltyProgram"("storeId");

ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Customer
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyCustomerId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tier" "CustomerTier" NOT NULL DEFAULT 'BRONZE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_storeId_shopifyCustomerId_key" ON "Customer"("storeId", "shopifyCustomerId");
CREATE INDEX "Customer_storeId_idx" ON "Customer"("storeId");
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Points ledger
CREATE TABLE "PointsTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "PointsTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PointsTransaction_customerId_idx" ON "PointsTransaction"("customerId");
CREATE INDEX "PointsTransaction_storeId_idx" ON "PointsTransaction"("storeId");
CREATE INDEX "PointsTransaction_orderId_idx" ON "PointsTransaction"("orderId");
CREATE INDEX "PointsTransaction_createdAt_idx" ON "PointsTransaction"("createdAt");

ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Upsell (schema present; feature not yet implemented in app)
CREATE TABLE "UpsellOffer" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "discountedPrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpsellOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UpsellOffer_storeId_idx" ON "UpsellOffer"("storeId");
CREATE INDEX "UpsellOffer_storeId_isActive_idx" ON "UpsellOffer"("storeId", "isActive");

ALTER TABLE "UpsellOffer" ADD CONSTRAINT "UpsellOffer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UpsellConversion" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "accepted" BOOLEAN NOT NULL,
    "revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpsellConversion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UpsellConversion_storeId_idx" ON "UpsellConversion"("storeId");
CREATE INDEX "UpsellConversion_offerId_idx" ON "UpsellConversion"("offerId");
CREATE INDEX "UpsellConversion_orderId_idx" ON "UpsellConversion"("orderId");
CREATE INDEX "UpsellConversion_customerId_idx" ON "UpsellConversion"("customerId");

ALTER TABLE "UpsellConversion" ADD CONSTRAINT "UpsellConversion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpsellConversion" ADD CONSTRAINT "UpsellConversion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "UpsellOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpsellConversion" ADD CONSTRAINT "UpsellConversion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Review requests (base columns; status workflow added in later migration)
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "email" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewRequest_storeId_orderId_key" ON "ReviewRequest"("storeId", "orderId");
CREATE INDEX "ReviewRequest_storeId_idx" ON "ReviewRequest"("storeId");
CREATE INDEX "ReviewRequest_orderId_idx" ON "ReviewRequest"("orderId");
CREATE INDEX "ReviewRequest_customerId_idx" ON "ReviewRequest"("customerId");
CREATE INDEX "ReviewRequest_email_idx" ON "ReviewRequest"("email");

ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
