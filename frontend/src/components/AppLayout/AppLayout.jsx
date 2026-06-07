import { useCallback, useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { NAV_ITEMS } from "./navItems.js";
import { LogoIcon } from "./icons.jsx";
import { fetchWithSession } from "../../utils/api.js";
import "./AppLayout.css";

export default function AppLayout({
  activePage,
  onNavigate,
  title,
  headerActions,
  children,
}) {
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

  const handleNav = (event, pageId) => {
    event.preventDefault();
    onNavigate(pageId);
  };

  return (
    <div className="lp-app">
      <aside className="lp-sidebar">
        <div className="lp-brand">
          <div className="lp-brand-icon">
            <LogoIcon />
          </div>
          <span className="lp-brand-name">LoyaltyPulse</span>
        </div>

        <nav className="lp-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => (
            <a
              key={id}
              href={href}
              className={`lp-nav-link${activePage === id ? " lp-nav-link--active" : ""}`}
              onClick={(event) => handleNav(event, id)}
              aria-current={activePage === id ? "page" : undefined}
            >
              <span className="lp-nav-icon">
                <Icon />
              </span>
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="lp-main">
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
          </div>
        </header>

        <main className="lp-content">{children}</main>
      </div>
    </div>
  );
}
