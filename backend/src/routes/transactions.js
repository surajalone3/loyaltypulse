import { Router } from "express";
import { prisma } from "../shopify.js";
import { loadStore } from "../middleware/loadStore.js";
import {
  parsePagination,
  buildPaginationMeta,
} from "../utils/pagination.js";

const router = Router();

router.use(loadStore);

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
 * GET /api/transactions — list points transactions for the authenticated store
 * Query: page, limit
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const { page, limit, skip } = parsePagination(req.query);

    const where = { storeId: store.id };

    const [total, transactions] = await Promise.all([
      prisma.pointsTransaction.count({ where }),
      prisma.pointsTransaction.findMany({
        where,
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
        skip,
        take: limit,
      }),
    ]);

    res.json({
      data: transactions.map(formatTransaction),
      pagination: buildPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error("GET /api/transactions failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load transactions.",
    });
  }
});

export default router;
