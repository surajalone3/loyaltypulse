import { Router } from "express";
import { validateSession } from "../middleware/validateSession.js";
import customersRoutes from "./customers.js";
import transactionsRoutes from "./transactions.js";
import dashboardRoutes from "./dashboard.js";
import rewardsRoutes from "./rewards.js";
import reviewsRoutes from "./reviews.js";
import settingsRoutes from "./settings.js";
import tiersRoutes from "./tiers.js";
import referralsRoutes from "./referrals.js";

const router = Router();

router.use(validateSession);

router.use("/customers", customersRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/rewards", rewardsRoutes);
router.use("/reviews", reviewsRoutes);
router.use("/settings", settingsRoutes);
router.use("/tiers", tiersRoutes);
router.use("/referrals", referralsRoutes);

/**
 * GET /api — health check with shop context
 */
router.get("/", async (_req, res) => {
  const { session } = res.locals.shopify;

  res.json({
    app: "LoyaltyPulse",
    shop: session.shop,
    scope: session.scope,
    isOnline: session.isOnline,
  });
});

export default router;
