/**
 * Required for Shopify Admin to embed the app in an iframe.
 * Do not set X-Frame-Options — it overrides CSP and blocks embedding.
 */
export function embeddedAppHeaders(_req, res, next) {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://*.myshopify.io;"
  );
  next();
}
