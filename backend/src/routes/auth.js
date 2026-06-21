import { Router } from "express";
import { shopify } from "../shopify.js";
import { ensureStoreSetup } from "../services/ensureStoreSetup.js";
import { registerOrdersPaidWebhook, registerAppUninstalledWebhook } from "../services/registerWebhooks.js";

const router = Router();

/**
 * GET /auth?shop=my-store.myshopify.com
 * Starts Shopify OAuth 2.0 install flow (validates shop, redirects to grant screen).
 */
router.get("/", async (req, res) => {
  const shop = shopify.utils.sanitizeShop(req.query.shop, false);

  if (!shop) {
    return res.status(400).send("Missing or invalid shop parameter");
  }

  await shopify.auth.begin({
    shop,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

/**
 * GET /auth/callback?code=...&hmac=...&shop=...&state=...
 * Completes OAuth; verifies HMAC and exchanges code for access token.
 */
router.get("/callback", async (req, res) => {
  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callbackResponse;

    await ensureStoreSetup(session);

    try {
      const [ordersPaidResult, appUninstalledResult] = await Promise.all([
        registerOrdersPaidWebhook(session),
        registerAppUninstalledWebhook(session),
      ]);
      if (process.env.NODE_ENV !== "production") {
        console.log("[auth] Webhook registration:", {
          ordersPaid: ordersPaidResult,
          appUninstalled: appUninstalledResult,
        });
      }
    } catch (webhookError) {
      console.warn(
        "[auth] Unexpected webhook registration failure (OAuth continues):",
        webhookError.message ?? webhookError
      );
    }

    const host = shopify.utils.sanitizeHost(req.query.host, false);

    // Embedded: redirects to Shopify Admin (/apps/{apiKey}), which iframes your App URL (HOST)
    const redirectUrl = shopify.config.isEmbeddedApp
      ? await shopify.auth.getEmbeddedAppUrl({
          rawRequest: req,
          rawResponse: res,
        })
      : `${process.env.HOST?.replace(/\/$/, "") ?? ""}/?shop=${session.shop}${host ? `&host=${host}` : ""}`;

    if (process.env.NODE_ENV !== "production") {
      console.log("[auth] OAuth complete, redirecting to:", redirectUrl);
    }

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).send("Authentication failed");
  }
});

export default router;
