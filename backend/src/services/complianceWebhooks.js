import { prisma } from "../shopify.js";

function shopifyCustomerGidFromPayload(customerId, shopifyCustomerId) {
  if (shopifyCustomerId) {
    return String(shopifyCustomerId).startsWith("gid://")
      ? shopifyCustomerId
      : `gid://shopify/Customer/${shopifyCustomerId}`;
  }
  if (customerId) {
    return `gid://shopify/Customer/${customerId}`;
  }
  return null;
}

/**
 * CUSTOMERS_DATA_REQUEST — compile stored customer data for merchant fulfillment.
 */
export async function handleCustomersDataRequest(shop, payload) {
  const store = await prisma.store.findUnique({ where: { shop } });
  if (!store) {
    return { found: false, shop };
  }

  const customerGid = shopifyCustomerGidFromPayload(
    payload.customer?.id,
    payload.customer?.id
  );
  const email = payload.customer?.email;

  const customer = customerGid
    ? await prisma.customer.findFirst({
        where: { storeId: store.id, shopifyCustomerId: customerGid },
        include: {
          pointsTransactions: { orderBy: { createdAt: "desc" }, take: 100 },
          redemptions: {
            include: { reward: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          referralsMade: true,
          referralReceived: true,
        },
      })
    : email
      ? await prisma.customer.findFirst({
          where: { storeId: store.id, email },
        })
      : null;

  console.log("[gdpr] customers/data_request", {
    shop,
    customerId: customer?.id ?? null,
    ordersRequested: payload.orders_requested?.length ?? 0,
  });

  return {
    found: Boolean(customer),
    shop,
    dataRequestId: payload.data_request?.id ?? null,
    customer: customer
      ? {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          totalPoints: customer.totalPoints,
          lifetimePoints: customer.lifetimePoints,
          lifetimeSpend: Number(customer.lifetimeSpend),
          tier: customer.tier,
          pointsTransactions: customer.pointsTransactions?.map((tx) => ({
            type: tx.type,
            points: tx.points,
            reason: tx.reason,
            createdAt: tx.createdAt,
          })),
          redemptions: customer.redemptions?.map((entry) => ({
            rewardName: entry.reward?.name,
            couponCode: entry.couponCode,
            pointsSpent: entry.pointsSpent,
            createdAt: entry.createdAt,
          })),
        }
      : null,
  };
}

/**
 * CUSTOMERS_REDACT — erase/anonymize customer PII while retaining non-identifying ledger rows if needed.
 */
export async function handleCustomersRedact(shop, payload) {
  const store = await prisma.store.findUnique({ where: { shop } });
  if (!store) {
    return { deleted: false, shop };
  }

  const customerGid = shopifyCustomerGidFromPayload(
    payload.customer?.id,
    payload.customer?.id
  );

  if (!customerGid) {
    return { deleted: false, shop, reason: "missing_customer_id" };
  }

  const customer = await prisma.customer.findFirst({
    where: { storeId: store.id, shopifyCustomerId: customerGid },
    select: { id: true },
  });

  if (!customer) {
    console.log("[gdpr] customers/redact — no local customer", { shop, customerGid });
    return { deleted: false, shop, reason: "not_found" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.reviewRequest.updateMany({
      where: { customerId: customer.id },
      data: { email: "redacted@loyaltypulse.local", customerId: null },
    });

    await tx.customer.delete({ where: { id: customer.id } });
  });

  console.log("[gdpr] customers/redact completed", { shop, customerId: customer.id });

  return { deleted: true, shop, customerId: customer.id };
}

/**
 * SHOP_REDACT — delete all shop data after app uninstall retention window.
 */
export async function handleShopRedact(shop) {
  const store = await prisma.store.findUnique({ where: { shop } });
  if (!store) {
    return { deleted: false, shop, reason: "not_found" };
  }

  await prisma.store.delete({ where: { id: store.id } });

  await prisma.session.deleteMany({ where: { shop } });

  console.log("[gdpr] shop/redact completed", { shop, storeId: store.id });

  return { deleted: true, shop, storeId: store.id };
}

/**
 * APP_UNINSTALLED — deactivate store and clear sessions immediately.
 */
export async function handleAppUninstalled(shop) {
  const store = await prisma.store.findUnique({ where: { shop } });

  if (store) {
    await prisma.store.update({
      where: { id: store.id },
      data: { isActive: false },
    });
  }

  const deletedSessions = await prisma.session.deleteMany({ where: { shop } });

  console.log("[webhook] app/uninstalled", {
    shop,
    storeDeactivated: Boolean(store),
    sessionsDeleted: deletedSessions.count,
  });

  return {
    shop,
    storeDeactivated: Boolean(store),
    sessionsDeleted: deletedSessions.count,
  };
}
