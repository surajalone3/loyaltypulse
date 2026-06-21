-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tierKey" "CustomerTier" NOT NULL,
    "name" TEXT NOT NULL,
    "minLifetimeSpend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#CD7F32',
    "benefitsDescription" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyTier_storeId_idx" ON "LoyaltyTier"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTier_storeId_tierKey_key" ON "LoyaltyTier"("storeId", "tierKey");

-- AddForeignKey
ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default tiers for existing stores (skip stores that already have tiers)
INSERT INTO "LoyaltyTier" ("id", "storeId", "tierKey", "name", "minLifetimeSpend", "color", "benefitsDescription", "enabled", "sortOrder", "updatedAt")
SELECT
    concat('tier_', s."id", '_', v."tierKey"),
    s."id",
    v."tierKey"::"CustomerTier",
    v."name",
    v."minLifetimeSpend",
    v."color",
    v."benefitsDescription",
    true,
    v."sortOrder",
    CURRENT_TIMESTAMP
FROM "Store" s
CROSS JOIN (
    VALUES
        ('BRONZE', 'Bronze', 0, '#CD7F32', 'Earn points on every purchase.', 0),
        ('SILVER', 'Silver', 500, '#C0C0C0', 'Unlock bonus earning opportunities.', 1),
        ('GOLD', 'Gold', 1000, '#FFD700', 'Priority access to exclusive rewards.', 2),
        ('PLATINUM', 'Platinum', 3000, '#E5E4E2', 'VIP perks and highest earning rate.', 3)
) AS v("tierKey", "name", "minLifetimeSpend", "color", "benefitsDescription", "sortOrder")
WHERE NOT EXISTS (
    SELECT 1 FROM "LoyaltyTier" lt WHERE lt."storeId" = s."id"
);
