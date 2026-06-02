import { LOYALTY_PROGRAM_DEFAULTS } from "../constants/loyaltyDefaults.js";
import { prisma } from "../shopify.js";

/**
 * Creates a LoyaltyProgram for a store when missing (used after OAuth and as a safety net on API reads).
 */
export async function ensureLoyaltyProgram(storeId, tx = prisma) {
  const existing = await tx.loyaltyProgram.findUnique({
    where: { storeId },
  });

  if (existing) {
    return { loyaltyProgram: existing, created: false };
  }

  const loyaltyProgram = await tx.loyaltyProgram.create({
    data: {
      storeId,
      ...LOYALTY_PROGRAM_DEFAULTS,
    },
  });

  console.log("LoyaltyProgram created for storeId:", storeId);

  return { loyaltyProgram, created: true };
}
