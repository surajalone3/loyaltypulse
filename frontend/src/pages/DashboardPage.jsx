import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";

function MetricCard({ label, value, accent }) {
  return (
    <div className={`lp-metric-card${accent ? " lp-metric-card--accent" : ""}`}>
      <p className="lp-metric-label">{label}</p>
      <p className="lp-metric-value">{value}</p>
    </div>
  );
}

function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

function formatDate(iso) {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function activityLabel(type) {
  switch (type) {
    case "points_earned":
      return "Points earned";
    case "points_redeemed":
      return "Points redeemed";
    case "reward_redemption":
      return "Reward redemption";
    default:
      return type;
  }
}

function activityBadgeClass(type) {
  switch (type) {
    case "points_earned":
      return "lp-badge lp-badge--earned";
    case "points_redeemed":
      return "lp-badge lp-badge--redeemed";
    case "reward_redemption":
      return "lp-badge lp-badge--bonus";
    default:
      return "lp-badge";
  }
}

function formatActivityPoints(type, points) {
  const value = Number(points ?? 0);
  if (type === "points_redeemed" || type === "reward_redemption") {
    return { text: `-${formatCount(value)}`, className: "lp-points-negative" };
  }
  return { text: `+${formatCount(value)}`, className: "lp-points-positive" };
}

function formatChartLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TierDistributionChart({ distribution }) {
  const rows = distribution ?? [];
  const maxValue = Math.max(1, ...rows.map((row) => Number(row.count ?? 0)));
  const total = rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0);

  return (
    <div className="lp-chart-card">
      <div className="lp-chart-header">
        <h3 className="lp-chart-title">Tier distribution</h3>
        <p className="lp-chart-subtitle">
          Members: <span>{formatCount(total)}</span>
        </p>
      </div>
      <div className="lp-tier-dist-chart">
        {rows.length === 0 ? (
          <p className="lp-empty-state">No tier data yet.</p>
        ) : (
          rows.map((row) => {
            const width = Math.round((Number(row.count ?? 0) / maxValue) * 100);
            return (
              <div key={row.tierKey} className="lp-tier-dist-row">
                <div className="lp-tier-dist-label">
                  <span
                    className="lp-tier-dist-dot"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  <span>{row.name}</span>
                </div>
                <div className="lp-tier-dist-bar-track">
                  <div
                    className="lp-tier-dist-bar-fill"
                    style={{
                      width: `${Math.max(width, row.count > 0 ? 6 : 0)}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </div>
                <span className="lp-tier-dist-count">{formatCount(row.count)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MiniBarChart({ title, series, valueLabel = "Total" }) {
  const maxValue = useMemo(
    () => Math.max(1, ...series.map((point) => Number(point.value ?? 0))),
    [series]
  );

  const total = useMemo(
    () => series.reduce((sum, point) => sum + Number(point.value ?? 0), 0),
    [series]
  );

  return (
    <div className="lp-chart-card">
      <div className="lp-chart-header">
        <h3 className="lp-chart-title">{title}</h3>
        <p className="lp-chart-subtitle">
          {valueLabel}: <span>{formatCount(total)}</span> · last 30 days
        </p>
      </div>
      <div className="lp-chart-bars" role="img" aria-label={`${title} chart`}>
        {series.map((point) => {
          const height = Math.round((Number(point.value ?? 0) / maxValue) * 100);
          return (
            <div key={point.date} className="lp-chart-bar-col">
              <div className="lp-chart-bar-track">
                <div
                  className="lp-chart-bar-fill"
                  style={{ height: `${Math.max(height, point.value > 0 ? 8 : 0)}%` }}
                  title={`${formatChartLabel(point.date)}: ${formatCount(point.value)}`}
                />
              </div>
              <span className="lp-chart-bar-label">{formatChartLabel(point.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboard, setDashboard] = useState({
    metrics: {
      totalLoyaltyMembers: 0,
      totalPointsIssued: 0,
      totalPointsRedeemed: 0,
      activeRewards: 0,
      totalRedemptions: 0,
    },
    recentActivity: [],
    charts: {
      newMembersOverTime: [],
      pointsIssuedOverTime: [],
      redemptionsOverTime: [],
      tierDistribution: [],
    },
  });

  const loadDashboard = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchWithSession(app, "/api/dashboard");
      setDashboard({
        metrics: data.metrics ?? {},
        recentActivity: data.recentActivity ?? [],
        charts: data.charts ?? {},
      });
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

  return (
    <>
      {error && (
        <div className="lp-banner lp-banner--critical" role="alert">
          Could not load dashboard: {error}
        </div>
      )}

      <div className="lp-dashboard-intro">
        <p className="lp-dashboard-intro-text">
          Overview of loyalty members, points activity, rewards, and redemptions.
        </p>
      </div>

      <div className="lp-metric-grid lp-metric-grid--five">
        <MetricCard
          label="Total Loyalty Members"
          value={formatCount(metrics.totalLoyaltyMembers)}
          accent
        />
        <MetricCard
          label="Bronze members"
          value={formatCount(metrics.customersPerTier?.BRONZE)}
        />
        <MetricCard
          label="Silver members"
          value={formatCount(metrics.customersPerTier?.SILVER)}
        />
        <MetricCard
          label="Gold members"
          value={formatCount(metrics.customersPerTier?.GOLD)}
        />
        <MetricCard
          label="Platinum members"
          value={formatCount(metrics.customersPerTier?.PLATINUM)}
        />
      </div>

      <div className="lp-metric-grid lp-metric-grid--five" style={{ marginTop: "14px" }}>
        <MetricCard
          label="Total Points Issued"
          value={formatCount(metrics.totalPointsIssued)}
        />
        <MetricCard
          label="Total Points Redeemed"
          value={formatCount(metrics.totalPointsRedeemed)}
        />
        <MetricCard
          label="Active Rewards"
          value={formatCount(metrics.activeRewards)}
        />
        <MetricCard
          label="Total Redemptions"
          value={formatCount(metrics.totalRedemptions)}
        />
      </div>

      <section className="lp-section">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Review requests</h2>
        </div>

        <div className="lp-metric-grid lp-metric-grid--three">
          <MetricCard
            label="Pending review requests"
            value={formatCount(metrics.pendingReviewRequests)}
            accent
          />
          <MetricCard
            label="Completed reviews"
            value={formatCount(metrics.completedReviews)}
          />
          <MetricCard
            label="Review completion rate"
            value={`${Number(metrics.reviewCompletionRate ?? 0).toFixed(1)}%`}
          />
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Referral program</h2>
        </div>

        <div className="lp-metric-grid lp-metric-grid--three">
          <MetricCard
            label="Total referrals"
            value={formatCount(metrics.totalReferrals)}
            accent
          />
          <MetricCard
            label="Conversion rate"
            value={`${Number(metrics.referralConversionRate ?? 0).toFixed(1)}%`}
          />
          <MetricCard
            label="Completed referrals"
            value={formatCount(metrics.completedReferrals)}
          />
        </div>

        <div className="lp-card" style={{ marginTop: "16px" }}>
          <div className="lp-section-header" style={{ padding: "18px 18px 0" }}>
            <h3 className="lp-chart-title">Top referrers</h3>
          </div>
          {(metrics.topReferrers ?? []).length === 0 ? (
            <div className="lp-empty-state">
              No referrals yet. Share referral links to start tracking advocates.
            </div>
          ) : (
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Referrals</th>
                    <th>Points earned</th>
                  </tr>
                </thead>
                <tbody>
                  {(metrics.topReferrers ?? []).map((referrer) => (
                    <tr key={referrer.customerId}>
                      <td>
                        <div className="lp-table-customer">
                          <span className="lp-table-customer-name">
                            {referrer.name}
                          </span>
                          {referrer.email && (
                            <span className="lp-table-customer-email">
                              {referrer.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{formatCount(referrer.referralCount)}</td>
                      <td>{formatCount(referrer.starsEarned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Tier analytics</h2>
        </div>
        <div className="lp-chart-grid lp-chart-grid--single">
          <TierDistributionChart distribution={charts.tierDistribution ?? []} />
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Performance · last 30 days</h2>
        </div>
        <div className="lp-chart-grid">
          <MiniBarChart
            title="New members over time"
            series={charts.newMembersOverTime ?? []}
            valueLabel="New members"
          />
          <MiniBarChart
            title="Points issued over time"
            series={charts.pointsIssuedOverTime ?? []}
            valueLabel="Points issued"
          />
          <MiniBarChart
            title="Redemptions over time"
            series={charts.redemptionsOverTime ?? []}
            valueLabel="Points redeemed"
          />
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Recent activity</h2>
          <span className="lp-section-meta">Latest 20 events</span>
        </div>

        <div className="lp-card">
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
                        </td>
                        <td>
                          <span className={activityBadgeClass(item.activityType)}>
                            {activityLabel(item.activityType)}
                          </span>
                        </td>
                        <td>
                          <span className={points.className}>{points.text}</span>
                        </td>
                        <td>{item.detail ?? "—"}</td>
                        <td>{formatDate(item.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
