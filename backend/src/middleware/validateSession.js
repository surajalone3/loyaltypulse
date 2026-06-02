import { Session } from "@shopify/shopify-api";
import { shopify, prisma } from "../shopify.js";

function getBearerToken(req) {
  const header = req.headers.authorization ?? req.headers.Authorization;

  if (!header) {
    return null;
  }

  const value = Array.isArray(header) ? header[0] : header;
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function shopFromSessionDest(dest) {
  try {
    return new URL(dest).hostname;
  } catch {
    return dest.replace(/^https?:\/\//, "").split("/")[0];
  }
}

async function resolveOfflineSession(shop) {
  const offlineId = shopify.session.getOfflineId(shop);

  let session = await shopify.config.sessionStorage.loadSession(offlineId);

  if (session?.accessToken) {
    return session;
  }

  const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);
  session =
    sessions.find((entry) => entry.accessToken && !entry.isOnline) ??
    sessions.find((entry) => entry.accessToken);

  if (session?.accessToken) {
    return session;
  }

  const store = await prisma.store.findUnique({
    where: { shop },
  });

  if (store?.accessToken) {
    console.warn(
      "[auth] Using Store.accessToken fallback for shop (Session row missing):",
      shop
    );
    return new Session({
      id: offlineId,
      shop,
      state: "",
      isOnline: false,
      accessToken: store.accessToken,
      scope: process.env.SHOPIFY_SCOPES,
    });
  }

  return null;
}

/**
 * Validates App Bridge session token (Bearer JWT) and loads the offline shop session.
 */
export async function validateSession(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing Authorization Bearer token",
      });
    }

    const payload = await shopify.session.decodeSessionToken(token);
    const shop = shopFromSessionDest(payload.dest);

    if (!shop) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Could not resolve shop from session token",
      });
    }

    const session = await resolveOfflineSession(shop);

    if (!session?.accessToken) {
      console.warn("[auth] Session not found for shop:", shop, {
        offlineId: shopify.session.getOfflineId(shop),
      });
      return res.status(401).json({
        error: "Session not found",
        message:
          "Install or reinstall the app on this store to create an offline session.",
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[auth] Session validated for shop:", shop);
    }

    res.locals.shopify = { session };
    next();
  } catch (error) {
    console.error("Session validation failed:", error);
    res.status(401).json({
      error: "Unauthorized",
      message: error.message ?? "Session validation failed",
    });
  }
}
