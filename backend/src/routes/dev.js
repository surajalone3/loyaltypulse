import { Router } from "express";
import { prisma } from "../shopify.js";
import {
  processOrdersPaidWebhook,
  OrdersPaidWebhookError,
} from "../services/ordersPaidWebhook.js";
import { redeemReward, RedeemRewardError } from "../services/redeemReward.js";

const router = Router();

function buildFakePaidOrder() {
  const suffix = Date.now();
  const orderId = 9_000_000_000 + (suffix % 1_000_000_000);
  const customerId = 8_000_000_000 + (suffix % 1_000_000_000);

  return {
    id: orderId,
    admin_graphql_api_id: `gid://shopify/Order/${orderId}`,
    name: `#DEV-${suffix}`,
    order_number: suffix,
    email: `dev-customer-${suffix}@loyaltypulse.test`,
    total_price: "50.00",
    customer: {
      id: customerId,
      admin_graphql_api_id: `gid://shopify/Customer/${customerId}`,
      email: `dev-customer-${suffix}@loyaltypulse.test`,
      first_name: "Dev",
      last_name: "Tester",
    },
  };
}

function serializeResult(result) {
  return JSON.parse(
    JSON.stringify(result, (_key, value) =>
      value !== null &&
      typeof value === "object" &&
      typeof value.toNumber === "function"
        ? value.toNumber()
        : value
    )
  );
}

/**
 * POST /api/dev/process-order
 * Development-only: trigger loyalty workflow with a fake orders/paid payload.
 */
router.post("/process-order", async (_req, res) => {
  try {
    const store = await prisma.store.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!store) {
      return res.status(404).json({
        error: "No active store found",
        message: "Install the app on a dev store first (OAuth).",
      });
    }

    const fakeOrder = buildFakePaidOrder();

    console.log("[DEV] Processing fake paid order", {
      shop: store.shop,
      orderId: fakeOrder.id,
      orderName: fakeOrder.name,
      totalPrice: fakeOrder.total_price,
      customerEmail: fakeOrder.customer.email,
    });

    const result = await processOrdersPaidWebhook(store.shop, fakeOrder);

    console.log("[DEV] Completed", {
      shop: store.shop,
      skipped: result.skipped ?? false,
      pointsAwarded: result.pointsAwarded ?? 0,
      tier: result.tier,
    });

    res.status(200).json({
      success: true,
      shop: store.shop,
      fakeOrder,
      result: serializeResult(result),
    });
  } catch (error) {
    if (error instanceof OrdersPaidWebhookError) {
      console.error("[DEV] Failed:", error.message);
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("[DEV] Unexpected error:", error);
    res.status(500).json({ error: "Failed to process fake order" });
  }
});

/**
 * POST /api/dev/redeem
 * Development-only: redeem a reward for an existing customer (no admin session).
 * Body (optional): { customerId, rewardId }
 */
router.post("/redeem", async (req, res) => {
  try {
    const store = await prisma.store.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!store) {
      return res.status(404).json({
        error: "No active store found",
        message: "Install the app on a dev store first (OAuth).",
      });
    }

    let { customerId, rewardId } = req.body ?? {};

    if (!rewardId) {
      const reward = await prisma.reward.findFirst({
        where: { storeId: store.id, isActive: true },
        orderBy: { pointsRequired: "asc" },
      });
      rewardId = reward?.id;
    }

    if (!customerId && rewardId) {
      const reward = await prisma.reward.findFirst({
        where: { id: rewardId, storeId: store.id },
      });
      const customer = reward
        ? await prisma.customer.findFirst({
            where: {
              storeId: store.id,
              totalPoints: { gte: reward.pointsRequired },
            },
            orderBy: { totalPoints: "desc" },
          })
        : null;
      customerId = customer?.id;
    }

    if (!customerId) {
      const customer = await prisma.customer.findFirst({
        where: { storeId: store.id, totalPoints: { gte: 1 } },
        orderBy: { totalPoints: "desc" },
      });
      customerId = customer?.id;
    }

    if (!customerId || !rewardId) {
      return res.status(404).json({
        error: "Test data missing",
        message: "Need a customer with points and an active reward to test redemption.",
      });
    }

    const before = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { totalPoints: true },
    });

    const result = await redeemReward({
      storeId: store.id,
      customerId,
      rewardId,
    });

    console.log("[DEV] Redemption completed", {
      shop: store.shop,
      customerId,
      rewardId,
      couponCode: result.couponCode,
      pointsBalance: result.pointsBalance,
    });

    res.status(200).json({
      success: true,
      shop: store.shop,
      couponCode: result.couponCode,
      pointsBalance: result.pointsBalance,
      pointsSpent: result.pointsSpent,
      pointsBefore: before?.totalPoints ?? null,
      redemption: serializeResult(result.redemption),
      reward: {
        id: result.reward.id,
        name: result.reward.name,
        pointsRequired: result.reward.pointsRequired,
      },
    });
  } catch (error) {
    if (error instanceof RedeemRewardError) {
      console.error("[DEV] Redeem failed:", error.message);
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    console.error("[DEV] Unexpected redeem error:", error);
    res.status(500).json({ error: "Failed to redeem reward" });
  }
});

export default router;
