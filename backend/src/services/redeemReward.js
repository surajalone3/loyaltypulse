import crypto from "crypto";
import { prisma } from "../shopify.js";
import {
  createShopifyDiscountCode,
  ShopifyDiscountError,
} from "./shopifyDiscount.js";

export class RedeemRewardError extends Error {
  constructor(message, statusCode = 400, code = "redeem_failed") {
    super(message);
    this.name = "RedeemRewardError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const COUPON_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function shopifyCustomerGid(numericId) {
  if (String(numericId).startsWith("gid://")) {
    return numericId;
  }
  return `gid://shopify/Customer/${numericId}`;
}

function generateCouponCode() {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    const index = crypto.randomInt(0, COUPON_CHARS.length);
    suffix += COUPON_CHARS[index];
  }
  return `LP-${suffix}`;
}

async function generateUniqueCouponCode(tx) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const couponCode = generateCouponCode();
    const existing = await tx.redemption.findUnique({
      where: { couponCode },
      select: { id: true },
    });
    if (!existing) {
      return couponCode;
    }
  }
  throw new RedeemRewardError(
    "Failed to generate coupon code",
    500,
    "coupon_generation_failed"
  );
}

/**
 * Redeems a reward: creates Shopify discount, deducts points, persists redemption.
 */
export async function redeemReward({
  storeId,
  customerId = null,
  shopifyCustomerId = null,
  rewardId,
}) {
  if (!storeId) {
    throw new RedeemRewardError("storeId is required", 400, "invalid_request");
  }

  if (!rewardId) {
    throw new RedeemRewardError("rewardId is required", 400, "invalid_request");
  }

  if (!customerId && !shopifyCustomerId) {
    throw new RedeemRewardError(
      "customerId or shopifyCustomerId is required",
      400,
      "invalid_request"
    );
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
  });

  if (!store) {
    throw new RedeemRewardError("Store not found", 404, "store_not_found");
  }

  if (!store.isActive) {
    throw new RedeemRewardError("Store is inactive", 403, "store_inactive");
  }

  let customer;

  if (customerId) {
    customer = await prisma.customer.findFirst({
      where: { id: customerId, storeId },
    });
  } else {
    customer = await prisma.customer.findUnique({
      where: {
        storeId_shopifyCustomerId: {
          storeId,
          shopifyCustomerId: shopifyCustomerGid(shopifyCustomerId),
        },
      },
    });
  }

  if (!customer) {
    throw new RedeemRewardError("Customer not found", 404, "customer_not_found");
  }

  const reward = await prisma.reward.findFirst({
    where: { id: rewardId, storeId, isActive: true },
  });

  if (!reward) {
    throw new RedeemRewardError("Reward not found", 404, "reward_not_found");
  }

  if (customer.totalPoints < reward.pointsRequired) {
    throw new RedeemRewardError(
      "Not enough points to redeem this reward",
      400,
      "insufficient_points"
    );
  }

  const couponCode = await generateUniqueCouponCode(prisma);
  const pointsSpent = reward.pointsRequired;
  const discountType = reward.discountType;
  const discountValue = Number(reward.discountValue);

  let shopifyDiscount;

  try {
    shopifyDiscount = await createShopifyDiscountCode({
      store,
      code: couponCode,
      title: `LoyaltyPulse: ${reward.name}`,
      discountType,
      discountValue,
      customerShopifyGid: customer.shopifyCustomerId,
    });
  } catch (error) {
    if (error instanceof ShopifyDiscountError) {
      throw new RedeemRewardError(error.message, error.statusCode, error.code);
    }
    throw error;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const currentCustomer = await tx.customer.findUnique({
        where: { id: customer.id },
      });

      if (!currentCustomer || currentCustomer.totalPoints < pointsSpent) {
        throw new RedeemRewardError(
          "Not enough points to redeem this reward",
          400,
          "insufficient_points"
        );
      }

      const redemption = await tx.redemption.create({
        data: {
          customerId: customer.id,
          rewardId: reward.id,
          pointsSpent,
          couponCode: shopifyDiscount.code,
          shopifyDiscountId: shopifyDiscount.shopifyDiscountId,
          discountType: shopifyDiscount.discountType,
          discountValue: shopifyDiscount.discountValue,
        },
      });

      await tx.pointsTransaction.create({
        data: {
          customerId: customer.id,
          storeId,
          type: "REDEEMED",
          points: pointsSpent,
          reason: `Redeemed: ${reward.name} (${shopifyDiscount.code})`,
        },
      });

      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          totalPoints: { decrement: pointsSpent },
        },
      });

      return {
        redemption,
        reward,
        customer: updatedCustomer,
        couponCode: shopifyDiscount.code,
        shopifyDiscountId: shopifyDiscount.shopifyDiscountId,
        discountType: shopifyDiscount.discountType,
        discountValue: shopifyDiscount.discountValue,
        pointsBalance: updatedCustomer.totalPoints,
        pointsSpent,
      };
    });
  } catch (error) {
    console.error("[redeem] DB transaction failed after Shopify discount created", {
      shop: store.shop,
      couponCode,
      shopifyDiscountId: shopifyDiscount.shopifyDiscountId,
      error: error.message,
    });
    throw error;
  }
}
