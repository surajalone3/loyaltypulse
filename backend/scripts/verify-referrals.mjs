/**
 * Verifies referral program end-to-end flow.
 * Usage: npm run verify:referrals
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  applyReferral,
  getReferralDashboardMetrics,
  getReferralLinkForCustomer,
  getCustomerReferralStats,
} from "../src/services/referrals.js";
import { processOrdersPaidWebhook } from "../src/services/ordersPaidWebhook.js";
import { getDashboardMetrics } from "../src/services/dashboardMetrics.js";
import { getLoyaltySettings, updateLoyaltySettings } from "../src/services/loyaltySettings.js";

const prisma = new PrismaClient();

const TEST_SHOP = process.env.VERIFY_SHOP || "loyaltypulse-test.myshopify.com";

async function main() {
  console.log("=== Referral Program Verification ===\n");

  const store = await prisma.store.findUnique({
    where: { shop: TEST_SHOP },
  });

  if (!store) {
    throw new Error(`Store not found: ${TEST_SHOP}`);
  }

  const settings = await getLoyaltySettings(store);
  await updateLoyaltySettings(store, {
    programName: settings.programName,
    pointsPerDollar: settings.pointsPerDollar,
    welcomeBonus: 100,
    referralBonus: 250,
    reviewRequestDelayDays: settings.reviewRequestDelayDays,
    reviewRequestsEnabled: settings.reviewRequestsEnabled,
    programEnabled: true,
  });

  let failed = 0;
  const assert = (label, pass, detail = "") => {
    console.log(`  ${pass ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`);
    if (!pass) failed += 1;
  };

  const suffix = Date.now();

  console.log("1. Create referrer Customer A");
  const customerA = await prisma.customer.create({
    data: {
      storeId: store.id,
      shopifyCustomerId: `gid://shopify/Customer/ref-a-${suffix}`,
      email: `referrer-a-${suffix}@example.com`,
      firstName: "Referrer",
      lastName: "Alpha",
    },
  });

  const linkA = await getReferralLinkForCustomer(store, customerA.id);
  assert("Referrer link generated", Boolean(linkA.referralUrl));
  assert("Referral code format", linkA.referralCode.startsWith("LP-"));
  console.log(JSON.stringify(linkA, null, 2));

  console.log("\n2. Customer B applies referral code (signup tracking)");
  const customerBGid = `gid://shopify/Customer/ref-b-${suffix}`;
  const applyResult = await applyReferral({
    storeId: store.id,
    shop: store.shop,
    shopifyCustomerId: customerBGid.replace("gid://shopify/Customer/", ""),
    referralCode: linkA.referralCode,
    profile: {
      email: `referred-b-${suffix}@example.com`,
      firstName: "Referred",
      lastName: "Beta",
    },
  });

  assert("Referral created", applyResult.referral?.status === "PENDING");
  const customerB = await prisma.customer.findUnique({
    where: { id: applyResult.referral.referred.id },
  });
  assert("Referred customer created", Boolean(customerB));

  console.log("\n3. Customer B completes first purchase");
  const orderPayload = {
    id: suffix,
    admin_graphql_api_id: `gid://shopify/Order/${suffix}`,
    name: `#REF-${suffix}`,
    total_price: "75.00",
    email: customerB.email,
    customer: {
      id: customerBGid.split("/").pop(),
      admin_graphql_api_id: customerBGid,
      email: customerB.email,
      first_name: "Referred",
      last_name: "Beta",
    },
  };

  const webhookResult = await processOrdersPaidWebhook(store.shop, orderPayload);
  assert("Order processed", !webhookResult.skipped);
  assert("Welcome bonus awarded", webhookResult.bonusResult?.welcomeBonusAwarded === 100);
  assert("Referral bonus awarded", webhookResult.bonusResult?.referralBonusAwarded === 250);

  const referralRow = await prisma.referral.findUnique({
    where: { referredCustomerId: customerB.id },
  });
  assert("Referral completed", referralRow?.status === "COMPLETED");
  assert("Reward issued flag", referralRow?.rewardIssued === true);

  const [referrerAfter, referredAfter] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerA.id } }),
    prisma.customer.findUnique({ where: { id: customerB.id } }),
  ]);

  const earnedPoints = Math.floor(75 * settings.pointsPerDollar);
  assert(
    "Referrer received referral bonus points",
    referrerAfter.totalPoints >= 250
  );
  assert(
    "Referred received welcome bonus + earned points",
    referredAfter.totalPoints >= 100 + earnedPoints
  );

  const welcomeTxn = await prisma.pointsTransaction.findFirst({
    where: {
      customerId: customerB.id,
      type: "BONUS",
      reason: "Welcome bonus",
    },
  });
  const referralTxn = await prisma.pointsTransaction.findFirst({
    where: {
      customerId: customerA.id,
      type: "BONUS",
      reason: { startsWith: "Referral bonus" },
    },
  });
  assert("Welcome bonus transaction", Boolean(welcomeTxn));
  assert("Referral bonus transaction", Boolean(referralTxn));

  console.log("\n4. Referrer stats");
  const stats = await getCustomerReferralStats(customerA.id);
  assert("Successful referrals", stats.successfulReferrals === 1);
  assert("Pending referrals", stats.pendingReferrals === 0);
  assert("Stars earned from referrals", stats.starsEarnedFromReferrals === 250);
  console.log(JSON.stringify(stats, null, 2));

  console.log("\n5. Dashboard referral metrics");
  const dashboard = await getDashboardMetrics(store.id);
  assert("Dashboard total referrals", dashboard.metrics.totalReferrals >= 1);
  assert(
    "Dashboard conversion rate",
    dashboard.metrics.referralConversionRate > 0
  );
  assert(
    "Top referrers includes Customer A",
    (dashboard.metrics.topReferrers ?? []).some((row) => row.customerId === customerA.id)
  );
  console.log(
    JSON.stringify(
      {
        totalReferrals: dashboard.metrics.totalReferrals,
        referralConversionRate: dashboard.metrics.referralConversionRate,
        topReferrers: dashboard.metrics.topReferrers,
      },
      null,
      2
    )
  );

  const referralMetrics = await getReferralDashboardMetrics(store.id);
  assert("Referral service metrics", referralMetrics.completedReferrals >= 1);

  console.log("\n6. Cleanup");
  await prisma.pointsTransaction.deleteMany({
    where: { customerId: { in: [customerA.id, customerB.id] } },
  });
  await prisma.referral.deleteMany({
    where: { id: referralRow.id },
  });
  await prisma.reviewRequest.deleteMany({
    where: { customerId: customerB.id },
  });
  await prisma.customer.deleteMany({
    where: { id: { in: [customerA.id, customerB.id] } },
  });
  assert("Cleanup complete", true);

  if (failed > 0) {
    throw new Error(`${failed} assertion(s) failed`);
  }

  console.log("\n=== All referral checks passed ===");
}

main()
  .catch((err) => {
    console.error("\nVerification failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
