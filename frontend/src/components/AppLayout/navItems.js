import {
  DashboardIcon,
  CustomersIcon,
  TransactionsIcon,
  RewardsIcon,
  ReviewsIcon,
  SettingsIcon,
} from "./icons.jsx";

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon, href: "/" },
  { id: "customers", label: "Customers", icon: CustomersIcon, href: "/customers" },
  { id: "transactions", label: "Transactions", icon: TransactionsIcon, href: "/transactions" },
  { id: "rewards", label: "Rewards", icon: RewardsIcon, href: "/rewards" },
  { id: "reviews", label: "Reviews", icon: ReviewsIcon, href: "/reviews" },
  { id: "settings", label: "Settings", icon: SettingsIcon, href: "/settings" },
];
