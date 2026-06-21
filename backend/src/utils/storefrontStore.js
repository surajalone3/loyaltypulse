import { prisma } from "../shopify.js";

/**
 * Loads an active store row for app-proxy requests.
 * Returns `{ store }` or `{ error: { statusCode, body } }`.
 */
export async function loadActiveStoreForShop(shop) {
  const store = await prisma.store.findUnique({
    where: { shop },
    select: { id: true, shop: true, isActive: true },
  });

  if (!store) {
    return {
      error: {
        statusCode: 404,
        body: {
          error: "Store not found",
          message: "Loyalty program is not available for this store",
          code: "store_not_found",
        },
      },
    };
  }

  if (!store.isActive) {
    return {
      error: {
        statusCode: 403,
        body: {
          error: "Store inactive",
          message: "Loyalty program is temporarily unavailable",
          code: "store_inactive",
        },
      },
    };
  }

  return { store };
}
