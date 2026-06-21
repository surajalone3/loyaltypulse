import { prisma } from "../shopify.js";
import {
  DEFAULT_LOYALTY_TIERS,
  TIER_KEYS,
} from "../constants/tierDefaults.js";

export class LoyaltyTiersError extends Error {
  constructor(message, statusCode = 400, fields = []) {
    super(message);
    this.name = "LoyaltyTiersError";
    this.statusCode = statusCode;
    this.fields = fields;
  }
}

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{6})$/;

function formatTierRow(tier) {
  return {
    tierKey: tier.tierKey,
    name: tier.name,
    minLifetimeSpend: Number(tier.minLifetimeSpend),
    color: tier.color,
    benefitsDescription: tier.benefitsDescription,
    enabled: tier.enabled,
    sortOrder: tier.sortOrder,
  };
}

export function sortTiers(tiers) {
  return [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getEnabledTiers(tiers) {
  return sortTiers(tiers).filter((tier) => tier.enabled);
}

/**
 * Highest enabled tier whose threshold the customer has met.
 */
export function resolveTierFromLifetimeSpend(lifetimeSpend, tiers) {
  const spend = Number(lifetimeSpend);
  const enabled = getEnabledTiers(tiers);

  if (enabled.length === 0) {
    return "BRONZE";
  }

  let matched = enabled[0];

  for (const tier of enabled) {
    if (spend >= Number(tier.minLifetimeSpend)) {
      matched = tier;
    }
  }

  return matched.tierKey;
}

export function getTierProgress(lifetimeSpend, tiers, currentTierKey) {
  const spend = Number(lifetimeSpend);
  const enabled = getEnabledTiers(tiers);
  const currentIndex = enabled.findIndex((tier) => tier.tierKey === currentTierKey);
  const currentTier =
    enabled[currentIndex >= 0 ? currentIndex : 0] ?? enabled[0] ?? null;

  if (!currentTier) {
    return {
      currentTier: null,
      nextTier: null,
      spendToNextTier: null,
      nextTierMessage: null,
    };
  }

  const nextTier =
    currentIndex >= 0 && currentIndex < enabled.length - 1
      ? enabled[currentIndex + 1]
      : null;

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      spendToNextTier: 0,
      nextTierMessage: `You've reached the highest tier — ${currentTier.name}.`,
    };
  }

  const spendToNextTier = Math.max(
    0,
    Math.ceil(Number(nextTier.minLifetimeSpend) - spend)
  );

  return {
    currentTier,
    nextTier,
    spendToNextTier,
    nextTierMessage: `Spend $${spendToNextTier.toLocaleString()} more to reach ${nextTier.name}`,
  };
}

export async function ensureLoyaltyTiers(storeId, tx = prisma) {
  const existing = await tx.loyaltyTier.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
  });

  if (existing.length >= TIER_KEYS.length) {
    return { tiers: existing, created: false };
  }

  const existingKeys = new Set(existing.map((tier) => tier.tierKey));
  const missing = DEFAULT_LOYALTY_TIERS.filter(
    (tier) => !existingKeys.has(tier.tierKey)
  );

  if (missing.length === 0) {
    return { tiers: existing, created: false };
  }

  await tx.loyaltyTier.createMany({
    data: missing.map((tier) => ({
      storeId,
      ...tier,
      minLifetimeSpend: tier.minLifetimeSpend,
    })),
    skipDuplicates: true,
  });

  const tiers = await tx.loyaltyTier.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
  });

  return { tiers, created: true };
}

export async function getLoyaltyTiersForStore(storeId, tx = prisma) {
  const { tiers } = await ensureLoyaltyTiers(storeId, tx);
  return tiers;
}

export async function getLoyaltyTiers(store) {
  const tiers = await getLoyaltyTiersForStore(store.id);
  return {
    shop: store.shop,
    tiers: sortTiers(tiers).map(formatTierRow),
    updatedAt: tiers.reduce(
      (latest, tier) =>
        !latest || tier.updatedAt > latest ? tier.updatedAt : latest,
      null
    ),
  };
}

function validateTierPayload(tier, index) {
  const errors = [];
  const prefix = `tiers[${index}]`;

  if (!tier?.tierKey || !TIER_KEYS.includes(tier.tierKey)) {
    errors.push(`${prefix}.tierKey must be one of ${TIER_KEYS.join(", ")}`);
  }

  if (typeof tier?.name !== "string" || tier.name.trim().length === 0) {
    errors.push(`${prefix}.name is required`);
  } else if (tier.name.trim().length > 50) {
    errors.push(`${prefix}.name must be 50 characters or fewer`);
  }

  const minSpend = Number(tier?.minLifetimeSpend);
  if (Number.isNaN(minSpend) || minSpend < 0) {
    errors.push(`${prefix}.minLifetimeSpend must be 0 or greater`);
  }

  if (typeof tier?.color !== "string" || !HEX_COLOR_RE.test(tier.color)) {
    errors.push(`${prefix}.color must be a hex color like #CD7F32`);
  }

  if (
    tier?.benefitsDescription != null &&
    typeof tier.benefitsDescription !== "string"
  ) {
    errors.push(`${prefix}.benefitsDescription must be a string`);
  }

  if (typeof tier?.enabled !== "boolean") {
    errors.push(`${prefix}.enabled must be a boolean`);
  }

  return errors;
}

export function validateLoyaltyTiersUpdate(body) {
  const errors = [];
  const tiers = body?.tiers;

  if (!Array.isArray(tiers)) {
    return { errors: ["tiers must be an array"], tiers: null };
  }

  if (tiers.length !== TIER_KEYS.length) {
    errors.push(`tiers must include exactly ${TIER_KEYS.length} entries`);
  }

  const keys = new Set();
  for (let i = 0; i < tiers.length; i++) {
    errors.push(...validateTierPayload(tiers[i], i));
    if (tiers[i]?.tierKey) {
      keys.add(tiers[i].tierKey);
    }
  }

  if (keys.size !== tiers.length) {
    errors.push("Each tierKey must be unique");
  }

  for (const key of TIER_KEYS) {
    if (!keys.has(key)) {
      errors.push(`Missing tier configuration for ${key}`);
    }
  }

  const normalized = sortTiers(
    tiers.map((tier) => ({
      tierKey: tier.tierKey,
      name: tier.name.trim(),
      minLifetimeSpend: Number(tier.minLifetimeSpend),
      color: tier.color,
      benefitsDescription: String(tier.benefitsDescription ?? "").trim(),
      enabled: tier.enabled,
      sortOrder: DEFAULT_LOYALTY_TIERS.find((d) => d.tierKey === tier.tierKey)
        ?.sortOrder,
    }))
  );

  const enabled = normalized.filter((tier) => tier.enabled);
  if (enabled.length === 0) {
    errors.push("At least one tier must remain enabled");
  }

  const bronze = normalized.find((tier) => tier.tierKey === "BRONZE");
  if (bronze?.enabled && bronze.minLifetimeSpend !== 0) {
    errors.push("Bronze minLifetimeSpend must be 0 when enabled");
  }

  for (let i = 1; i < enabled.length; i++) {
    if (enabled[i].minLifetimeSpend <= enabled[i - 1].minLifetimeSpend) {
      errors.push(
        "Enabled tier thresholds must increase (Bronze < Silver < Gold < Platinum)"
      );
      break;
    }
  }

  return { errors, tiers: errors.length === 0 ? normalized : null };
}

export async function recalculateStoreCustomerTiers(storeId, tx = prisma) {
  const tiers = await getLoyaltyTiersForStore(storeId, tx);
  const formatted = sortTiers(tiers).map(formatTierRow);
  const customers = await tx.customer.findMany({
    where: { storeId },
    select: { id: true, lifetimeSpend: true },
  });

  let updated = 0;
  for (const customer of customers) {
    const tier = resolveTierFromLifetimeSpend(customer.lifetimeSpend, formatted);
    await tx.customer.update({
      where: { id: customer.id },
      data: { tier },
    });
    updated += 1;
  }

  return updated;
}

export async function updateLoyaltyTiers(store, body) {
  const { errors, tiers } = validateLoyaltyTiersUpdate(body);

  if (errors.length > 0) {
    throw new LoyaltyTiersError(errors.join("; "), 400, errors);
  }

  await ensureLoyaltyTiers(store.id);

  await prisma.$transaction(async (tx) => {
    for (const tier of tiers) {
      await tx.loyaltyTier.update({
        where: {
          storeId_tierKey: {
            storeId: store.id,
            tierKey: tier.tierKey,
          },
        },
        data: {
          name: tier.name,
          minLifetimeSpend: tier.minLifetimeSpend,
          color: tier.color,
          benefitsDescription: tier.benefitsDescription,
          enabled: tier.enabled,
          sortOrder: tier.sortOrder,
        },
      });
    }

    await recalculateStoreCustomerTiers(store.id, tx);
  });

  return getLoyaltyTiers(store);
}

export async function getTierDistribution(storeId) {
  const tiers = await getLoyaltyTiersForStore(storeId);
  const formatted = sortTiers(tiers).map(formatTierRow);

  const counts = await prisma.customer.groupBy({
    by: ["tier"],
    where: { storeId },
    _count: { _all: true },
  });

  const countByKey = Object.fromEntries(
    counts.map((row) => [row.tier, row._count._all])
  );

  return formatted.map((tier) => ({
    tierKey: tier.tierKey,
    name: tier.name,
    color: tier.color,
    enabled: tier.enabled,
    count: countByKey[tier.tierKey] ?? 0,
  }));
}

export function formatStorefrontTierPayload(customer, tiers) {
  const formatted = sortTiers(tiers).map(formatTierRow);
  const tierKey = customer.tier;
  const tierConfig =
    formatted.find((tier) => tier.tierKey === tierKey) ??
    formatted.find((tier) => tier.enabled) ??
    formatted[0];

  const progress = getTierProgress(
    customer.lifetimeSpend,
    formatted,
    tierKey
  );

  return {
    key: tierConfig?.tierKey ?? tierKey,
    name: tierConfig?.name ?? tierKey,
    color: tierConfig?.color ?? "#CD7F32",
    benefitsDescription: tierConfig?.benefitsDescription ?? "",
    lifetimeSpend: Number(customer.lifetimeSpend),
    nextTier: progress.nextTier
      ? {
          key: progress.nextTier.tierKey,
          name: progress.nextTier.name,
          minLifetimeSpend: Number(progress.nextTier.minLifetimeSpend),
          color: progress.nextTier.color,
        }
      : null,
    spendToNextTier: progress.spendToNextTier,
    nextTierMessage: progress.nextTierMessage,
  };
}
