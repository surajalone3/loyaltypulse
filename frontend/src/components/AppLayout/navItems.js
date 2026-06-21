export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", href: "/" },
  { id: "customers", label: "Customers", href: "/customers" },
  { id: "transactions", label: "Transactions", href: "/transactions" },
  { id: "rewards", label: "Rewards", href: "/rewards" },
  { id: "reviews", label: "Reviews", href: "/reviews" },
  { id: "settings", label: "Settings", href: "/settings" },
];

function normalizePath(pathname) {
  const path = pathname.split("?")[0].split("#")[0];
  const trimmed = path.replace(/\/+$/, "");
  return trimmed || "/";
}

export function pageFromPath(pathname) {
  const normalized = normalizePath(pathname);
  const match = NAV_ITEMS.find((item) => normalizePath(item.href) === normalized);
  return match?.id ?? "dashboard";
}

export function hrefFromPage(pageId) {
  return NAV_ITEMS.find((item) => item.id === pageId)?.href ?? "/";
}
