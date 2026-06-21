import { useCallback, useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../../utils/api.js";
import "./AppLayout.css";

export default function AppLayout({ title, headerActions, children }) {
  const app = useAppBridge();
  const [shop, setShop] = useState(null);

  const loadShop = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      const data = await fetchWithSession(app, "/api");
      setShop(data.shop ?? null);
    } catch {
      setShop(null);
    }
  }, [app]);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  const avatarLabel = shop
    ? shop.replace(".myshopify.com", "").slice(0, 2).toUpperCase()
    : "LP";

  return (
    <div className="lp-app">
      <header className="lp-header">
        <h1 className="lp-header-title">{title}</h1>
        <div className="lp-header-actions">
          {shop && (
            <div className="lp-shop-pill">
              <span className="lp-shop-dot" aria-hidden="true" />
              {shop}
            </div>
          )}
          {headerActions}
          <div className="lp-user-avatar" aria-hidden="true">
            {avatarLabel}
          </div>
        </div>
      </header>

      <main className="lp-content">{children}</main>
    </div>
  );
}
