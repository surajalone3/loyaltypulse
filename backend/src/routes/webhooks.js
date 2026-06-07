import { Router } from "express";
import { verifyShopifyWebhook } from "../middleware/verifyShopifyWebhook.js";
import {
  processOrdersPaidWebhook,
  OrdersPaidWebhookError,
} from "../services/ordersPaidWebhook.js";

const router = Router();

function logIncomingWebhook(req) {
  console.log("[webhook:orders-paid] Incoming request", {
    method: req.method,
    url: req.originalUrl,
    topic: req.get("x-shopify-topic") ?? null,
    shop: req.get("x-shopify-shop-domain") ?? null,
    webhookId: req.get("x-shopify-webhook-id") ?? null,
    apiVersion: req.get("x-shopify-api-version") ?? null,
    bodyBytes: req.body instanceof Buffer ? req.body.length : 0,
  });
}

/**
 * POST /api/webhooks/orders-paid
 * Shopify orders/paid webhook (raw JSON body required for HMAC).
 */
router.post("/orders-paid", (req, _res, next) => {
  logIncomingWebhook(req);
  next();
}, verifyShopifyWebhook, async (req, res) => {
  const shop = req.webhook?.domain;

  try {
    let order;
    try {
      order = JSON.parse(req.rawBody);
    } catch {
      console.error("[webhook:orders-paid] Invalid JSON body");
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    console.log("[webhook:orders-paid] Parsed order payload", {
      shop,
      orderId: order.id ?? null,
      orderName: order.name ?? null,
      customerId: order.customer?.id ?? null,
      customerEmail: order.customer?.email ?? order.email ?? null,
      totalPrice: order.total_price ?? order.current_total_price ?? null,
    });

    const result = await processOrdersPaidWebhook(shop, order);

    console.log("[webhook:orders-paid] Handler completed", {
      shop,
      skipped: result.skipped ?? false,
      reason: result.reason ?? null,
      customerId: result.customer?.id ?? null,
      shopifyCustomerId: result.customer?.shopifyCustomerId ?? null,
      pointsAwarded: result.pointsAwarded ?? 0,
    });

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
