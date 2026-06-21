/**
 * Verifies loyalty tier configuration, automatic upgrades, and analytics.
 * Usage: npm run verify:tiers
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  getLoyaltyTiers,
  updateLoyaltyTiers,
  resolveTierFromLifetimeSpend,
  getTierProgress,
  getTierDistribution,
  LoyaltyTiersError,
} from "../src/services/loyaltyTiers.js";
import { resolveCustomerTier } from "../src/utils/tier.js";
import { processOrdersPaidWebhook } from "../src/services/ordersPaidWebhook.js";
import { getDashboardMetrics } from "../src/services/dashboardMetrics.js";
import { formatStorefrontTierPayload } from "../src/services/loyaltyTiers.js";

const prisma = new PrismaClient();

const TEST_SHOP = process.env.VERIFY_SHOP || "loyaltypulse-test.myshopify.com";

async function main() {
  console.log("=== Loyalty Tier System Verification ===\n");

  const store = await prisma.store.findUnique({
    where: { shop: TEST_SHOP },
  });

  if (!store) {
    throw new Error(`Store not found: ${TEST_SHOP}`);
  }

  console.log(`Store: ${store.shop}`);

  const original = await getLoyaltyTiers(store);
  console.log("\n1. GET tiers:");
  console.log(JSON.stringify(original.tiers, null, 2));

  let failed = 0;
  const assert = (label, pass, detail = "") => {
    console.log(`  ${pass ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`);
    if (!pass) failed += 1;
  };

  console.log("\n2. Tier resolution (default thresholds):");
  const defaultTiers = original.tiers;
  assert("Bronze at $0", resolveTierFromLifetimeSpend(0, defaultTiers) === "BRONZE");
  assert("Bronze at $499", resolveTierFromLifetimeSpend(499, defaultTiers) === "BRONZE");
  assert("Silver at $500", resolveTierFromLifetimeSpend(500, defaultTiers) === "SILVER");
  assert("Gold at $1000", resolveTierFromLifetimeSpend(1000, defaultTiers) === "GOLD");
  assert("Platinum at $3000", resolveTierFromLifetimeSpend(3000, defaultTiers) === "PLATINUM");

  console.log("\n3. Next tier progress:");
  const progress = getTierProgress(380, defaultTiers, "BRONZE");
  assert("Next tier is Silver", progress.nextTier?.tierKey === "SILVER");
  assert("Spend remaining is 120", progress.spendToNextTier === 120);
  assert(
    "Message format",
    progress.nextTierMessage === "Spend $120 more to reach Silver"
  );

  console.log("\n4. PUT tiers (custom names) + restore:");
  const customTiers = defaultTiers.map((tier) => ({
    ...tier,
    name:
      tier.tierKey === "SILVER"
        ? "Silver Elite"
        : tier.tierKey === "GOLD"
          ? "Gold VIP"
          : tier.name,
  }));

  const updated = await updateLoyaltyTiers(store, { tiers: customTiers });
  assert("Silver renamed", updated.tiers.find((t) => t.tierKey === "SILVER")?.name === "Silver Elite");

  await updateLoyaltyTiers(store, { tiers: defaultTiers });

  console.log("\n5. Validation rejects invalid payload:");
  try {
    await updateLoyaltyTiers(store, {
      tiers: defaultTiers.map((tier) => ({
        ...tier,
        minLifetimeSpend: tier.tierKey === "SILVER" ? 0 : tier.minLifetimeSpend,
      })),
    });
    assert("Validation should throw", false);
  } catch (err) {
    assert(
      "Validation throws LoyaltyTiersError",
      err instanceof LoyaltyTiersError
    );
  }

  console.log("\n6. Automatic tier upgrade via order webhook:");
  const testCustomerGid = `gid://shopify/Customer/verify-tier-${Date.now()}`;
  const testEmail = `verify-tier-${Date.now()}@example.com`;

  let customer = await prisma.customer.create({
    data: {
      storeId: store.id,
      shopifyCustomerId: testCustomerGid,
      email: testEmail,
      firstName: "Tier",
      lastName: "Tester",
      lifetimeSpend: 0,
      tier: "BRONZE",
    },
  });

  const orderPayload = {
    id: Date.now(),
    name: `#VERIFY-TIER-${Date.now()}`,
    total_price: "520.00",
    email: testEmail,
    customer: {
      id: testCustomerGid.split("/").pop(),
      admin_graphql_api_id: testCustomerGid,
      email: testEmail,
      first_name: "Tier",
      last_name: "Tester",
    },
  };

  const webhookResult = await processOrdersPaidWebhook(store.shop, orderPayload);
  customer = await prisma.customer.findUnique({ where: { id: customer.id } });

  assert("Webhook processed", !webhookResult.skipped);
  assert("Lifetime spend updated", Number(customer.lifetimeSpend) === 520);
  assert("Tier upgraded to SILVER", customer.tier === "SILVER");

  const resolvedTier = await resolveCustomerTier(store.id, customer.lifetimeSpend);
  assert("resolveCustomerTier matches", resolvedTier === "SILVER");

  console.log("\n7. Dashboard tier distribution:");
  const dashboard = await getDashboardMetrics(store.id);
  assert("customersPerTier present", Boolean(dashboard.metrics.customersPerTier));
  assert(
    "tierDistribution chart present",
    Array.isArray(dashboard.charts.tierDistribution) &&
      dashboard.charts.tierDistribution.length === 4
  );
  console.log(JSON.stringify(dashboard.metrics.customersPerTier, null, 2));

  console.log("\n8. Storefront tier payload:");
  const tiers = await prisma.loyaltyTier.findMany({
    where: { storeId: store.id },
    orderBy: { sortOrder: "asc" },
  });
  const storefrontTier = formatStorefrontTierPayload(customer, tiers);
  assert("Storefront current tier", storefrontTier.name === "Silver");
  assert("Storefront next tier", storefrontTier.nextTier?.name === "Gold");
  assert(
    "Storefront progress message",
    storefrontTier.nextTierMessage === "Spend $480 more to reach Gold"
  );
  console.log(JSON.stringify(storefrontTier, null, 2));

  console.log("\n9. Cleanup test customer:");
  await prisma.pointsTransaction.deleteMany({ where: { customerId: customer.id } });
  await prisma.customer.delete({ where: { id: customer.id } });
  assert("Test customer removed", true);

  if (failed > 0) {
    throw new Error(`${failed} assertion(s) failed`);
  }

  console.log("\n=== All tier checks passed ===");
}

main()
  .catch((err) => {
    console.error("\nVerification failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
