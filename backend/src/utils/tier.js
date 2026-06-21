import {
  resolveTierFromLifetimeSpend,
  getLoyaltyTiersForStore,
  sortTiers,
} from "../services/loyaltyTiers.js";

export async function resolveCustomerTier(storeId, lifetimeSpend, tx) {
  const tiers = await getLoyaltyTiersForStore(storeId, tx);
  const formatted = sortTiers(tiers).map((tier) => ({
    tierKey: tier.tierKey,
    name: tier.name,
    minLifetimeSpend: Number(tier.minLifetimeSpend),
    color: tier.color,
    benefitsDescription: tier.benefitsDescription,
    enabled: tier.enabled,
    sortOrder: tier.sortOrder,
  }));

  return resolveTierFromLifetimeSpend(lifetimeSpend, formatted);
}
