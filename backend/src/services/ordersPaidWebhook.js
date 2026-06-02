import { prisma } from "../shopify.js";
import { awardPoints } from "./points.js";
import { tierFromLifetimeSpend } from "../utils/tier.js";

export class OrdersPaidWebhookError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "OrdersPaidWebhookError";
    this.statusCode = statusCode;
  }
}

function parseOrderTotal(order) {
  const raw =
    order.total_price ??
    order.current_total_price ??
    order.subtotal_price ??
    "0";
  const total = parseFloat(String(raw));

  if (Number.isNaN(total) || total < 0) {
    throw new OrdersPaidWebhookError(`Invalid order total: ${raw}`);
  }

  return total;
}

function resolveShopifyOrderId(order) {
  return (
    order.admin_graphql_api_id ??
    (order.id != null ? `gid://shopify/Order/${order.id}` : null)
  );
}

function resolveShopifyCustomerId(customer) {
  if (!customer) {
    return null;
  }
  return (
    customer.admin_graphql_api_id ??
    (customer.id != null ? `gid://shopify/Customer/${customer.id}` : null)
  );
}

function calculatePoints(orderTotal, pointsPerDollar) {
  return Math.floor(orderTotal * pointsPerDollar);
}

/**
 * Handles orders/paid webhook payload for a verified shop domain.
 */
export async function processOrdersPaidWebhook(shopDomain, orderPayload) {
  const logPrefix = `[webhook:orders-paid][${shopDomain}]`;

  console.log(`${logPrefix} Processing order`, {
    orderId: orderPayload.id,
    orderName: orderPayload.name,
  });

  const store = await prisma.store.findUnique({
    where: { shop: shopDomain },
  });

  if (!store) {
    console.warn(`${logPrefix} Store not found for shop`);
    throw new OrdersPaidWebhookError("Store not found", 404);
  }

  if (!store.isActive) {
    console.warn(`${logPrefix} Store is inactive, skipping`);
    return { skipped: true, reason: "store_inactive" };
  }

  const shopifyOrderId = resolveShopifyOrderId(orderPayload);
  if (!shopifyOrderId) {
    throw new OrdersPaidWebhookError("Order id missing from payload");
  }

  const existingTransaction = await prisma.pointsTransaction.findFirst({
    where: {
      storeId: store.id,
      orderId: shopifyOrderId,
      type: "EARNED",
    },
  });

  if (existingTransaction) {
    console.log(`${logPrefix} Order already processed`, { shopifyOrderId });
    return { skipped: true, reason: "already_processed", shopifyOrderId };
  }

  const shopifyCustomer = orderPayload.customer;
  const shopifyCustomerId = resolveShopifyCustomerId(shopifyCustomer);

  if (!shopifyCustomerId) {
    console.log(`${logPrefix} No customer on order, skipping loyalty`);
    return { skipped: true, reason: "no_customer", shopifyOrderId };
  }

  const orderTotal = parseOrderTotal(orderPayload);
  console.log(`${logPrefix} Order total: $${orderTotal.toFixed(2)}`);

  const loyaltyProgram = await prisma.loyaltyProgram.findUnique({
    where: { storeId: store.id },
  });

  if (!loyaltyProgram) {
    console.warn(`${logPrefix} LoyaltyProgram not found`);
    throw new OrdersPaidWebhookError("Loyalty program not configured", 404);
  }

  if (!loyaltyProgram.isActive) {
    console.log(`${logPrefix} Loyalty program inactive, skipping points`);
  }

  const customerEmail =
    shopifyCustomer?.email ?? orderPayload.email ?? orderPayload.contact_email;

  if (!customerEmail) {
    console.warn(`${logPrefix} No email for review request`);
    throw new OrdersPaidWebhookError("Customer email is required");
  }

  const result = await prisma.$transaction(async (tx) => {
    let customer = await tx.customer.findUnique({
      where: {
        storeId_shopifyCustomerId: {
          storeId: store.id,
          shopifyCustomerId,
        },
      },
    });

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          storeId: store.id,
          shopifyCustomerId,
          email: customerEmail,
          firstName: shopifyCustomer?.first_name ?? null,
          lastName: shopifyCustomer?.last_name ?? null,
        },
      });
      console.log(`${logPrefix} Customer created`, { customerId: customer.id });
    } else {
      customer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          email: customerEmail,
          firstName: shopifyCustomer?.first_name ?? customer.firstName,
          lastName: shopifyCustomer?.last_name ?? customer.lastName,
        },
      });
      console.log(`${logPrefix} Customer updated`, { customerId: customer.id });
    }

    const newLifetimeSpend =
      Number(customer.lifetimeSpend) + orderTotal;
    const tier = tierFromLifetimeSpend(newLifetimeSpend);

    customer = await tx.customer.update({
      where: { id: customer.id },
      data: {
        lifetimeSpend: newLifetimeSpend,
        tier,
      },
    });

    console.log(`${logPrefix} Tier updated`, {
      customerId: customer.id,
      lifetimeSpend: newLifetimeSpend,
      tier,
    });

    let pointsAwarded = 0;
    let transaction = null;

    const points = calculatePoints(
      orderTotal,
      loyaltyProgram.pointsPerDollar
    );

    console.log(`${logPrefix} Points calculated`, {
      points,
      pointsPerDollar: loyaltyProgram.pointsPerDollar,
    });

    if (loyaltyProgram.isActive && points >= 1) {
      const awardResult = await awardPoints(
        store.id,
        customer.id,
        points,
        `Order ${orderPayload.name ?? orderPayload.order_number ?? shopifyOrderId}`,
        shopifyOrderId,
        tx
      );
      transaction = awardResult.transaction;
      customer = awardResult.customer;
      pointsAwarded = points;
      console.log(`${logPrefix} Points awarded`, {
        points,
        transactionId: transaction.id,
      });
    } else {
      console.log(`${logPrefix} No points awarded`, {
        isActive: loyaltyProgram.isActive,
        points,
      });
    }

    const existingReview = await tx.reviewRequest.findUnique({
      where: {
        storeId_orderId: {
          storeId: store.id,
          orderId: shopifyOrderId,
        },
      },
    });

    let reviewRequest = existingReview;

    if (!reviewRequest) {
      reviewRequest = await tx.reviewRequest.create({
        data: {
          storeId: store.id,
          orderId: shopifyOrderId,
          customerId: customer.id,
          email: customerEmail,
          sentAt: null,
          reviewedAt: null,
          pointsAwarded: 0,
        },
      });
      console.log(`${logPrefix} ReviewRequest created`, {
        reviewRequestId: reviewRequest.id,
      });
    } else {
      console.log(`${logPrefix} ReviewRequest already exists`, {
        reviewRequestId: reviewRequest.id,
      });
    }

    return {
      store,
      customer,
      transaction,
      reviewRequest,
      pointsAwarded,
      shopifyOrderId,
      orderTotal,
      tier,
    };
  });

  console.log(`${logPrefix} Completed successfully`, {
    shopifyOrderId: result.shopifyOrderId,
    customerId: result.customer.id,
    pointsAwarded: result.pointsAwarded,
    tier: result.tier,
  });

  return result;
}
