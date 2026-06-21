import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";
import ReviewStatusBadge from "../components/Reviews/ReviewStatusBadge.jsx";
import ReviewDetailPanel from "../components/Reviews/ReviewDetailPanel.jsx";
import MetricCard from "../components/ui/MetricCard.jsx";
import {
  formatCount,
  formatCustomerName,
  formatDate,
  formatPercent,
  getCustomerInitials,
} from "../utils/format.js";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "SENT", label: "Sent" },
  { value: "COMPLETED", label: "Completed" },
];

function formatOrderId(orderId) {
  if (!orderId) {
    return "—";
  }
  const match = orderId.match(/(\d+)$/);
  return match ? `#${match[1]}` : orderId;
}

function buildReviewsQuery({ page, search, status }) {
  const params = new URLSearchParams({ page: String(page), limit: "20" });

  const trimmed = search.trim();
  if (trimmed) {
    if (trimmed.includes("@")) {
      params.set("email", trimmed);
    } else {
      params.set("name", trimmed);
    }
  }

  if (status) {
    params.set("status", status);
  }

  return params.toString();
}

export default function ReviewsPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [campaignStats, setCampaignStats] = useState({
    pendingReviewRequests: 0,
    completedReviews: 0,
    reviewCompletionRate: 0,
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedReview, setSelectedReview] = useState(null);

  const loadReviews = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const query = buildReviewsQuery({ page, search, status: statusFilter });
      const [data, dashboard] = await Promise.all([
        fetchWithSession(app, `/api/reviews?${query}`),
        fetchWithSession(app, "/api/dashboard").catch(() => ({ metrics: {} })),
      ]);

      setReviews(data.data ?? []);
      setPagination(data.pagination ?? { limit: 20, total: 0, totalPages: 0 });
      setCampaignStats({
        pendingReviewRequests: dashboard.metrics?.pendingReviewRequests ?? 0,
        completedReviews: dashboard.metrics?.completedReviews ?? 0,
        reviewCompletionRate: dashboard.metrics?.reviewCompletionRate ?? 0,
      });
    } catch (err) {
      setError(err.message ?? "Failed to load review requests");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [app, page, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadReviews();
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [loadReviews]);

  useEffect(() => {
    if (!selectedReview) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedReview(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedReview]);

  const showEmptyState = !loading && !error && reviews.length === 0;
  const hasFilters = search.trim() || statusFilter;

  return (
    <div className="lp-page-stack">
      {error && (
        <div className="lp-banner lp-banner--critical" role="alert">
          Could not load review requests: {error}
        </div>
      )}

      <div className="lp-metric-grid lp-metric-grid--three">
        <MetricCard
          label="Pending requests"
          value={formatCount(campaignStats.pendingReviewRequests)}
          accent
        />
        <MetricCard
          label="Completed reviews"
          value={formatCount(campaignStats.completedReviews)}
        />
        <MetricCard
          label="Completion rate"
          value={formatPercent(campaignStats.reviewCompletionRate)}
        />
      </div>

      <div className="lp-card lp-table-card">
        <div className="lp-page-toolbar">
          <div>
            <h2 className="lp-page-toolbar-title">Review campaign</h2>
            <p className="lp-page-toolbar-subtitle">
              Track review requests, delivery status, and customer responses.
            </p>
          </div>
        </div>

        <div className="lp-customers-toolbar" style={{ paddingTop: 0 }}>
          <div className="lp-search-input-wrap">
            <svg
              className="lp-search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              className="lp-search-input"
              placeholder="Search by customer name or email…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              aria-label="Search review requests"
            />
          </div>

          <select
            className="lp-filter-select"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="lp-loading-center">
            <Spinner accessibilityLabel="Loading review requests" size="large" />
          </div>
        ) : showEmptyState ? (
          <div className="lp-empty-state">
            {hasFilters ? (
              <>
                <p>No review requests match your filters.</p>
                <p>Try adjusting your search or status filter.</p>
              </>
            ) : (
              <p>No review requests yet</p>
            )}
          </div>
        ) : (
          <>
            <div className="lp-table-wrap">
              <table className="lp-table lp-table--clickable">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => {
                    const displayEmail = review.customer?.email ?? review.email;
                    return (
                      <tr
                        key={review.id}
                        onClick={() => setSelectedReview(review)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedReview(review);
                          }
                        }}
                        aria-label={`View review request for ${formatCustomerName(review.customer, displayEmail)}`}
                      >
                        <td>
                          <div className="lp-table-customer-row">
                            <div className="lp-customer-avatar">
                              {getCustomerInitials(review.customer)}
                            </div>
                            <span className="lp-table-customer-name">
                              {formatCustomerName(review.customer, displayEmail)}
                            </span>
                          </div>
                        </td>
                        <td>{displayEmail ?? "—"}</td>
                        <td className="lp-order-id">{formatOrderId(review.orderId)}</td>
                        <td>
                          <ReviewStatusBadge status={review.status} />
                        </td>
                        <td>{formatDate(review.sentAt)}</td>
                        <td>{formatDate(review.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="lp-pagination">
                <span className="lp-pagination-info">
                  Page {page} of {pagination.totalPages} ·{" "}
                  {formatCount(pagination.total)} review requests
                </span>
                <div className="lp-pagination-actions">
                  <button
                    type="button"
                    className="lp-pagination-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => prev - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="lp-pagination-btn"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ReviewDetailPanel
        review={selectedReview}
        onClose={() => setSelectedReview(null)}
      />
    </div>
  );
}
