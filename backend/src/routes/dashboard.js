import { Router } from "express";
import { prisma } from "../shopify.js";
import { loadStore } from "../middleware/loadStore.js";

const router = Router();

router.use(loadStore);

function startOfCurrentMonthUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function formatTransaction(transaction) {
  const { customer } = transaction;

  return {
    id: transaction.id,
    customer: {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    },
    type: transaction.type,
    points: transaction.points,
    reason: transaction.reason,
    orderId: transaction.orderId,
    createdAt: transaction.createdAt,
  };
}

/**
 * GET /api/dashboard — loyalty summary metrics for the authenticated store
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const storeId = store.id;
    const monthStart = startOfCurrentMonthUtc();

    const [
      totalLoyaltyMembers,
      pointsIssuedAggregate,
      pointsRedeemedAggregate,
      newMembersThisMonth,
      recentTransactions,
    ] = await Promise.all([
      prisma.customer.count({ where: { storeId } }),
      prisma.pointsTransaction.aggregate({
        where: {
          storeId,
          type: { in: ["EARNED", "BONUS"] },
        },
        _sum: { points: true },
      }),
      prisma.pointsTransaction.aggregate({
        where: {
          storeId,
          type: "REDEEMED",
        },
        _sum: { points: true },
      }),
      prisma.customer.count({
        where: {
          storeId,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.pointsTransaction.findMany({
        where: { storeId },
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
        take: 10,
      }),
    ]);

    res.json({
      totalLoyaltyMembers,
      totalPointsIssued: pointsIssuedAggregate._sum.points ?? 0,
      totalPointsRedeemed: pointsRedeemedAggregate._sum.points ?? 0,
      recentTransactions: recentTransactions.map(formatTransaction),
      memberGrowthThisMonth: {
        newMembers: newMembersThisMonth,
        monthStart: monthStart.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load dashboard metrics.",
    });
  }
});

export default router;
