import { prisma } from "../shopify.js";

export class PointsServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "PointsServiceError";
    this.statusCode = statusCode;
  }
}

/**
 * Awards points to a customer: creates an EARNED transaction and updates balances.
 */
export async function awardPoints(
  storeId,
  customerId,
  points,
  reason = null,
  orderId = null,
  tx = null
) {
  if (!storeId || typeof storeId !== "string") {
    throw new PointsServiceError("storeId is required");
  }

  if (!customerId || typeof customerId !== "string") {
    throw new PointsServiceError("customerId is required");
  }

  const parsedPoints = Number(points);
  if (!Number.isInteger(parsedPoints) || parsedPoints < 1) {
    throw new PointsServiceError("points must be a positive integer");
  }

  if (reason !== null && reason !== undefined) {
    if (typeof reason !== "string") {
      throw new PointsServiceError("reason must be a string");
    }
    if (reason.length > 500) {
      throw new PointsServiceError("reason must be 500 characters or fewer");
    }
  }

  if (orderId !== null && orderId !== undefined) {
    if (typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new PointsServiceError("orderId must be a non-empty string");
    }
  }

  const run = async (client) => {
    const customer = await client.customer.findFirst({
      where: { id: customerId, storeId },
    });

    if (!customer) {
      throw new PointsServiceError(
        "Customer not found for this store",
        404
      );
    }

    const transaction = await client.pointsTransaction.create({
      data: {
        customerId,
        storeId,
        type: "EARNED",
        points: parsedPoints,
        reason: reason?.trim() || null,
        orderId: orderId?.trim() || null,
      },
    });

    const updatedCustomer = await client.customer.update({
      where: { id: customerId },
      data: {
        totalPoints: { increment: parsedPoints },
        lifetimePoints: { increment: parsedPoints },
      },
    });

    return { transaction, customer: updatedCustomer };
  };

  if (tx) {
    return run(tx);
  }

  return prisma.$transaction(run);
}

/**
 * Awards bonus points (welcome, referral, etc.) with a BONUS transaction.
 */
export async function awardBonus(
  storeId,
  customerId,
  points,
  reason = null,
  orderId = null,
  tx = null
) {
  if (!storeId || typeof storeId !== "string") {
    throw new PointsServiceError("storeId is required");
  }

  if (!customerId || typeof customerId !== "string") {
    throw new PointsServiceError("customerId is required");
  }

  const parsedPoints = Number(points);
  if (!Number.isInteger(parsedPoints) || parsedPoints < 1) {
    throw new PointsServiceError("points must be a positive integer");
  }

  if (reason !== null && reason !== undefined) {
    if (typeof reason !== "string") {
      throw new PointsServiceError("reason must be a string");
    }
    if (reason.length > 500) {
      throw new PointsServiceError("reason must be 500 characters or fewer");
    }
  }

  if (orderId !== null && orderId !== undefined) {
    if (typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new PointsServiceError("orderId must be a non-empty string");
    }
  }

  const run = async (client) => {
    const customer = await client.customer.findFirst({
      where: { id: customerId, storeId },
    });

    if (!customer) {
      throw new PointsServiceError(
        "Customer not found for this store",
        404
      );
    }

    const transaction = await client.pointsTransaction.create({
      data: {
        customerId,
        storeId,
        type: "BONUS",
        points: parsedPoints,
        reason: reason?.trim() || null,
        orderId: orderId?.trim() || null,
      },
    });

    const updatedCustomer = await client.customer.update({
      where: { id: customerId },
      data: {
        totalPoints: { increment: parsedPoints },
        lifetimePoints: { increment: parsedPoints },
      },
    });

    return { transaction, customer: updatedCustomer };
  };

  if (tx) {
    return run(tx);
  }

  return prisma.$transaction(run);
}
