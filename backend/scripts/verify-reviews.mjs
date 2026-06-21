/**
 * Verifies review request lifecycle.
 * Usage: npm run verify:reviews
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { processOrdersPaidWebhook } from "../src/services/ordersPaidWebhook.js";
import {
  completeReviewRequest,
  createReviewRequestAfterOrder,
  getReviewStats,
  processDueReviewRequests,
  sendReviewRequest,
} from "../src/services/reviewRequests.js";
import { getDashboardMetrics } from "../src/services/dashboardMetrics.js";
import { getCustomerReviewStatus } from "../src/services/reviewRequests.js";
import { updateLoyaltySettings, getLoyaltySettings } from "../src/services/loyaltySettings.js";

const prisma = new PrismaClient();

const TEST_SHOP = process.env.VERIFY_SHOP || "loyaltypulse-test.myshopify.com";

async function main() {
  console.log("=== Review Request System Verification ===\n");

  const store = await prisma.store.findUnique({
    where: { shop: TEST_SHOP },
  });

  if (!store) {
    throw new Error(`Store not found: ${TEST_SHOP}`);
  }

  const settings = await getLoyaltySettings(store);
  await updateLoyaltySettings(store, {
    ...settings,
    reviewRequestDelayDays: 0,
    reviewRequestsEnabled: true,
    programEnabled: true,
  });

  let failed = 0;
  const assert = (label, pass, detail = "") => {
    console.log(`  ${pass ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`);
    if (!pass) failed += 1;
  };

  const suffix = Date.now();
  const orderId = `gid://shopify/Order/review-${suffix}`;
  const customerGid = `gid://shopify/Customer/review-${suffix}`;
  const email = `review-verify-${suffix}@example.com`;

  console.log("1. Create review request after order");
  const customer = await prisma.customer.create({
    data: {
      storeId: store.id,
      shopifyCustomerId: customerGid,
      email,
      firstName: "Review",
      lastName: "Tester",
    },
  });

  const created = await createReviewRequestAfterOrder({
    storeId: store.id,
    orderId,
    customerId: customer.id,
    email,
    delayDays: 0,
    enabled: true,
  });

  assert("Review request created", created.created === true);
  assert("Status is PENDING", created.reviewRequest.status === "PENDING");
  assert("Scheduled send set", Boolean(created.reviewRequest.scheduledSendAt));

  const duplicate = await createReviewRequestAfterOrder({
    storeId: store.id,
    orderId,
    customerId: customer.id,
    email,
    delayDays: 0,
    enabled: true,
  });
  assert("Duplicate prevented", duplicate.created === false);

  console.log("\n2. Send review request");
  const sent = await sendReviewRequest(created.reviewRequest.id, store.id, {
    force: true,
  });
  assert("Status is SENT", sent.status === "SENT");
  assert("sentAt recorded", Boolean(sent.sentAt));

  console.log("\n3. Complete review request");
  const completed = await completeReviewRequest(
    created.reviewRequest.id,
    store.id
  );
  assert("Status is COMPLETED", completed.status === "COMPLETED");
  assert("reviewedAt recorded", Boolean(completed.reviewedAt));

  console.log("\n4. Full webhook flow");
  const webhookSuffix = Date.now();
  const webhookOrder = {
    id: webhookSuffix,
    admin_graphql_api_id: `gid://shopify/Order/${webhookSuffix}`,
    name: `#REVIEW-FLOW-${webhookSuffix}`,
    total_price: "40.00",
    email: `review-flow-${webhookSuffix}@example.com`,
    customer: {
      id: webhookSuffix,
      admin_graphql_api_id: `gid://shopify/Customer/${webhookSuffix}`,
      email: `review-flow-${webhookSuffix}@example.com`,
      first_name: "Flow",
      last_name: "Tester",
    },
  };

  const webhookResult = await processOrdersPaidWebhook(store.shop, webhookOrder);
  assert("Webhook created review request", Boolean(webhookResult.reviewRequest));
  assert(
    "Webhook review is PENDING",
    webhookResult.reviewRequest.status === "PENDING"
  );

  await prisma.reviewRequest.update({
    where: { id: webhookResult.reviewRequest.id },
    data: { scheduledSendAt: new Date(Date.now() - 60_000) },
  });

  const dueResult = await processDueReviewRequests(store.id);
  assert("Due processor sent request", dueResult.sent >= 1);

  const sentRow = await prisma.reviewRequest.findUnique({
    where: { id: webhookResult.reviewRequest.id },
  });
  assert("Webhook review marked SENT", sentRow?.status === "SENT");

  await completeReviewRequest(webhookResult.reviewRequest.id, store.id);

  console.log("\n5. Dashboard + storefront status");
  const stats = await getReviewStats(store.id);
  assert("Stats completed count", stats.completedReviews >= 2);
  assert("Completion rate", stats.reviewCompletionRate > 0);

  const dashboard = await getDashboardMetrics(store.id);
  assert(
    "Dashboard pending metric",
    dashboard.metrics.pendingReviewRequests >= 0
  );
  assert(
    "Dashboard completed metric",
    dashboard.metrics.completedReviews >= 2
  );

  const storefrontStatus = await getCustomerReviewStatus(customer.id);
  assert("Storefront review status", storefrontStatus?.status === "COMPLETED");
  console.log(JSON.stringify(storefrontStatus, null, 2));

  console.log("\n6. Cleanup");
  await prisma.pointsTransaction.deleteMany({
    where: { customer: { storeId: store.id, email: { contains: "review" } } },
  });
  await prisma.reviewRequest.deleteMany({
    where: {
      id: {
        in: [created.reviewRequest.id, webhookResult.reviewRequest.id],
      },
    },
  });
  await prisma.customer.deleteMany({
    where: {
      id: {
        in: [customer.id, webhookResult.customer.id],
      },
    },
  });
  assert("Cleanup complete", true);

  if (failed > 0) {
    throw new Error(`${failed} assertion(s) failed`);
  }

  console.log("\n=== All review checks passed ===");
}

main()
  .catch((err) => {
    console.error("\nVerification failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
