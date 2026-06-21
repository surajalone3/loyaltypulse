import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";
import MetricCard from "../components/ui/MetricCard.jsx";
import {
  formatCount,
  formatDateTime,
  formatPercent,
  getCustomerInitials,
  trendFromSeries,
} from "../utils/format.js";

const TIER_ICONS = {
  PLATINUM: "💎",
  GOLD: "👑",
  SILVER: "🥈",
  BRONZE: "🥉",
};

function activityLabel(type) {
  switch (type) {
    case "points_earned":
      return "Points earned";
    case "points_redeemed":
      return "Points redeemed";
    case "reward_redemption":
      return "Reward redeemed";
    default:
      return type;
  }
}

function formatActivityPoints(type, points) {
  const value = Number(points ?? 0);
  if (type === "points_redeemed" || type === "reward_redemption") {
    return { text: `-${formatCount(value)} pts`, className: "lp-points-negative" };
  }
  return { text: `+${formatCount(value)} pts`, className: "lp-points-positive" };
}

function TopRewardsPanel({ rewards, recentActivity, totalRedemptions }) {
  const rewardStats = useMemo(() => {
    const counts = new Map();

    for (const item of recentActivity ?? []) {
      if (item.activityType !== "reward_redemption" || !item.detail) {
        continue;
      }
      const name = item.detail.split(" · ")[0]?.trim();
      if (!name) {
        continue;
      }
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return (rewards ?? [])
      .map((reward) => ({
        ...reward,
        redemptionCount: counts.get(reward.name) ?? 0,
      }))
      .sort((a, b) => b.redemptionCount - a.redemptionCount)
      .slice(0, 5);
  }, [rewards, recentActivity]);

  const maxCount = Math.max(1, ...rewardStats.map((item) => item.redemptionCount), totalRedemptions);

  return (
    <div className="lp-panel-card">
      <div className="lp-panel-card-header">
        <h3 className="lp-panel-card-title">Top rewards</h3>
        <span className="lp-panel-card-meta">Last 30 days</span>
      </div>

      {rewardStats.length === 0 ? (
        <p className="lp-empty-state" style={{ padding: "24px 0" }}>
          No reward redemptions yet. Create rewards to start tracking performance.
        </p>
      ) : (
        <div className="lp-progress-list">
          {rewardStats.map((reward) => {
            const width = Math.round((reward.redemptionCount / maxCount) * 100);
            return (
              <div key={reward.id} className="lp-progress-row">
                <span className="lp-progress-label">{reward.name}</span>
                <div className="lp-progress-track">
                  <div
                    className="lp-progress-fill"
                    style={{ width: `${Math.max(width, reward.redemptionCount > 0 ? 8 : 0)}%` }}
                  />
                </div>
                <span className="lp-progress-value">
                  {reward.redemptionCount > 0
                    ? `${formatCount(reward.redemptionCount)}`
                    : `${formatCount(reward.pointsRequired)} pts`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoyaltyTiersPanel({ distribution, customersPerTier }) {
  const rows = distribution ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0);

  return (
    <div className="lp-panel-card">
      <div className="lp-panel-card-header">
        <h3 className="lp-panel-card-title">Loyalty tiers</h3>
        <span className="lp-panel-card-meta">{formatCount(total)} members</span>
      </div>

      {rows.length === 0 ? (
        <p className="lp-empty-state" style={{ padding: "24px 0" }}>
          No tier data yet.
        </p>
      ) : (
        <div className="lp-tier-list">
          {rows.map((row) => (
            <div key={row.tierKey} className="lp-tier-row">
              <div className="lp-tier-icon" style={{ color: row.color }}>
                {TIER_ICONS[row.tierKey] ?? "★"}
              </div>
              <div className="lp-tier-info">
                <p className="lp-tier-name">{row.name}</p>
                <p className="lp-tier-sub">
                  {formatCount(customersPerTier?.[row.tierKey] ?? row.count)} active members
                </p>
              </div>
              <span className="lp-tier-count">{formatCount(row.count)} members</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [dashboard, setDashboard] = useState({
    metrics: {},
    recentActivity: [],
    charts: {},
  });

  const loadDashboard = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [data, rewardsData] = await Promise.all([
        fetchWithSession(app, "/api/dashboard"),
        fetchWithSession(app, "/api/rewards").catch(() => ({ data: [] })),
      ]);

      setDashboard({
        metrics: data.metrics ?? {},
        recentActivity: data.recentActivity ?? [],
        charts: data.charts ?? {},
      });
      setRewards(rewardsData.data ?? []);
    } catch (err) {
      setError(err.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const { metrics, recentActivity, charts } = dashboard;

  if (loading) {
    return (
      <div className="lp-card lp-loading-center">
        <Spinner accessibilityLabel="Loading dashboard" size="large" />
      </div>
    );
  }

  const memberTrend = trendFromSeries(charts.newMembersOverTime);
  const pointsTrend = trendFromSeries(charts.pointsIssuedOverTime);
  const redemptionTrend = trendFromSeries(charts.redemptionsOverTime);

  return (
    <div className="lp-page-stack">
      {error && (
        <div className="lp-banner lp-banner--critical" role="alert">
          Could not load dashboard: {error}
        </div>
      )}

      <div className="lp-metric-grid">
        <MetricCard
          label="Loyalty members"
          value={formatCount(metrics.totalLoyaltyMembers)}
          trend={memberTrend}
          accent
        />
        <MetricCard
          label="Points issued"
          value={formatCount(metrics.totalPointsIssued)}
          trend={pointsTrend}
        />
        <MetricCard
          label="Active rewards"
          value={formatCount(metrics.activeRewards)}
        />
        <MetricCard
          label="Total redemptions"
          value={formatCount(metrics.totalRedemptions)}
          trend={redemptionTrend}
        />
      </div>

      <div className="lp-dashboard-analytics">
        <TopRewardsPanel
          rewards={rewards}
          recentActivity={recentActivity}
          totalRedemptions={metrics.totalRedemptions}
        />
        <LoyaltyTiersPanel
          distribution={charts.tierDistribution}
          customersPerTier={metrics.customersPerTier}
        />
      </div>

      <div className="lp-referral-strip">
        <MetricCard
          label="Total referrals"
          value={formatCount(metrics.totalReferrals)}
          accent
        />
        <MetricCard
          label="Referral conversion"
          value={formatPercent(metrics.referralConversionRate)}
        />
        <MetricCard
          label="Completed referrals"
          value={formatCount(metrics.completedReferrals)}
        />
      </div>

      <div className="lp-panel-card lp-table-card">
        <div className="lp-panel-card-header" style={{ padding: "0 16px" }}>
          <h3 className="lp-panel-card-title">Recent loyalty activity</h3>
          <span className="lp-live-pill">
            <span className="lp-live-pill-dot" aria-hidden="true" />
            Live
          </span>
        </div>

        {recentActivity.length === 0 ? (
          <div className="lp-empty-state">
            No loyalty activity yet. Member signups, points, and redemptions will appear here.
          </div>
        ) : (
          <div className="lp-table-wrap">
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Activity</th>
                  <th>Points</th>
                  <th>Details</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((item) => {
                  const points = formatActivityPoints(item.activityType, item.points);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="lp-table-customer-row">
                          <div className="lp-customer-avatar">
                            {getCustomerInitials({
                              firstName: item.customer?.name?.split(" ")[0],
                              lastName: item.customer?.name?.split(" ").slice(1).join(" "),
                              email: item.customer?.email,
                            })}
                          </div>
                          <div className="lp-table-customer">
                            <span className="lp-table-customer-name">
                              {item.customer?.name ?? "Unknown"}
                            </span>
                            {item.customer?.email && (
                              <span className="lp-table-customer-email">
                                {item.customer.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{activityLabel(item.activityType)}</td>
                      <td>
                        <span className={points.className}>{points.text}</span>
                      </td>
                      <td>{item.detail ?? "—"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
