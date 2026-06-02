import { shopify } from "../shopify.js";

/**
 * Verifies Shopify webhook HMAC and required headers.
 * Expects req.body to be a raw Buffer (express.raw).
 */
export async function verifyShopifyWebhook(req, res, next) {
  try {
    const rawBody =
      req.body instanceof Buffer
        ? req.body.toString("utf8")
        : typeof req.body === "string"
          ? req.body
          : "";

    if (!rawBody) {
      console.warn("[webhook] Missing request body");
      return res.status(400).json({ error: "Missing request body" });
    }

    const validation = await shopify.webhooks.validate({
      rawBody,
      rawRequest: req,
      rawResponse: res,
    });

    if (!validation.valid) {
      console.warn("[webhook] Verification failed:", validation.reason, validation);
      return res.status(401).json({ error: "Webhook verification failed" });
    }

    console.log("[webhook] Verified:", {
      topic: validation.topic,
      shop: validation.domain,
      webhookId: validation.webhookId,
    });

    req.rawBody = rawBody;
    req.webhook = validation;
    next();
  } catch (error) {
    console.error("[webhook] Verification error:", error);
    res.status(500).json({ error: "Webhook verification error" });
  }
}
