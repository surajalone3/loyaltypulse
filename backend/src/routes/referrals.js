import { Router } from "express";
import { loadStore } from "../middleware/loadStore.js";
import {
  applyReferral,
  getReferralLinkForCustomer,
  listReferrals,
  ReferralServiceError,
} from "../services/referrals.js";

const router = Router();

router.use(loadStore);

/**
 * GET /api/referrals — referral list and summary for the store
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const payload = await listReferrals(store.id, req.query);
    res.json({
      shop: store.shop,
      ...payload,
    });
  } catch (error) {
    console.error("GET /api/referrals failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load referrals.",
    });
  }
});

/**
 * GET /api/referrals/link — referral URL for a customer
 */
router.get("/link", async (req, res) => {
  try {
    const store = res.locals.store;
    const customerId =
      typeof req.query.customerId === "string"
        ? req.query.customerId.trim()
        : "";

    if (!customerId) {
      return res.status(400).json({
        error: "Validation failed",
        message: "customerId query parameter is required",
      });
    }

    const payload = await getReferralLinkForCustomer(store, customerId);
    res.json(payload);
  } catch (error) {
    if (error instanceof ReferralServiceError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    console.error("GET /api/referrals/link failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load referral link.",
    });
  }
});

/**
 * POST /api/referrals/apply — attach a referral code to a customer (admin/testing)
 */
router.post("/apply", async (req, res) => {
  try {
    const store = res.locals.store;
    const { customerId, referralCode } = req.body ?? {};

    if (!customerId || typeof customerId !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        message: "customerId is required",
      });
    }

    if (!referralCode || typeof referralCode !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        message: "referralCode is required",
      });
    }

    const result = await applyReferral({
      storeId: store.id,
      shop: store.shop,
      referredCustomerId: customerId,
      referralCode,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof ReferralServiceError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    console.error("POST /api/referrals/apply failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to apply referral code.",
    });
  }
});

export default router;
