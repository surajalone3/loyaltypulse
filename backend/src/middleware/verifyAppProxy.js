import crypto from "crypto";

const TIMESTAMP_MAX_AGE_SEC = 90;

/**
 * Builds the HMAC message per Shopify app proxy spec.
 * https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
 */
function buildAppProxyMessage(query) {
  const sortedKeys = Object.keys(query)
    .filter((key) => key !== "signature")
    .sort();

  return sortedKeys
    .map((key) => {
      const value = query[key];
      const normalized = Array.isArray(value)
        ? value.join(",")
        : String(value ?? "");
      return `${key}=${normalized}`;
    })
    .join("");
}

/**
 * Verifies Shopify App Proxy HMAC (query.signature).
 */
export function verifyAppProxy(req, res, next) {
  console.log("[app-proxy] verify start", {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    shop: req.query.shop ?? null,
  });

  try {
    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) {
      console.error("[app-proxy] SHOPIFY_API_SECRET is not configured");
      return res.status(500).json({ error: "App proxy is not configured" });
    }

    const { signature, shop, timestamp } = req.query;

    if (!signature || !shop) {
      console.warn("[app-proxy] Missing signature or shop", {
        path: req.originalUrl,
        hasSignature: Boolean(signature),
        hasShop: Boolean(shop),
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    const requestTimestamp = Number(timestamp);
    if (!Number.isFinite(requestTimestamp)) {
      console.warn("[app-proxy] Invalid timestamp", {
        path: req.originalUrl,
        timestamp,
      });
      return res.status(401).json({ error: "Invalid timestamp" });
    }

    const ageSec = Math.floor(Date.now() / 1000) - requestTimestamp;
    if (ageSec < 0 || ageSec > TIMESTAMP_MAX_AGE_SEC) {
      console.warn("[app-proxy] Request expired", {
        path: req.originalUrl,
        ageSec,
        timestamp: requestTimestamp,
      });
      return res.status(401).json({ error: "Request expired" });
    }

    const message = buildAppProxyMessage(req.query);
    const digest = crypto
      .createHmac("sha256", secret)
      .update(message)
      .digest("hex");

    const signatureBuffer = Buffer.from(String(signature), "utf8");
    const digestBuffer = Buffer.from(digest, "utf8");

    if (
      signatureBuffer.length !== digestBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
    ) {
      console.warn("[app-proxy] Invalid signature", {
        path: req.originalUrl,
        shop,
        message,
        receivedSignature: String(signature),
      });
      return res.status(401).json({ error: "Invalid signature" });
    }

    req.appProxy = {
      shop: String(shop),
      loggedInCustomerId: req.query.logged_in_customer_id
        ? String(req.query.logged_in_customer_id)
        : null,
    };

    console.log("[app-proxy] Verified request", {
      shop: req.appProxy.shop,
      loggedInCustomerId: req.appProxy.loggedInCustomerId,
      path: req.path,
    });

    next();
  } catch (error) {
    console.error("[app-proxy] verification failed:", error);
    res.status(500).json({ error: "App proxy verification failed" });
  }
}
