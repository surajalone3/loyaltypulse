import { Router } from "express";
import { loadStore } from "../middleware/loadStore.js";
import {
  getLoyaltySettings,
  updateLoyaltySettings,
  LoyaltySettingsError,
} from "../services/loyaltySettings.js";

const router = Router();

router.use(loadStore);

/**
 * GET /api/settings — loyalty program settings for the authenticated store
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const settings = await getLoyaltySettings(store);
    res.json(settings);
  } catch (error) {
    console.error("GET /api/settings failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load loyalty program settings.",
    });
  }
});

/**
 * PUT /api/settings — update loyalty program settings
 */
router.put("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const settings = await updateLoyaltySettings(store, req.body ?? {});
    res.json(settings);
  } catch (error) {
    if (error instanceof LoyaltySettingsError) {
      return res.status(error.statusCode).json({
        error: "Validation failed",
        message: error.message,
        fields: error.fields,
      });
    }

    console.error("PUT /api/settings failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update loyalty program settings.",
    });
  }
});

export default router;
