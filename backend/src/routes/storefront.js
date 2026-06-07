import { Router } from "express";
import { verifyAppProxy } from "../middleware/verifyAppProxy.js";
import { getStorefrontLoyalty } from "../services/storefrontLoyalty.js";

const router = Router();

function logStorefrontRequest(label, req) {
  console.log(label, {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    shop: req.query.shop ?? null,
  });
}

/**
 * GET /apps/loyaltypulse/health
 * Direct tunnel connectivity check (no HMAC). Use with:
 * curl -H "ngrok-skip-browser-warning: true" https://{HOST}/apps/loyaltypulse/health
 */
router.get("/health", (req, res) => {
  logStorefrontRequest("[storefront] health check", req);
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    ok: true,
    service: "loyaltypulse-storefront",
    timestamp: new Date().toISOString(),
  });
});

router.use((req, _res, next) => {
  logStorefrontRequest("[storefront] incoming request", req);
  next();
});

router.use(verifyAppProxy);

async function handleLoyalty(req, res) {
  try {
    const { shop, loggedInCustomerId } = req.appProxy;
    const payload = await getStorefrontLoyalty(shop, loggedInCustomerId);

    console.log("[storefront] GET /loyalty success", {
      shop,
      loggedInCustomerId,
      available: payload.available,
      loggedIn: payload.loggedIn,
      enrolled: payload.enrolled,
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).json(payload);
  } catch (error) {
    console.error("[storefront] GET /loyalty failed:", {
      message: error.message,
      stack: error.stack,
      shop: req.appProxy?.shop,
      loggedInCustomerId: req.appProxy?.loggedInCustomerId,
    });
    res.status(500).json({
      available: false,
      error: "Failed to load loyalty data",
    });
  }
}

/**
 * App proxy: GET /apps/loyaltypulse/loyalty
 * Storefront URL: https://{shop}/apps/loyaltypulse/loyalty
 */
router.get("/loyalty", handleLoyalty);

export default router;
