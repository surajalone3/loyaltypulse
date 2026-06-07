const TIER_STYLES = {
  BRONZE: "lp-tier-badge lp-tier-badge--bronze",
  SILVER: "lp-tier-badge lp-tier-badge--silver",
  GOLD: "lp-tier-badge lp-tier-badge--gold",
};

const TIER_LABELS = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
};

export default function TierBadge({ tier }) {
  const normalized = tier?.toUpperCase() ?? "BRONZE";
  const className = TIER_STYLES[normalized] ?? TIER_STYLES.BRONZE;
  const label = TIER_LABELS[normalized] ?? normalized;

  return <span className={className}>{label}</span>;
}
