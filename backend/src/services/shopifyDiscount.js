import { shopify } from "../shopify.js";
import { loadOfflineSessionForStore } from "../utils/shopifySession.js";

export class ShopifyDiscountError extends Error {
  constructor(message, statusCode = 502, code = "shopify_discount_failed") {
    super(message);
    this.name = "ShopifyDiscountError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function buildCustomerGetsValue(discountType, discountValue) {
  const value = Number(discountValue);

  if (discountType === "FIXED_AMOUNT") {
    return {
      discountAmount: {
        amount: value.toFixed(2),
        appliesOnEachItem: false,
      },
    };
  }

  return {
    percentage: value / 100,
  };
}

/**
 * Creates a single-use Shopify discount code redeemable at checkout.
 */
export async function createShopifyDiscountCode({
  store,
  code,
  title,
  discountType,
  discountValue,
  customerShopifyGid = null,
}) {
  const session = await loadOfflineSessionForStore(store);

  if (!session?.accessToken) {
    throw new ShopifyDiscountError(
      "Shopify session not found for store",
      503,
      "missing_session"
    );
  }

  const client = new shopify.clients.Graphql({ session });

  const customerSelection = customerShopifyGid
    ? { customers: { add: [customerShopifyGid] } }
    : { all: true };

  const response = await client.request(
    `#graphql
    mutation CreateLoyaltyDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        basicCodeDiscount: {
          title,
          code,
          startsAt: new Date().toISOString(),
          customerSelection,
          customerGets: {
            value: buildCustomerGetsValue(discountType, discountValue),
            items: { all: true },
          },
          usageLimit: 1,
          appliesOncePerCustomer: true,
        },
      },
    }
  );

  const payload = response.data?.discountCodeBasicCreate;
  const userErrors = payload?.userErrors ?? [];

  if (userErrors.length > 0) {
    const message = userErrors.map((error) => error.message).join("; ");
    throw new ShopifyDiscountError(message, 502, "shopify_user_error");
  }

  const shopifyDiscountId = payload?.codeDiscountNode?.id;

  if (!shopifyDiscountId) {
    throw new ShopifyDiscountError(
      "Shopify did not return a discount id",
      502,
      "missing_discount_id"
    );
  }

  console.log("[shopify-discount] created", {
    shop: store.shop,
    code,
    shopifyDiscountId,
    discountType,
    discountValue: Number(discountValue),
  });

  return {
    shopifyDiscountId,
    code,
    discountType,
    discountValue: Number(discountValue),
  };
}
