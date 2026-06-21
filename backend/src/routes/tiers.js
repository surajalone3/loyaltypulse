import { Router } from "express";
import { loadStore } from "../middleware/loadStore.js";
import {
  getLoyaltyTiers,
  updateLoyaltyTiers,
  LoyaltyTiersError,
} from "../services/loyaltyTiers.js";

const router = Router();

router.use(loadStore);

/**
 * GET /api/tiers — configurable loyalty tiers for the authenticated store
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const payload = await getLoyaltyTiers(store);
    res.json(payload);
  } catch (error) {
    console.error("GET /api/tiers failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load loyalty tiers.",
    });
  }
});

/**
 * PUT /api/tiers — update loyalty tier configuration
 */
router.put("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const payload = await updateLoyaltyTiers(store, req.body ?? {});
    res.json(payload);
  } catch (error) {
    if (error instanceof LoyaltyTiersError) {
      return res.status(error.statusCode).json({
        error: "Validation failed",
        message: error.message,
        fields: error.fields,
      });
    }

    console.error("PUT /api/tiers failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update loyalty tiers.",
    });
  }
});

export default router;
