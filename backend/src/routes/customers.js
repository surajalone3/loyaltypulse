import { Router } from "express";
import { prisma } from "../shopify.js";
import { loadStore } from "../middleware/loadStore.js";
import {
  parsePagination,
  buildPaginationMeta,
} from "../utils/pagination.js";

const router = Router();

router.use(loadStore);

function formatCustomer(customer) {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    totalPoints: customer.totalPoints,
    lifetimePoints: customer.lifetimePoints,
    lifetimeSpend: Number(customer.lifetimeSpend),
    tier: customer.tier,
    createdAt: customer.createdAt,
  };
}

function buildCustomerWhere(storeId, query) {
  const where = { storeId };
  const conditions = [];

  const email = typeof query.email === "string" ? query.email.trim() : "";
  const name = typeof query.name === "string" ? query.name.trim() : "";

  if (email) {
    conditions.push({
      email: { contains: email, mode: "insensitive" },
    });
  }

  if (name) {
    const nameParts = name.split(/\s+/).filter(Boolean);
    if (nameParts.length === 1) {
      conditions.push({
        OR: [
          { firstName: { contains: name, mode: "insensitive" } },
          { lastName: { contains: name, mode: "insensitive" } },
        ],
      });
    } else {
      const [first, ...rest] = nameParts;
      const last = rest.join(" ");
      conditions.push({
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
      });
    }
  }

  const tier =
    typeof query.tier === "string" ? query.tier.trim().toUpperCase() : "";
  if (tier === "BRONZE" || tier === "SILVER" || tier === "GOLD" || tier === "PLATINUM") {
    where.tier = tier;
  }

  if (conditions.length === 1) {
    Object.assign(where, conditions[0]);
  } else if (conditions.length > 1) {
    where.AND = conditions;
  }

  return where;
}

/**
 * GET /api/customers — list loyalty customers for the authenticated store
 * Query: page, limit, email, name, tier
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const { page, limit, skip } = parsePagination(req.query);
    const where = buildCustomerWhere(store.id, req.query);

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      data: customers.map(formatCustomer),
      pagination: buildPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error("GET /api/customers failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load customers.",
    });
  }
});

export default router;
