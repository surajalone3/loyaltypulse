import crypto from "crypto";
import { prisma } from "../shopify.js";
import { awardBonus } from "./points.js";
import {
  buildPaginationMeta,
  parsePagination,
} from "../utils/pagination.js";

export class ReferralServiceError extends Error {
  constructor(message, statusCode = 400, code = "referral_error") {
    super(message);
    this.name = "ReferralServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const REFERRAL_CODE_PREFIX = "LP-";
const WELCOME_BONUS_REASON = "Welcome bonus";
const REFERRAL_BONUS_REASON_PREFIX = "Referral bonus";

function shopifyCustomerGid(numericOrGid) {
  if (String(numericOrGid).startsWith("gid://")) {
    return numericOrGid;
  }
  return `gid://shopify/Customer/${numericOrGid}`;
}

function normalizeReferralCode(code) {
  return String(code ?? "")
    .trim()
    .toUpperCase();
}

function randomReferralSuffix(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

export function buildReferralUrl(shop, referralCode) {
  const normalizedShop = String(shop).replace(/^https?:\/\//, "");
  return `https://${normalizedShop}?ref=${encodeURIComponent(referralCode)}`;
}

export async function generateUniqueReferralCode(storeId, tx = prisma) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = `${REFERRAL_CODE_PREFIX}${randomReferralSuffix(6)}`;
    const existing = await tx.customer.findFirst({
      where: { storeId, referralCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }

  throw new ReferralServiceError(
    "Could not generate a unique referral code",
    500,
    "code_generation_failed"
  );
}

export async function ensureCustomerReferralCode(customer, storeId, tx = prisma) {
  if (customer.referralCode) {
    return customer;
  }

  const referralCode = await generateUniqueReferralCode(storeId, tx);

  return tx.customer.update({
    where: { id: customer.id },
    data: { referralCode },
  });
}

function formatCustomerName(customer) {
  const parts = [customer?.firstName, customer?.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return customer?.email ?? "Unknown";
}

export async function getReferralLinkForCustomer(store, customerId) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId: store.id },
  });

  if (!customer) {
    throw new ReferralServiceError("Customer not found", 404, "customer_not_found");
  }

  const withCode = await ensureCustomerReferralCode(customer, store.id);

  return {
    shop: store.shop,
    customerId: withCode.id,
    referralCode: withCode.referralCode,
    referralUrl: buildReferralUrl(store.shop, withCode.referralCode),
  };
}

export async function findOrCreateCustomerForReferral(
  storeId,
  shopifyCustomerId,
  profile = {},
  tx = prisma
) {
  const gid = shopifyCustomerGid(shopifyCustomerId);

  let customer = await tx.customer.findUnique({
    where: {
      storeId_shopifyCustomerId: {
        storeId,
        shopifyCustomerId: gid,
      },
    },
  });

  if (!customer) {
    customer = await tx.customer.create({
      data: {
        storeId,
        shopifyCustomerId: gid,
        email: profile.email ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
      },
    });
  }

  return ensureCustomerReferralCode(customer, storeId, tx);
}

export async function applyReferral({
  storeId,
  shop,
  referredCustomerId,
  shopifyCustomerId,
  referralCode,
  profile = {},
}) {
  const normalizedCode = normalizeReferralCode(referralCode);

  if (!normalizedCode) {
    throw new ReferralServiceError(
      "referralCode is required",
      400,
      "invalid_request"
    );
  }

  return prisma.$transaction(async (tx) => {
    let referredCustomer;

    if (referredCustomerId) {
      referredCustomer = await tx.customer.findFirst({
        where: { id: referredCustomerId, storeId },
      });
      if (!referredCustomer) {
        throw new ReferralServiceError(
          "Referred customer not found",
          404,
          "customer_not_found"
        );
      }
    } else if (shopifyCustomerId) {
      referredCustomer = await findOrCreateCustomerForReferral(
        storeId,
        shopifyCustomerId,
        profile,
        tx
      );
    } else {
      throw new ReferralServiceError(
        "Customer identity is required",
        400,
        "invalid_request"
      );
    }

    referredCustomer = await ensureCustomerReferralCode(
      referredCustomer,
      storeId,
      tx
    );

    const existingReferral = await tx.referral.findUnique({
      where: { referredCustomerId: referredCustomer.id },
    });

    if (existingReferral) {
      throw new ReferralServiceError(
        "This customer already has a referral on file",
        409,
        "referral_exists"
      );
    }

    const referrer = await tx.customer.findFirst({
      where: { storeId, referralCode: normalizedCode },
    });

    if (!referrer) {
      throw new ReferralServiceError(
        "Referral code not found",
        404,
        "code_not_found"
      );
    }

    if (referrer.id === referredCustomer.id) {
      throw new ReferralServiceError(
        "You cannot use your own referral code",
        400,
        "self_referral"
      );
    }

    const referral = await tx.referral.create({
      data: {
        storeId,
        referrerCustomerId: referrer.id,
        referredCustomerId: referredCustomer.id,
        referralCode: normalizedCode,
        status: "PENDING",
        rewardIssued: false,
      },
      include: {
        referrerCustomer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            referralCode: true,
          },
        },
        referredCustomer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      referral: formatReferral(referral),
      referralUrl: shop ? buildReferralUrl(shop, normalizedCode) : null,
    };
  });
}

function formatReferral(referral) {
  return {
    id: referral.id,
    referralCode: referral.referralCode,
    status: referral.status,
    rewardIssued: referral.rewardIssued,
    createdAt: referral.createdAt,
    referrer: referral.referrerCustomer
      ? {
          id: referral.referrerCustomer.id,
          name: formatCustomerName(referral.referrerCustomer),
          email: referral.referrerCustomer.email,
        }
      : null,
    referred: referral.referredCustomer
      ? {
          id: referral.referredCustomer.id,
          name: formatCustomerName(referral.referredCustomer),
          email: referral.referredCustomer.email,
        }
      : null,
  };
}

export async function getCustomerReferralStats(customerId) {
  const [successfulReferrals, pendingReferrals, bonusTransactions] =
    await Promise.all([
      prisma.referral.count({
        where: { referrerCustomerId: customerId, status: "COMPLETED" },
      }),
      prisma.referral.count({
        where: { referrerCustomerId: customerId, status: "PENDING" },
      }),
      prisma.pointsTransaction.findMany({
        where: {
          customerId,
          type: "BONUS",
          reason: { startsWith: REFERRAL_BONUS_REASON_PREFIX },
        },
        select: { points: true },
      }),
    ]);

  const starsEarnedFromReferrals = bonusTransactions.reduce(
    (sum, row) => sum + row.points,
    0
  );

  return {
    successfulReferrals,
    pendingReferrals,
    starsEarnedFromReferrals,
  };
}

export async function getStorefrontReferralPayload(store, customer) {
  const withCode = await ensureCustomerReferralCode(customer, store.id);
  const stats = await getCustomerReferralStats(withCode.id);

  const receivedReferral = await prisma.referral.findUnique({
    where: { referredCustomerId: withCode.id },
    select: { status: true, referralCode: true },
  });

  return {
    referralCode: withCode.referralCode,
    referralUrl: buildReferralUrl(store.shop, withCode.referralCode),
    stats,
    receivedReferral: receivedReferral
      ? {
          status: receivedReferral.status,
          referralCode: receivedReferral.referralCode,
        }
      : null,
  };
}

export async function hasWelcomeBonusBeenAwarded(customerId, tx = prisma) {
  const existing = await tx.pointsTransaction.findFirst({
    where: {
      customerId,
      type: "BONUS",
      reason: WELCOME_BONUS_REASON,
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function processReferralRewardsOnOrder({
  storeId,
  customerId,
  orderId,
  loyaltyProgram,
  isFirstPurchase,
  tx,
}) {
  if (!loyaltyProgram?.isActive) {
    return {
      welcomeBonusAwarded: 0,
      referralBonusAwarded: 0,
      referralCompleted: false,
    };
  }

  let welcomeBonusAwarded = 0;
  let referralBonusAwarded = 0;
  let referralCompleted = false;

  if (isFirstPurchase && loyaltyProgram.welcomeBonus > 0) {
    const alreadyAwarded = await hasWelcomeBonusBeenAwarded(customerId, tx);
    if (!alreadyAwarded) {
      await awardBonus(
        storeId,
        customerId,
        loyaltyProgram.welcomeBonus,
        WELCOME_BONUS_REASON,
        orderId,
        tx
      );
      welcomeBonusAwarded = loyaltyProgram.welcomeBonus;
    }
  }

  const pendingReferral = await tx.referral.findFirst({
    where: {
      storeId,
      referredCustomerId: customerId,
      status: "PENDING",
      rewardIssued: false,
    },
    include: {
      referredCustomer: {
        select: { email: true, firstName: true, lastName: true },
      },
    },
  });

  if (pendingReferral && loyaltyProgram.referralBonus > 0) {
    const referredLabel = formatCustomerName(pendingReferral.referredCustomer);
    await awardBonus(
      storeId,
      pendingReferral.referrerCustomerId,
      loyaltyProgram.referralBonus,
      `${REFERRAL_BONUS_REASON_PREFIX} · ${referredLabel}`,
      orderId,
      tx
    );
    referralBonusAwarded = loyaltyProgram.referralBonus;
  }

  if (pendingReferral) {
    await tx.referral.update({
      where: { id: pendingReferral.id },
      data: {
        status: "COMPLETED",
        rewardIssued: referralBonusAwarded > 0 || loyaltyProgram.referralBonus === 0,
      },
    });
    referralCompleted = true;
  }

  return {
    welcomeBonusAwarded,
    referralBonusAwarded,
    referralCompleted,
  };
}

export async function listReferrals(storeId, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const status =
    typeof query.status === "string"
      ? query.status.trim().toUpperCase()
      : "";

  const where = { storeId };
  if (status === "PENDING" || status === "COMPLETED") {
    where.status = status;
  }

  const [rows, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: {
        referrerCustomer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        referredCustomer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.referral.count({ where }),
  ]);

  const [pendingCount, completedCount] = await Promise.all([
    prisma.referral.count({ where: { storeId, status: "PENDING" } }),
    prisma.referral.count({ where: { storeId, status: "COMPLETED" } }),
  ]);

  return {
    data: rows.map(formatReferral),
    summary: {
      total,
      pending: pendingCount,
      completed: completedCount,
      conversionRate:
        total > 0 ? Math.round((completedCount / total) * 1000) / 10 : 0,
    },
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getReferralDashboardMetrics(storeId) {
  const [totalReferrals, completedReferrals, topReferrerRows] =
    await Promise.all([
      prisma.referral.count({ where: { storeId } }),
      prisma.referral.count({ where: { storeId, status: "COMPLETED" } }),
      prisma.referral.groupBy({
        by: ["referrerCustomerId"],
        where: { storeId },
        _count: { _all: true },
        orderBy: { _count: { referrerCustomerId: "desc" } },
        take: 5,
      }),
    ]);

  const referrerIds = topReferrerRows.map((row) => row.referrerCustomerId);
  const referrers = referrerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: referrerIds } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      })
    : [];

  const referrerMap = Object.fromEntries(referrers.map((c) => [c.id, c]));

  const bonusByReferrer = referrerIds.length
    ? await prisma.pointsTransaction.groupBy({
        by: ["customerId"],
        where: {
          storeId,
          customerId: { in: referrerIds },
          type: "BONUS",
          reason: { startsWith: REFERRAL_BONUS_REASON_PREFIX },
        },
        _sum: { points: true },
      })
    : [];

  const bonusMap = Object.fromEntries(
    bonusByReferrer.map((row) => [row.customerId, row._sum.points ?? 0])
  );

  const topReferrers = topReferrerRows.map((row) => {
    const customer = referrerMap[row.referrerCustomerId];
    return {
      customerId: row.referrerCustomerId,
      name: formatCustomerName(customer),
      email: customer?.email ?? null,
      referralCount: row._count._all,
      starsEarned: bonusMap[row.referrerCustomerId] ?? 0,
    };
  });

  return {
    totalReferrals,
    completedReferrals,
    pendingReferrals: totalReferrals - completedReferrals,
    referralConversionRate:
      totalReferrals > 0
        ? Math.round((completedReferrals / totalReferrals) * 1000) / 10
        : 0,
    topReferrers,
  };
}

export async function backfillCustomerReferralCodes(storeId) {
  const customers = await prisma.customer.findMany({
    where: { storeId, referralCode: null },
    select: { id: true },
  });

  for (const customer of customers) {
    const code = await generateUniqueReferralCode(storeId);
    await prisma.customer.update({
      where: { id: customer.id },
      data: { referralCode: code },
    });
  }

  return customers.length;
}
