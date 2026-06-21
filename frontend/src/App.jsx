import { useEffect, useState } from "react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";
import { NavMenu } from "@shopify/app-bridge-react";
import AppLayout from "./components/AppLayout/AppLayout.jsx";
import {
  NAV_ITEMS,
  hrefFromPage,
  pageFromPath,
} from "./components/AppLayout/navItems.js";
import DashboardPage from "./pages/DashboardPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import TransactionsPage from "./pages/TransactionsPage.jsx";
import RewardsPage from "./pages/RewardsPage.jsx";
import ReviewsPage from "./pages/ReviewsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import { isEmbeddedApp } from "./utils/appBridge.js";
import "./styles/global.css";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  customers: "Customers",
  transactions: "Transactions",
  rewards: "Rewards",
  reviews: "Reviews",
  settings: "Settings",
};

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
    const href = hrefFromPage(target);
    window.history.pushState({ page: target }, "", href);
    onNavigate(target);
  };

  return (
    <>
      <NavMenu>
        <a href="/" rel="home" onClick={(event) => handleNav(event, "dashboard")}>
          Dashboard
        </a>
        {NAV_ITEMS.map(({ id, label, href }) => (
          <a key={id} href={href} onClick={(event) => handleNav(event, id)}>
            {label}
          </a>
        ))}
      </NavMenu>
      {children}
    </>
  );
}

function useSyncedPageNavigation() {
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname));

  useEffect(() => {
    const syncPageFromUrl = () => {
      setPage(pageFromPath(window.location.pathname));
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = (...args) => {
      originalPushState(...args);
      syncPageFromUrl();
    };

    window.history.replaceState = (...args) => {
      originalReplaceState(...args);
      syncPageFromUrl();
    };

    window.addEventListener("popstate", syncPageFromUrl);
    syncPageFromUrl();

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", syncPageFromUrl);
    };
  }, []);

  return [page, setPage];
}

function renderPage(page) {
  switch (page) {
    case "customers":
      return <CustomersPage />;
    case "transactions":
      return <TransactionsPage />;
    case "rewards":
      return <RewardsPage />;
    case "reviews":
      return <ReviewsPage />;
    case "settings":
      return <SettingsPage />;
    case "dashboard":
    default:
      return <DashboardPage />;
  }
}

export default function App() {
  const [page, setPage] = useSyncedPageNavigation();

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
        <AppLayout title={PAGE_TITLES[page] ?? "Dashboard"}>
          {renderPage(page)}
        </AppLayout>
      </AppNavigation>
    </PolarisAppProvider>
  );
}
