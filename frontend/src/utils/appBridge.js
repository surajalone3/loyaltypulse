const EMBEDDED_SESSION_KEY = "loyaltypulse:embedded";

/**
 * True when loaded inside Shopify admin (host or shop query param).
 * Sticky for the session so SPA navigation cannot drop embedded mode
 * when pushState/replaceState omits Shopify query params.
 */
export function isEmbeddedApp() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("host") || params.has("shop")) {
    try {
      sessionStorage.setItem(EMBEDDED_SESSION_KEY, "1");
    } catch {
      // sessionStorage may be unavailable in some contexts
    }
    return true;
  }

  try {
    if (sessionStorage.getItem(EMBEDDED_SESSION_KEY) === "1") {
      return true;
    }
  } catch {
    // ignore
  }

  try {
    if (window.self !== window.top) {
      try {
        sessionStorage.setItem(EMBEDDED_SESSION_KEY, "1");
      } catch {
        // ignore
      }
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Shopify session query string (?host=...&shop=...) — must be preserved on SPA navigations.
 */
export function getEmbeddedSearch() {
  return window.location.search || "";
}

/**
 * Build an in-app path that keeps Shopify embedded query params.
 */
export function buildAppPath(pathname) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalized = path.replace(/\/+$/, "") || "/";
  const search = getEmbeddedSearch();
  return search ? `${normalized}${search}` : normalized;
}
