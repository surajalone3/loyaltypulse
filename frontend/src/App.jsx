import { useState } from "react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";
import { NavMenu } from "@shopify/app-bridge-react";
import DashboardPage from "./pages/DashboardPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import { isEmbeddedApp } from "./utils/appBridge.js";

function StandaloneMessage() {
  return (
    <div style={{ padding: "2rem", maxWidth: "40rem" }}>
      <h1>LoyaltyPulse</h1>
      <p>
        Install or open this app from Shopify admin. To install on a dev store,
        visit:
      </p>
      <p>
        <code>/auth?shop=your-store.myshopify.com</code>
      </p>
    </div>
  );
}

function AppNavigation({ onNavigate, children }) {
  const handleNav = (event, target) => {
    event.preventDefault();
    onNavigate(target);
  };

  return (
    <>
      <NavMenu>
        <a
          href="/"
          rel="home"
          onClick={(event) => handleNav(event, "dashboard")}
        >
          Dashboard
        </a>
        <a href="/settings" onClick={(event) => handleNav(event, "settings")}>
          Settings
        </a>
      </NavMenu>
      {children}
    </>
  );
}

export default function App() {
  const [page, setPage] = useState("dashboard");

  if (!isEmbeddedApp()) {
    return (
      <PolarisAppProvider i18n={enTranslations}>
        <StandaloneMessage />
      </PolarisAppProvider>
    );
  }

  return (
    <PolarisAppProvider i18n={enTranslations}>
      <AppNavigation onNavigate={setPage}>
        {page === "settings" ? <SettingsPage /> : <DashboardPage />}
      </AppNavigation>
    </PolarisAppProvider>
  );
}
