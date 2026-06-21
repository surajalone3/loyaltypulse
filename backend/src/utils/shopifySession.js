import { Session } from "@shopify/shopify-api";
import { shopify } from "../shopify.js";

/**
 * Loads an offline Admin API session for a store row.
 */
export async function loadOfflineSessionForShop(shop, accessToken) {
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

  if (accessToken) {
    return new Session({
      id: offlineId,
      shop,
      state: "",
      isOnline: false,
      accessToken,
      scope: process.env.SHOPIFY_SCOPES,
    });
  }

  return null;
}

export async function loadOfflineSessionForStore(store) {
  return loadOfflineSessionForShop(store.shop, store.accessToken);
}
