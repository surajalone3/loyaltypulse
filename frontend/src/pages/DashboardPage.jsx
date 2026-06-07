import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";

function MetricCard({ label, value }) {
  return (
    <div className="lp-metric-card">
      <p className="lp-metric-label">{label}</p>
      <p className="lp-metric-value">{value}</p>
    </div>
  );
}

function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

function formatCustomerName(customer) {
  const parts = [customer?.firstName, customer?.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return customer?.email ?? "Unknown";
}

function formatDate(iso) {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPoints(type, points) {
  const value = Number(points ?? 0);
  if (type === "REDEEMED") {
    return { text: `-${formatCount(value)}`, className: "lp-points-negative" };
  }
  return { text: `+${formatCount(value)}`, className: "lp-points-positive" };
}

function typeBadgeClass(type) {
  switch (type) {
    case "EARNED":
      return "lp-badge lp-badge--earned";
    case "REDEEMED":
      return "lp-badge lp-badge--redeemed";
    case "BONUS":
      return "lp-badge lp-badge--bonus";
    default:
      return "lp-badge";
  }
}

export default function DashboardPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({
    totalLoyaltyMembers: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    memberGrowthThisMonth: { newMembers: 0 },
  });
  const [recentTransactions, setRecentTransactions] = useState([]);

  const loadDashboard = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await fetchWithSession(app, "/api/dashboard");

      setMetrics({
        totalLoyaltyMembers: data.totalLoyaltyMembers ?? 0,
        totalPointsIssued: data.totalPointsIssued ?? 0,
        totalPointsRedeemed: data.totalPointsRedeemed ?? 0,
        memberGrowthThisMonth: data.memberGrowthThisMonth ?? { newMembers: 0 },
      });
      setRecentTransactions(data.recentTransactions ?? []);
    } catch (err) {
      setError(err.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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

      <div className="lp-metric-grid">
        <MetricCard
          label="Total Loyalty Members"
          value={formatCount(metrics.totalLoyaltyMembers)}
        />
        <MetricCard
          label="Total Points Issued"
          value={formatCount(metrics.totalPointsIssued)}
        />
        <MetricCard
          label="Total Points Redeemed"
          value={formatCount(metrics.totalPointsRedeemed)}
        />
        <MetricCard
          label="New Members This Month"
          value={formatCount(metrics.memberGrowthThisMonth.newMembers)}
        />
      </div>

      <section className="lp-section">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Recent loyalty activity</h2>
        </div>

        <div className="lp-card">
          {recentTransactions.length === 0 ? (
            <div className="lp-empty-state">
              No transactions yet. Points will appear here when customers earn or redeem.
            </div>
          ) : (
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Points</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => {
                    const points = formatPoints(tx.type, tx.points);
                    return (
                      <tr key={tx.id}>
                        <td>
                          <div className="lp-table-customer">
                            <span className="lp-table-customer-name">
                              {formatCustomerName(tx.customer)}
                            </span>
                            {tx.customer?.email && (
                              <span className="lp-table-customer-email">
                                {tx.customer.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={typeBadgeClass(tx.type)}>{tx.type}</span>
                        </td>
                        <td>
                          <span className={points.className}>{points.text}</span>
                        </td>
                        <td>{tx.reason ?? "—"}</td>
                        <td>{formatDate(tx.createdAt)}</td>
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
