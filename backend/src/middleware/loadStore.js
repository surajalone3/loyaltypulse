import { prisma } from "../shopify.js";

/**
 * Resolves the merchant Store from the authenticated Shopify session (offline shop).
 */
export async function loadStore(req, res, next) {
  try {
    const { session } = res.locals.shopify;

    if (!session?.shop) {
      return res.status(401).json({ error: "Unauthorized", message: "Missing shop in session" });
    }

    const store = await prisma.store.findUnique({
      where: { shop: session.shop },
    });

    if (!store) {
      return res.status(404).json({
        error: "Store not found",
        message: "Complete app installation for this shop before using loyalty settings.",
      });
    }

    if (!store.isActive) {
      return res.status(403).json({
        error: "Store inactive",
        message: "This store account is not active.",
      });
    }

    res.locals.store = store;
    next();
  } catch (error) {
    console.error("loadStore failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load store context.",
    });
  }
}
