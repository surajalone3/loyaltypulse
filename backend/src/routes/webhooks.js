import { Router } from "express";
import { verifyShopifyWebhook } from "../middleware/verifyShopifyWebhook.js";
import {
  processOrdersPaidWebhook,
  OrdersPaidWebhookError,
} from "../services/ordersPaidWebhook.js";
import {
  handleAppUninstalled,
  handleCustomersDataRequest,
  handleCustomersRedact,
  handleShopRedact,
} from "../services/complianceWebhooks.js";

const router = Router();

function logIncomingWebhook(req, label) {
  console.log(`[webhook:${label}] Incoming request`, {
    method: req.method,
    url: req.originalUrl,
    topic: req.get("x-shopify-topic") ?? null,
    shop: req.get("x-shopify-shop-domain") ?? null,
    webhookId: req.get("x-shopify-webhook-id") ?? null,
    bodyBytes: req.body instanceof Buffer ? req.body.length : 0,
  });
}

function parseWebhookBody(req, res) {
  try {
    return JSON.parse(req.rawBody);
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return null;
  }
}

const webhookChain = [verifyShopifyWebhook];

/**
 * POST /api/webhooks/orders-paid
 */
router.post(
  "/orders-paid",
  (req, _res, next) => {
    logIncomingWebhook(req, "orders-paid");
    next();
  },
  ...webhookChain,
  async (req, res) => {
    const shop = req.webhook?.domain;

    try {
      const order = parseWebhookBody(req, res);
      if (!order) {
        return;
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
        return res.status(error.statusCode).json({ error: error.message });
      }

      console.error("[webhook:orders-paid] Unexpected error:", error);
      res.status(500).json({ error: "Failed to process order webhook" });
    }
  }
);

/**
 * POST /api/webhooks/compliance
 * Unified GDPR compliance endpoint (Shopify TOML compliance_topics).
 */
router.post(
  "/compliance",
  (req, _res, next) => {
    logIncomingWebhook(req, "compliance");
    next();
  },
  ...webhookChain,
  async (req, res) => {
    const shop = req.webhook?.domain;
    const topic = req.get("x-shopify-topic") ?? "";
    const payload = parseWebhookBody(req, res);
    if (!payload) {
      return;
    }

    let result;

    switch (topic) {
      case "customers/data_request":
        result = await handleCustomersDataRequest(shop, payload);
        break;
      case "customers/redact":
        result = await handleCustomersRedact(shop, payload);
        break;
      case "shop/redact":
        result = await handleShopRedact(shop);
        break;
      default:
        return res.status(400).json({ error: `Unsupported compliance topic: ${topic}` });
    }

    res.status(200).json({ success: true, topic, ...result });
  }
);

/**
 */
router.post(
  "/customers/data-request",
  (req, _res, next) => {
    logIncomingWebhook(req, "customers/data-request");
    next();
  },
  ...webhookChain,
  async (req, res) => {
    const shop = req.webhook?.domain;
    const payload = parseWebhookBody(req, res);
    if (!payload) {
      return;
    }

    const result = await handleCustomersDataRequest(shop, payload);
    res.status(200).json({ success: true, ...result });
  }
);

/**
 * POST /api/webhooks/customers/redact
 */
router.post(
  "/customers/redact",
  (req, _res, next) => {
    logIncomingWebhook(req, "customers/redact");
    next();
  },
  ...webhookChain,
  async (req, res) => {
    const shop = req.webhook?.domain;
    const payload = parseWebhookBody(req, res);
    if (!payload) {
      return;
    }

    const result = await handleCustomersRedact(shop, payload);
    res.status(200).json({ success: true, ...result });
  }
);

/**
 * POST /api/webhooks/shop/redact
 */
router.post(
  "/shop/redact",
  (req, _res, next) => {
    logIncomingWebhook(req, "shop/redact");
    next();
  },
  ...webhookChain,
  async (req, res) => {
    const shop = req.webhook?.domain;
    const payload = parseWebhookBody(req, res);
    if (!payload) {
      return;
    }

    const result = await handleShopRedact(shop);
    res.status(200).json({ success: true, ...result });
  }
);

/**
 * POST /api/webhooks/app-uninstalled
 */
router.post(
  "/app-uninstalled",
  (req, _res, next) => {
    logIncomingWebhook(req, "app-uninstalled");
    next();
  },
  ...webhookChain,
  async (req, res) => {
    const shop = req.webhook?.domain;
    const result = await handleAppUninstalled(shop);
    res.status(200).json({ success: true, ...result });
  }
);

export default router;
