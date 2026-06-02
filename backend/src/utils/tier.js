/**
 * Tier thresholds based on lifetime spend (USD).
 * BRONZE: < $200 | SILVER: $200–$499 | GOLD: $500+
 */
export function tierFromLifetimeSpend(lifetimeSpend) {
  const amount = Number(lifetimeSpend);

  if (amount >= 500) {
    return "GOLD";
  }
  if (amount >= 200) {
    return "SILVER";
  }
  return "BRONZE";
}
