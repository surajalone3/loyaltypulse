import { prisma } from "../shopify.js";
import { getPublicProgramLabel } from "./loyaltySettings.js";
import {
  formatStorefrontTierPayload,
  getLoyaltyTiersForStore,
} from "./loyaltyTiers.js";
import { getStorefrontReferralPayload } from "./referrals.js";
import { getCustomerReviewStatus } from "./reviewRequests.js";

function shopifyCustomerGid(numericId) {
  return `gid://shopify/Customer/${numericId}`;
}

function formatRewardForStorefront(reward, pointsBalance) {
  const pointsNeeded = Math.max(0, reward.pointsRequired - pointsBalance);

  return {
    id: reward.id,
    name: reward.name,
    description: reward.description,
    pointsRequired: reward.pointsRequired,
    canRedeem: pointsBalance >= reward.pointsRequired,
    pointsNeeded,
  };
}

/**
 * Storefront loyalty payload for a logged-in Shopify customer.
 */
export async function getStorefrontLoyalty(shop, loggedInCustomerId) {
  const store = await prisma.store.findUnique({
    where: { shop },
    include: {
      loyaltyProgram: true,
    },
  });

  if (!store) {
    return {
      available: false,
      reason: "store_not_found",
      message: "Loyalty program is not available for this store.",
    };
  }

  if (!store.isActive) {
    return {
      available: false,
      reason: "store_inactive",
      message: "Loyalty program is temporarily unavailable.",
    };
  }

  const loyaltyProgram = store.loyaltyProgram;

  if (!loyaltyProgram) {
    return {
      available: false,
      reason: "program_not_configured",
      message: "Loyalty program is not configured yet.",
    };
  }

  const programLabel = getPublicProgramLabel(loyaltyProgram);

  const base = {
    available: true,
    programActive: loyaltyProgram.isActive,
    programName: programLabel,
    pointsName: programLabel,
    pointsPerDollar: loyaltyProgram.pointsPerDollar,
    welcomeBonus: loyaltyProgram.welcomeBonus,
    referralBonus: loyaltyProgram.referralBonus,
    shop: store.shop,
  };

  if (!loggedInCustomerId) {
    return {
      ...base,
      loggedIn: false,
      enrolled: false,
      message: "Log in to view your points balance and rewards.",
    };
  }

  const customer = await prisma.customer.findUnique({
    where: {
      storeId_shopifyCustomerId: {
        storeId: store.id,
        shopifyCustomerId: shopifyCustomerGid(loggedInCustomerId),
      },
    },
  });

  if (!customer) {
    return {
      ...base,
      loggedIn: true,
      enrolled: false,
      message: "Make a purchase to start earning loyalty points.",
    };
  }

  const rewards = await prisma.reward.findMany({
    where: {
      storeId: store.id,
      isActive: true,
    },
    orderBy: { pointsRequired: "asc" },
  });

  const loyaltyTiers = await getLoyaltyTiersForStore(store.id);
  const tierPayload = formatStorefrontTierPayload(customer, loyaltyTiers);
  const referrals = await getStorefrontReferralPayload(store, customer);
  const reviewStatus = await getCustomerReviewStatus(customer.id);

  return {
    ...base,
    loggedIn: true,
    enrolled: true,
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
    },
    pointsBalance: customer.totalPoints,
    tier: customer.tier,
    tierInfo: tierPayload,
    referrals,
    reviewStatus,
    lifetimeSpend: Number(customer.lifetimeSpend),
    rewards: rewards.map((reward) =>
      formatRewardForStorefront(reward, customer.totalPoints)
    ),
  };
}
