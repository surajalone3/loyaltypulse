import { Router } from "express";
import { shopify } from "../shopify.js";
import { validateSession } from "../middleware/validateSession.js";
import loyaltyRoutes from "./loyalty.js";
import customersRoutes from "./customers.js";
import transactionsRoutes from "./transactions.js";
import dashboardRoutes from "./dashboard.js";

const router = Router();

router.use(validateSession);

router.use("/loyalty", loyaltyRoutes);
router.use("/customers", customersRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/dashboard", dashboardRoutes);

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

/**
 * GET /api/products/count — example authenticated Shopify Admin API call
 */
router.get("/products/count", async (_req, res) => {
  const { session } = res.locals.shopify;
  const client = new shopify.clients.Graphql({ session });

  const response = await client.request(`#graphql
    query {
      productsCount {
        count
      }
    }
  `);

  res.json({
    count: response.data?.productsCount?.count ?? 0,
  });
});

export default router;
