import { Router } from "express";
import { loadStore } from "../middleware/loadStore.js";
import { getDashboardMetrics } from "../services/dashboardMetrics.js";

const router = Router();

router.use(loadStore);

/**
 * GET /api/dashboard — loyalty dashboard metrics for the authenticated store
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const payload = await getDashboardMetrics(store.id);

    res.json(payload);
  } catch (error) {
    console.error("GET /api/dashboard failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load dashboard metrics.",
    });
  }
});

export default router;
