import { shopify } from "../shopify.js";

const ORDERS_PAID_PATH = "/api/webhooks/orders-paid";

export function isDevModeEnabled() {
  const value = process.env.DEV_MODE?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function getOrdersPaidWebhookUrl() {
  const host = process.env.HOST?.replace(/\/$/, "");
  if (!host) {
    return null;
  }
  return `${host}${ORDERS_PAID_PATH}`;
}

function collectErrorText(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  const parts = [];

  if (error.message) {
    parts.push(error.message);
  }

  if (Array.isArray(error.graphQLErrors)) {
    parts.push(...error.graphQLErrors.map((entry) => entry.message));
  }

  if (Array.isArray(error.errors)) {
    parts.push(
      ...error.errors.map((entry) =>
        typeof entry === "string" ? entry : entry.message
      )
    );
  }

  if (Array.isArray(error.userErrors)) {
    parts.push(...error.userErrors.map((entry) => entry.message));
  }

  return parts.filter(Boolean).join(" ");
}

/**
 * Shopify blocks ORDERS_PAID subscriptions until protected customer data is approved.
 */
export function isProtectedCustomerDataError(error) {
  const text = collectErrorText(error).toLowerCase();

  return (
    text.includes("protected customer data") ||
    text.includes("protected_customer_data") ||
    text.includes("protected customer fields") ||
    (text.includes("not approved") &&
      (text.includes("customer") || text.includes("protected"))) ||
    text.includes("access to protected")
  );
}

function skipProtectedCustomerData(shop, context) {
  console.warn(
    `[webhook-register] Skipping orders/paid registration (${context}) for ${shop}: ` +
      "Shopify requires approved protected customer data access for ORDERS_PAID. " +
      "Register the webhook manually in development, or set DEV_MODE=true to skip automatic registration."
  );

  return {
    skipped: true,
    reason: "protected_customer_data",
    context,
  };
}

function getResponseErrors(response) {
  const errors = [];

  if (Array.isArray(response?.errors)) {
    errors.push(...response.errors);
  }

  if (response?.body?.errors) {
    errors.push(...response.body.errors);
  }

  return errors;
}

/**
 * Registers orders/paid webhook via Admin GraphQL if not already subscribed.
 */
export async function registerOrdersPaidWebhook(session) {
  if (isDevModeEnabled()) {
    console.warn(
      "[webhook-register] DEV_MODE is enabled; skipping automatic orders/paid registration"
    );
    return { skipped: true, reason: "dev_mode" };
  }

  const callbackUrl = getOrdersPaidWebhookUrl();

  if (!callbackUrl) {
    console.warn(
      "[webhook-register] HOST is not set; skipping orders/paid registration"
    );
    return { skipped: true, reason: "missing_host" };
  }

  const client = new shopify.clients.Graphql({ session });

  try {
    let listResponse;

    try {
      listResponse = await client.request(`#graphql
        query OrdersPaidWebhookSubscriptions {
          webhookSubscriptions(first: 25, topics: ORDERS_PAID) {
            edges {
              node {
                id
                topic
                endpoint {
                  __typename
                  ... on WebhookHttpEndpoint {
                    callbackUrl
                  }
                }
              }
            }
          }
        }
      `);
    } catch (listError) {
      if (isProtectedCustomerDataError(listError)) {
        return skipProtectedCustomerData(session.shop, "list");
      }
      throw listError;
    }

    const listErrors = getResponseErrors(listResponse);
    if (listErrors.some((error) => isProtectedCustomerDataError(error))) {
      return skipProtectedCustomerData(session.shop, "list");
    }

    const edges = listResponse.data?.webhookSubscriptions?.edges ?? [];

    const duplicate = edges.find(
      (edge) => edge.node?.endpoint?.callbackUrl === callbackUrl
    );

    if (duplicate) {
      console.log("[webhook-register] orders/paid already registered", {
        shop: session.shop,
        callbackUrl,
        webhookId: duplicate.node.id,
      });
      return {
        skipped: true,
        reason: "already_exists",
        webhookId: duplicate.node.id,
        callbackUrl,
      };
    }

    let createResponse;

    try {
      createResponse = await client.request(
        `#graphql
        mutation RegisterOrdersPaidWebhook($callbackUrl: URL!) {
          webhookSubscriptionCreate(
            topic: ORDERS_PAID
            webhookSubscription: {
              format: JSON
              callbackUrl: $callbackUrl
            }
          ) {
            webhookSubscription {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: { callbackUrl },
        }
      );
    } catch (createError) {
      if (isProtectedCustomerDataError(createError)) {
        return skipProtectedCustomerData(session.shop, "create");
      }
      throw createError;
    }

    const createErrors = getResponseErrors(createResponse);
    if (createErrors.some((error) => isProtectedCustomerDataError(error))) {
      return skipProtectedCustomerData(session.shop, "create");
    }

    const payload = createResponse.data?.webhookSubscriptionCreate;
    const userErrors = payload?.userErrors ?? [];

    if (userErrors.length > 0) {
      const combined = userErrors
        .map((error) => `${error.field}: ${error.message}`)
        .join("; ");

      if (isProtectedCustomerDataError(combined)) {
        return skipProtectedCustomerData(session.shop, "create");
      }

      throw new Error(`webhookSubscriptionCreate failed: ${combined}`);
    }

    const webhookSubscription = payload?.webhookSubscription;

    console.log("[webhook-register] orders/paid webhook created", {
      shop: session.shop,
      callbackUrl,
      webhookId: webhookSubscription?.id,
    });

    return {
      created: true,
      webhookId: webhookSubscription?.id,
      callbackUrl,
    };
  } catch (error) {
    if (isProtectedCustomerDataError(error)) {
      return skipProtectedCustomerData(session.shop, "request");
    }
    throw error;
  }
}

const APP_UNINSTALLED_PATH = "/api/webhooks/app-uninstalled";

export function getAppUninstalledWebhookUrl() {
  const host = process.env.HOST?.replace(/\/$/, "");
  if (!host) {
    return null;
  }
  return `${host}${APP_UNINSTALLED_PATH}`;
}

async function registerTopicWebhook(session, topic, callbackPath) {
  const callbackUrl = `${process.env.HOST?.replace(/\/$/, "")}${callbackPath}`;
  if (!callbackUrl || callbackUrl.includes("undefined")) {
    return { skipped: true, reason: "missing_host" };
  }

  const client = new shopify.clients.Graphql({ session });

  const listResponse = await client.request(
    `#graphql
    query WebhookSubscriptions($topic: WebhookSubscriptionTopic!) {
      webhookSubscriptions(first: 25, topics: $topic) {
        edges {
          node {
            id
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    }`,
    { variables: { topic } }
  );

  const edges = listResponse.data?.webhookSubscriptions?.edges ?? [];
  const duplicate = edges.find(
    (edge) => edge.node?.endpoint?.callbackUrl === callbackUrl
  );

  if (duplicate) {
    return {
      skipped: true,
      reason: "already_exists",
      webhookId: duplicate.node.id,
      callbackUrl,
    };
  }

  const createResponse = await client.request(
    `#graphql
    mutation RegisterWebhook($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
      webhookSubscriptionCreate(
        topic: $topic
        webhookSubscription: { format: JSON, callbackUrl: $callbackUrl }
      ) {
        webhookSubscription { id }
        userErrors { field message }
      }
    }`,
    { variables: { topic, callbackUrl } }
  );

  const userErrors =
    createResponse.data?.webhookSubscriptionCreate?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(
      `webhookSubscriptionCreate(${topic}) failed: ${userErrors
        .map((error) => error.message)
        .join("; ")}`
    );
  }

  const webhookId =
    createResponse.data?.webhookSubscriptionCreate?.webhookSubscription?.id;

  console.log("[webhook-register] webhook created", {
    shop: session.shop,
    topic,
    callbackUrl,
    webhookId,
  });

  return { created: true, webhookId, callbackUrl, topic };
}

/**
 * Registers app/uninstalled webhook via Admin GraphQL if not already subscribed.
 */
export async function registerAppUninstalledWebhook(session) {
  if (isDevModeEnabled()) {
    console.warn(
      "[webhook-register] DEV_MODE is enabled; skipping automatic app/uninstalled registration"
    );
    return { skipped: true, reason: "dev_mode" };
  }

  try {
    return await registerTopicWebhook(
      session,
      "APP_UNINSTALLED",
      APP_UNINSTALLED_PATH
    );
  } catch (error) {
    console.warn("[webhook-register] app/uninstalled registration failed:", error.message);
    return { skipped: true, reason: "registration_failed", error: error.message };
  }
}
