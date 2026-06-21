import { Router } from "express";
import { verifyAppProxy } from "../middleware/verifyAppProxy.js";
import { getStorefrontLoyalty } from "../services/storefrontLoyalty.js";
import { redeemReward, RedeemRewardError } from "../services/redeemReward.js";
import { applyReferral, ReferralServiceError } from "../services/referrals.js";
import { loadActiveStoreForShop } from "../utils/storefrontStore.js";

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

async function handleRedeem(req, res) {
  try {
    const { shop, loggedInCustomerId } = req.appProxy;
    const { rewardId } = req.body ?? {};

    if (!loggedInCustomerId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "You must be logged in to redeem rewards",
        code: "not_logged_in",
      });
    }

    if (!rewardId || typeof rewardId !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        message: "rewardId is required",
        code: "invalid_request",
      });
    }

    const storeResult = await loadActiveStoreForShop(shop);
    if (storeResult.error) {
      return res.status(storeResult.error.statusCode).json(storeResult.error.body);
    }
    const { store } = storeResult;

    const result = await redeemReward({
      storeId: store.id,
      shopifyCustomerId: loggedInCustomerId,
      rewardId,
    });

    console.log("[storefront] POST /redeem success", {
      shop,
      loggedInCustomerId,
      rewardId,
      couponCode: result.couponCode,
      pointsBalance: result.pointsBalance,
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).json({
      success: true,
      couponCode: result.couponCode,
      shopifyDiscountId: result.shopifyDiscountId,
      discountType: result.discountType,
      discountValue: result.discountValue,
      pointsBalance: result.pointsBalance,
      pointsSpent: result.pointsSpent,
      reward: {
        id: result.reward.id,
        name: result.reward.name,
      },
    });
  } catch (error) {
    if (error instanceof RedeemRewardError) {
      console.warn("[storefront] POST /redeem rejected:", {
        code: error.code,
        message: error.message,
        shop: req.appProxy?.shop,
        loggedInCustomerId: req.appProxy?.loggedInCustomerId,
      });
      return res.status(error.statusCode).json({
        error: error.message,
        message: error.message,
        code: error.code,
      });
    }

    console.error("[storefront] POST /redeem failed:", {
      message: error.message,
      stack: error.stack,
      shop: req.appProxy?.shop,
      loggedInCustomerId: req.appProxy?.loggedInCustomerId,
    });
    res.status(500).json({
      error: "Failed to redeem reward",
      message: "Failed to redeem reward. Please try again later.",
    });
  }
}

/**
 * App proxy: POST /apps/loyaltypulse/redeem
 * Storefront URL: https://{shop}/apps/loyaltypulse/redeem
 */
router.post("/redeem", handleRedeem);

async function handleReferralApply(req, res) {
  try {
    const { shop, loggedInCustomerId } = req.appProxy;
    const { referralCode } = req.body ?? {};

    if (!loggedInCustomerId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "You must be logged in to apply a referral code",
        code: "not_logged_in",
      });
    }

    if (!referralCode || typeof referralCode !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        message: "referralCode is required",
        code: "invalid_request",
      });
    }

    const storeResult = await loadActiveStoreForShop(shop);
    if (storeResult.error) {
      return res.status(storeResult.error.statusCode).json(storeResult.error.body);
    }
    const { store } = storeResult;

    const result = await applyReferral({
      storeId: store.id,
      shop: store.shop,
      shopifyCustomerId: loggedInCustomerId,
      referralCode,
    });

    console.log("[storefront] POST /referrals/apply success", {
      shop,
      loggedInCustomerId,
      referralCode,
      referralId: result.referral?.id,
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "private, no-store");
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof ReferralServiceError) {
      return res.status(error.statusCode).json({
        error: error.message,
        message: error.message,
        code: error.code,
      });
    }

    console.error("[storefront] POST /referrals/apply failed:", error);
    res.status(500).json({
      error: "Failed to apply referral code",
      message: "Failed to apply referral code. Please try again later.",
    });
  }
}

/**
 * App proxy: POST /apps/loyaltypulse/referrals/apply
 */
router.post("/referrals/apply", handleReferralApply);

export default router;
