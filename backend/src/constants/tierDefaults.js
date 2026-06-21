export const TIER_KEYS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

export const DEFAULT_LOYALTY_TIERS = [
  {
    tierKey: "BRONZE",
    name: "Bronze",
    minLifetimeSpend: 0,
    color: "#CD7F32",
    benefitsDescription: "Earn points on every purchase.",
    enabled: true,
    sortOrder: 0,
  },
  {
    tierKey: "SILVER",
    name: "Silver",
    minLifetimeSpend: 500,
    color: "#C0C0C0",
    benefitsDescription: "Unlock bonus earning opportunities.",
    enabled: true,
    sortOrder: 1,
  },
  {
    tierKey: "GOLD",
    name: "Gold",
    minLifetimeSpend: 1000,
    color: "#FFD700",
    benefitsDescription: "Priority access to exclusive rewards.",
    enabled: true,
    sortOrder: 2,
  },
  {
    tierKey: "PLATINUM",
    name: "Platinum",
    minLifetimeSpend: 3000,
    color: "#E5E4E2",
    benefitsDescription: "VIP perks and highest earning rate.",
    enabled: true,
    sortOrder: 3,
  },
];
