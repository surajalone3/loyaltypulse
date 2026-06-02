import { prisma } from "../shopify.js";
import { ensureLoyaltyProgram } from "./loyaltyProgram.js";

/**
 * Ensures Store and LoyaltyProgram rows exist after a successful OAuth install.
 */
export async function ensureStoreSetup(session) {
  return prisma.$transaction(async (tx) => {
    let store = await tx.store.findUnique({
      where: { shop: session.shop },
    });

    if (!store) {
      store = await tx.store.create({
        data: {
          shop: session.shop,
          accessToken: session.accessToken,
          plan: "FREE",
          isActive: true,
        },
      });
      console.log("Store created:", store.shop);
    } else if (
      session.accessToken &&
      store.accessToken !== session.accessToken
    ) {
      store = await tx.store.update({
        where: { id: store.id },
        data: { accessToken: session.accessToken },
      });
    }

    const { loyaltyProgram } = await ensureLoyaltyProgram(store.id, tx);

    return { store, loyaltyProgram };
  });
}
