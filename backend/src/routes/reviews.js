import { Router } from "express";
import { prisma } from "../shopify.js";
import { loadStore } from "../middleware/loadStore.js";
import {
  parsePagination,
  buildPaginationMeta,
} from "../utils/pagination.js";

const router = Router();

router.use(loadStore);

function deriveStatus(sentAt, reviewedAt) {
  if (reviewedAt) {
    return "REVIEWED";
  }
  if (sentAt) {
    return "SENT";
  }
  return "PENDING";
}

function formatReviewRequest(reviewRequest) {
  const { customer } = reviewRequest;

  return {
    id: reviewRequest.id,
    orderId: reviewRequest.orderId,
    email: reviewRequest.email,
    status: deriveStatus(reviewRequest.sentAt, reviewRequest.reviewedAt),
    sentAt: reviewRequest.sentAt,
    reviewedAt: reviewRequest.reviewedAt,
    createdAt: reviewRequest.createdAt,
    customer: customer
      ? {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
        }
      : null,
  };
}

function buildReviewWhere(storeId, query) {
  const where = { storeId };
  const conditions = [];

  const email = typeof query.email === "string" ? query.email.trim() : "";
  const name = typeof query.name === "string" ? query.name.trim() : "";
  const status =
    typeof query.status === "string" ? query.status.trim().toUpperCase() : "";

  if (email) {
    conditions.push({
      OR: [
        { email: { contains: email, mode: "insensitive" } },
        {
          customer: {
            email: { contains: email, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (name) {
    const nameParts = name.split(/\s+/).filter(Boolean);
    if (nameParts.length === 1) {
      conditions.push({
        customer: {
          OR: [
            { firstName: { contains: name, mode: "insensitive" } },
            { lastName: { contains: name, mode: "insensitive" } },
          ],
        },
      });
    } else {
      const [first, ...rest] = nameParts;
      const last = rest.join(" ");
      conditions.push({
        customer: {
          OR: [
            {
              AND: [
                { firstName: { contains: first, mode: "insensitive" } },
                { lastName: { contains: last, mode: "insensitive" } },
              ],
            },
            { firstName: { contains: name, mode: "insensitive" } },
            { lastName: { contains: name, mode: "insensitive" } },
          ],
        },
      });
    }
  }

  if (status === "PENDING") {
    where.sentAt = null;
    where.reviewedAt = null;
  } else if (status === "SENT") {
    where.sentAt = { not: null };
    where.reviewedAt = null;
  } else if (status === "REVIEWED") {
    where.reviewedAt = { not: null };
  }

  if (conditions.length === 1) {
    Object.assign(where, conditions[0]);
  } else if (conditions.length > 1) {
    where.AND = conditions;
  }

  return where;
}

/**
 * GET /api/reviews — list review requests for the authenticated store
 * Query: page, limit, email, name, status (PENDING|SENT|REVIEWED)
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const { page, limit, skip } = parsePagination(req.query);
    const where = buildReviewWhere(store.id, req.query);

    const [total, reviewRequests] = await Promise.all([
      prisma.reviewRequest.count({ where }),
      prisma.reviewRequest.findMany({
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
      data: reviewRequests.map(formatReviewRequest),
      pagination: buildPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error("GET /api/reviews failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load review requests.",
    });
  }
});

export default router;
