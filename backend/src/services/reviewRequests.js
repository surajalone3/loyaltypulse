import { prisma } from "../shopify.js";
import {
  buildPaginationMeta,
  parsePagination,
} from "../utils/pagination.js";

export class ReviewRequestServiceError extends Error {
  constructor(message, statusCode = 400, code = "review_request_error") {
    super(message);
    this.name = "ReviewRequestServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatCustomerName(customer) {
  if (!customer) {
    return null;
  }
  const parts = [customer.firstName, customer.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return customer.email ?? null;
}

export function formatReviewRequest(reviewRequest) {
  const { customer } = reviewRequest;

  return {
    id: reviewRequest.id,
    orderId: reviewRequest.orderId,
    customerId: reviewRequest.customerId,
    email: reviewRequest.email,
    status: reviewRequest.status,
    scheduledSendAt: reviewRequest.scheduledSendAt,
    sentAt: reviewRequest.sentAt,
    reviewedAt: reviewRequest.reviewedAt,
    createdAt: reviewRequest.createdAt,
    customer: customer
      ? {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          name: formatCustomerName(customer),
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

  if (status === "PENDING" || status === "SENT" || status === "COMPLETED") {
    where.status = status;
  } else if (status === "REVIEWED") {
    where.status = "COMPLETED";
  }

  if (conditions.length === 1) {
    Object.assign(where, conditions[0]);
  } else if (conditions.length > 1) {
    where.AND = conditions;
  }

  return where;
}

export async function getLoyaltyReviewSettings(storeId, tx = prisma) {
  const program = await tx.loyaltyProgram.findUnique({
    where: { storeId },
    select: {
      reviewRequestDelayDays: true,
      reviewRequestsEnabled: true,
      isActive: true,
    },
  });

  return {
    reviewRequestDelayDays: program?.reviewRequestDelayDays ?? 7,
    reviewRequestsEnabled: program?.reviewRequestsEnabled ?? true,
    programActive: program?.isActive ?? true,
  };
}

/**
 * Creates a review request after order completion. Prevents duplicates per order.
 */
export async function createReviewRequestAfterOrder(
  {
    storeId,
    orderId,
    customerId,
    email,
    delayDays = 7,
    enabled = true,
  },
  tx = prisma
) {
  if (!enabled) {
    return { created: false, reason: "disabled", reviewRequest: null };
  }

  const existing = await tx.reviewRequest.findUnique({
    where: {
      storeId_orderId: {
        storeId,
        orderId,
      },
    },
  });

  if (existing) {
    return { created: false, reason: "duplicate", reviewRequest: existing };
  }

  const now = new Date();
  const reviewRequest = await tx.reviewRequest.create({
    data: {
      storeId,
      orderId,
      customerId,
      email,
      status: "PENDING",
      scheduledSendAt: addDays(now, delayDays),
      sentAt: null,
      reviewedAt: null,
      pointsAwarded: 0,
    },
  });

  return { created: true, reason: null, reviewRequest };
}

export async function sendReviewRequest(reviewRequestId, storeId, { force = false } = {}) {
  const reviewRequest = await prisma.reviewRequest.findFirst({
    where: { id: reviewRequestId, storeId },
  });

  if (!reviewRequest) {
    throw new ReviewRequestServiceError(
      "Review request not found",
      404,
      "not_found"
    );
  }

  if (reviewRequest.status === "COMPLETED") {
    throw new ReviewRequestServiceError(
      "Review request is already completed",
      409,
      "already_completed"
    );
  }

  if (reviewRequest.status === "SENT") {
    throw new ReviewRequestServiceError(
      "Review request has already been sent",
      409,
      "already_sent"
    );
  }

  const now = new Date();
  if (
    !force &&
    reviewRequest.scheduledSendAt &&
    reviewRequest.scheduledSendAt > now
  ) {
    throw new ReviewRequestServiceError(
      "Review request is not scheduled to be sent yet",
      409,
      "not_due"
    );
  }

  const settings = await getLoyaltyReviewSettings(storeId);
  if (!settings.reviewRequestsEnabled) {
    throw new ReviewRequestServiceError(
      "Review requests are disabled for this store",
      403,
      "disabled"
    );
  }

  const updated = await prisma.reviewRequest.update({
    where: { id: reviewRequest.id },
    data: {
      status: "SENT",
      sentAt: now,
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
  });

  console.log("[review-request] sent", {
    reviewRequestId: updated.id,
    storeId,
    email: updated.email,
    orderId: updated.orderId,
  });

  return formatReviewRequest(updated);
}

export async function completeReviewRequest(reviewRequestId, storeId) {
  const reviewRequest = await prisma.reviewRequest.findFirst({
    where: { id: reviewRequestId, storeId },
  });

  if (!reviewRequest) {
    throw new ReviewRequestServiceError(
      "Review request not found",
      404,
      "not_found"
    );
  }

  if (reviewRequest.status === "COMPLETED") {
    throw new ReviewRequestServiceError(
      "Review request is already completed",
      409,
      "already_completed"
    );
  }

  const now = new Date();
  const updated = await prisma.reviewRequest.update({
    where: { id: reviewRequest.id },
    data: {
      status: "COMPLETED",
      reviewedAt: now,
      sentAt: reviewRequest.sentAt ?? now,
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
  });

  console.log("[review-request] completed", {
    reviewRequestId: updated.id,
    storeId,
    orderId: updated.orderId,
  });

  return formatReviewRequest(updated);
}

export async function processDueReviewRequests(storeId = null) {
  const now = new Date();
  const where = {
    status: "PENDING",
    scheduledSendAt: { lte: now },
  };

  if (storeId) {
    where.storeId = storeId;
  }

  const dueRequests = await prisma.reviewRequest.findMany({
    where,
    orderBy: { scheduledSendAt: "asc" },
    take: 100,
  });

  let sent = 0;
  const results = [];

  for (const request of dueRequests) {
    const settings = await getLoyaltyReviewSettings(request.storeId);
    if (!settings.reviewRequestsEnabled) {
      continue;
    }

    try {
      const formatted = await sendReviewRequest(request.id, request.storeId, {
        force: true,
      });
      sent += 1;
      results.push({ id: request.id, status: "sent", review: formatted });
    } catch (error) {
      results.push({
        id: request.id,
        status: "failed",
        error: error.message,
      });
    }
  }

  return { processed: dueRequests.length, sent, results };
}

export async function listReviewRequests(storeId, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const where = buildReviewWhere(storeId, query);

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

  return {
    data: reviewRequests.map(formatReviewRequest),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

export async function getReviewStats(storeId) {
  const [pending, sent, completed, total] = await Promise.all([
    prisma.reviewRequest.count({ where: { storeId, status: "PENDING" } }),
    prisma.reviewRequest.count({ where: { storeId, status: "SENT" } }),
    prisma.reviewRequest.count({ where: { storeId, status: "COMPLETED" } }),
    prisma.reviewRequest.count({ where: { storeId } }),
  ]);

  const completionRate =
    total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

  return {
    pendingReviewRequests: pending,
    sentReviewRequests: sent,
    completedReviews: completed,
    totalReviewRequests: total,
    reviewCompletionRate: completionRate,
  };
}

export async function getCustomerReviewStatus(customerId) {
  const latest = await prisma.reviewRequest.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderId: true,
      status: true,
      scheduledSendAt: true,
      sentAt: true,
      reviewedAt: true,
      createdAt: true,
    },
  });

  if (!latest) {
    return null;
  }

  return {
    id: latest.id,
    orderId: latest.orderId,
    status: latest.status,
    scheduledSendAt: latest.scheduledSendAt,
    sentAt: latest.sentAt,
    reviewedAt: latest.reviewedAt,
    createdAt: latest.createdAt,
    message: getReviewStatusMessage(latest.status),
  };
}

function getReviewStatusMessage(status) {
  switch (status) {
    case "PENDING":
      return "A review request will be sent after your order.";
    case "SENT":
      return "We sent you a review request — share your feedback when ready.";
    case "COMPLETED":
      return "Thank you for leaving a review!";
    default:
      return null;
  }
}

export async function getReviewDashboardMetrics(storeId) {
  return getReviewStats(storeId);
}
