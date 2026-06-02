/**
 * True when loaded inside Shopify admin (host or shop query param).
 */
export function isEmbeddedApp() {
  const params = new URLSearchParams(window.location.search);
  return params.has("host") || params.has("shop");
}
