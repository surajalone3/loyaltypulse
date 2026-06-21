const TIER_STYLES = {
  BRONZE: "lp-tier-badge lp-tier-badge--bronze",
  SILVER: "lp-tier-badge lp-tier-badge--silver",
  GOLD: "lp-tier-badge lp-tier-badge--gold",
  PLATINUM: "lp-tier-badge lp-tier-badge--platinum",
};

const TIER_LABELS = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

export default function TierBadge({ tier, name, color }) {
  const normalized = tier?.toUpperCase() ?? "BRONZE";
  const className = TIER_STYLES[normalized] ?? TIER_STYLES.BRONZE;
  const label = name ?? TIER_LABELS[normalized] ?? normalized;

  if (color) {
    return (
      <span
        className="lp-tier-badge"
        style={{
          backgroundColor: `${color}22`,
          borderColor: `${color}66`,
          color,
        }}
      >
        {label}
      </span>
    );
  }

  return <span className={className}>{label}</span>;
}
