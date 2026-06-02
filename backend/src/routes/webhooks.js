import { Router } from "express";
import { verifyShopifyWebhook } from "../middleware/verifyShopifyWebhook.js";
import {
  processOrdersPaidWebhook,
  OrdersPaidWebhookError,
} from "../services/ordersPaidWebhook.js";

const router = Router();

/**
 * POST /api/webhooks/orders-paid
 * Shopify orders/paid webhook (raw JSON body required for HMAC).
 */
router.post("/orders-paid", verifyShopifyWebhook, async (req, res) => {
  const shop = req.webhook?.domain;

  try {
    let order;
    try {
      order = JSON.parse(req.rawBody);
    } catch {
      console.error("[webhook:orders-paid] Invalid JSON body");
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const result = await processOrdersPaidWebhook(shop, order);

    res.status(200).json({
      success: true,
      shop,
      skipped: result.skipped ?? false,
      reason: result.reason,
      orderId: result.shopifyOrderId,
      customerId: result.customer?.id,
      pointsAwarded: result.pointsAwarded ?? 0,
      tier: result.tier,
    });
  } catch (error) {
    if (error instanceof OrdersPaidWebhookError) {
      console.error("[webhook:orders-paid] Handler error:", error.message);
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("[webhook:orders-paid] Unexpected error:", error);
    res.status(500).json({ error: "Failed to process order webhook" });
  }
});

export default router;
