import { prisma } from "../shopify.js";
import { getTierDistribution } from "./loyaltyTiers.js";
import { getReferralDashboardMetrics } from "./referrals.js";
import { getReviewDashboardMetrics } from "./reviewRequests.js";

const CHART_DAYS = 30;

function formatCustomerName(customer) {
  if (!customer) {
    return "Unknown";
  }
  const parts = [customer.firstName, customer.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return customer.email ?? "Unknown";
}

function startOfUtcDay(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function buildDayKeys(days = CHART_DAYS) {
  const keys = [];
  const today = startOfUtcDay(new Date());

  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - offset);
    keys.push(day.toISOString().slice(0, 10));
  }

  return keys;
}

function initDaySeries(days = CHART_DAYS) {
  return Object.fromEntries(buildDayKeys(days).map((key) => [key, 0]));
}

function bucketByUtcDay(rows, dateField, valueField = null) {
  const series = initDaySeries();

  for (const row of rows) {
    const date = row[dateField];
    if (!date) {
      continue;
    }
    const key = startOfUtcDay(new Date(date)).toISOString().slice(0, 10);
    if (!(key in series)) {
      continue;
    }
    series[key] += valueField ? Number(row[valueField] ?? 0) : 1;
  }

  return buildDayKeys().map((date) => ({
    date,
    value: series[date] ?? 0,
  }));
}

async function getSummaryMetrics(storeId) {
  const [
    totalLoyaltyMembers,
    pointsIssuedAggregate,
    pointsRedeemedAggregate,
    activeRewards,
    totalRedemptions,
  ] = await Promise.all([
    prisma.customer.count({ where: { storeId } }),
    prisma.customer.aggregate({
      where: { storeId },
      _sum: { lifetimePoints: true },
    }),
    prisma.redemption.aggregate({
      where: { customer: { storeId } },
      _sum: { pointsSpent: true },
    }),
    prisma.reward.count({ where: { storeId, isActive: true } }),
    prisma.redemption.count({ where: { customer: { storeId } } }),
  ]);

  return {
    totalLoyaltyMembers,
    totalPointsIssued: pointsIssuedAggregate._sum.lifetimePoints ?? 0,
    totalPointsRedeemed: pointsRedeemedAggregate._sum.pointsSpent ?? 0,
    activeRewards,
    totalRedemptions,
  };
}

async function getRecentActivity(storeId, limit = 20) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);

  const [earnedTransactions, redeemedTransactions, redemptions] =
    await Promise.all([
      prisma.pointsTransaction.findMany({
        where: {
          storeId,
          type: { in: ["EARNED", "BONUS"] },
          createdAt: { gte: since },
        },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit * 2,
      }),
      prisma.pointsTransaction.findMany({
        where: {
          storeId,
          type: "REDEEMED",
          createdAt: { gte: since },
        },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit * 2,
      }),
      prisma.redemption.findMany({
        where: {
          customer: { storeId },
          createdAt: { gte: since },
        },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          reward: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit * 2,
      }),
    ]);

  const redemptionTxnKeys = new Set(
    redemptions.map(
      (entry) =>
        `${entry.customerId}:${entry.pointsSpent}:${entry.createdAt.toISOString().slice(0, 16)}`
    )
  );

  const activities = [
    ...earnedTransactions.map((tx) => ({
      id: `txn-${tx.id}`,
      activityType: "points_earned",
      customer: {
        id: tx.customer.id,
        name: formatCustomerName(tx.customer),
        email: tx.customer.email,
      },
      points: tx.points,
      detail: tx.reason,
      createdAt: tx.createdAt,
    })),
    ...redeemedTransactions
      .filter((tx) => {
        const key = `${tx.customerId}:${tx.points}:${tx.createdAt.toISOString().slice(0, 16)}`;
        return !redemptionTxnKeys.has(key);
      })
      .map((tx) => ({
        id: `txn-${tx.id}`,
        activityType: "points_redeemed",
        customer: {
          id: tx.customer.id,
          name: formatCustomerName(tx.customer),
          email: tx.customer.email,
        },
        points: tx.points,
        detail: tx.reason,
        createdAt: tx.createdAt,
      })),
    ...redemptions.map((entry) => ({
      id: `redemption-${entry.id}`,
      activityType: "reward_redemption",
      customer: {
        id: entry.customer.id,
        name: formatCustomerName(entry.customer),
        email: entry.customer.email,
      },
      points: entry.pointsSpent,
      detail: `${entry.reward.name} · ${entry.couponCode}`,
      createdAt: entry.createdAt,
    })),
  ];

  activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return activities.slice(0, limit);
}

async function getChartSeries(storeId) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (CHART_DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);

  const [newMembers, pointsIssuedRows, redemptions] = await Promise.all([
    prisma.customer.findMany({
      where: { storeId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.pointsTransaction.findMany({
      where: {
        storeId,
        type: { in: ["EARNED", "BONUS"] },
        createdAt: { gte: since },
      },
      select: { createdAt: true, points: true },
    }),
    prisma.redemption.findMany({
      where: {
        customer: { storeId },
        createdAt: { gte: since },
      },
      select: { createdAt: true, pointsSpent: true },
    }),
  ]);

  return {
    newMembersOverTime: bucketByUtcDay(newMembers, "createdAt"),
    pointsIssuedOverTime: bucketByUtcDay(pointsIssuedRows, "createdAt", "points"),
    redemptionsOverTime: bucketByUtcDay(redemptions, "createdAt", "pointsSpent"),
  };
}

/**
 * Aggregated dashboard payload for GET /api/dashboard
 */
export async function getDashboardMetrics(storeId) {
  const [metrics, recentActivity, charts, tierDistribution, referrals, reviews] =
    await Promise.all([
    getSummaryMetrics(storeId),
    getRecentActivity(storeId, 20),
    getChartSeries(storeId),
    getTierDistribution(storeId),
    getReferralDashboardMetrics(storeId),
    getReviewDashboardMetrics(storeId),
  ]);

  const customersPerTier = Object.fromEntries(
    tierDistribution.map((tier) => [tier.tierKey, tier.count])
  );

  return {
    metrics: {
      ...metrics,
      customersPerTier,
      totalReferrals: referrals.totalReferrals,
      referralConversionRate: referrals.referralConversionRate,
      completedReferrals: referrals.completedReferrals,
      pendingReferrals: referrals.pendingReferrals,
      topReferrers: referrals.topReferrers,
      pendingReviewRequests: reviews.pendingReviewRequests,
      completedReviews: reviews.completedReviews,
      reviewCompletionRate: reviews.reviewCompletionRate,
    },
    recentActivity,
    charts: {
      ...charts,
      tierDistribution,
    },
    referrals,
    reviews,
    generatedAt: new Date().toISOString(),
  };
}
