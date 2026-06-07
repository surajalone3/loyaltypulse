import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";
import TransactionDetailPanel from "../components/Transactions/TransactionDetailPanel.jsx";

const PAGE_SIZE = 20;
const FETCH_LIMIT = 100;

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "EARNED", label: "Earned" },
  { value: "REDEEMED", label: "Redeemed" },
];

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

function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

function getInitials(customer) {
  const first = customer?.firstName?.[0] ?? "";
  const last = customer?.lastName?.[0] ?? "";
  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }
  return customer?.email?.[0]?.toUpperCase() ?? "?";
}

function typeLabel(type) {
  switch (type) {
    case "EARNED":
      return "Earned";
    case "REDEEMED":
      return "Redeemed";
    case "BONUS":
      return "Bonus";
    default:
      return type ?? "—";
  }
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

function formatPoints(type, points) {
  const value = Number(points ?? 0);
  if (type === "REDEEMED") {
    return { text: `-${formatCount(value)}`, className: "lp-points-negative" };
  }
  return { text: `+${formatCount(value)}`, className: "lp-points-positive" };
}

function formatOrderId(orderId) {
  if (!orderId) {
    return "—";
  }
  const match = orderId.match(/(\d+)$/);
  return match ? `#${match[1]}` : orderId;
}

function matchesTypeFilter(type, filter) {
  if (!filter) {
    return true;
  }
  if (filter === "EARNED") {
    return type === "EARNED" || type === "BONUS";
  }
  return type === filter;
}

function matchesEmailFilter(customer, search) {
  const trimmed = search.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  return (customer?.email ?? "").toLowerCase().includes(trimmed);
}

async function fetchTransactionsPage(app, page, limit) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return fetchWithSession(app, `/api/transactions?${params}`);
}

async function fetchAllTransactions(app) {
  const first = await fetchTransactionsPage(app, 1, FETCH_LIMIT);
  const all = [...(first.data ?? [])];
  const totalPages = first.pagination?.totalPages ?? 1;

  for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
    const response = await fetchTransactionsPage(app, nextPage, FETCH_LIMIT);
    all.push(...(response.data ?? []));
  }

  return all;
}

export default function TransactionsPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [serverPagination, setServerPagination] = useState({
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const hasFilters = Boolean(search.trim() || typeFilter);

  const loadTransactions = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (hasFilters) {
        const all = await fetchAllTransactions(app);
        setTransactions(all);
        setServerPagination({ total: all.length, totalPages: 0 });
      } else {
        const data = await fetchTransactionsPage(app, page, PAGE_SIZE);
        setTransactions(data.data ?? []);
        setServerPagination(data.pagination ?? { total: 0, totalPages: 0 });
      }
    } catch (err) {
      setError(err.message ?? "Failed to load transactions");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [app, hasFilters, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTransactions();
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [loadTransactions]);

  useEffect(() => {
    if (!selectedTransaction) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedTransaction(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedTransaction]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(
      (tx) =>
        matchesEmailFilter(tx.customer, search) &&
        matchesTypeFilter(tx.type, typeFilter)
    );
  }, [transactions, search, typeFilter]);

  const displayPagination = useMemo(() => {
    if (hasFilters) {
      const total = filteredTransactions.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
      return { total, totalPages, page };
    }
    return {
      total: serverPagination.total,
      totalPages: serverPagination.totalPages,
      page,
    };
  }, [hasFilters, filteredTransactions.length, serverPagination, page]);

  const displayedTransactions = useMemo(() => {
    if (hasFilters) {
      const start = (page - 1) * PAGE_SIZE;
      return filteredTransactions.slice(start, start + PAGE_SIZE);
    }
    return transactions;
  }, [hasFilters, filteredTransactions, transactions, page]);

  const showEmptyState = !loading && !error && displayedTransactions.length === 0;

  return (
    <>
      {error && (
        <div className="lp-banner lp-banner--critical" role="alert">
          Could not load transactions: {error}
        </div>
      )}

      <div className="lp-card">
        <div className="lp-customers-toolbar">
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
              placeholder="Search by customer email…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              aria-label="Search transactions by customer email"
            />
          </div>

          <select
            className="lp-filter-select"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by transaction type"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="lp-loading-center">
            <Spinner accessibilityLabel="Loading transactions" size="large" />
          </div>
        ) : showEmptyState ? (
          <div className="lp-empty-state">
            {hasFilters ? (
              <>
                <p>No transactions match your filters.</p>
                <p>Try adjusting your search or type filter.</p>
              </>
            ) : (
              <>
                <p>No transactions yet.</p>
                <p>Points activity will appear here when customers earn or redeem.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="lp-table-wrap">
              <table className="lp-table lp-table--clickable">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Points</th>
                    <th>Reason</th>
                    <th>Order ID</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTransactions.map((tx) => {
                    const points = formatPoints(tx.type, tx.points);
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTransaction(tx)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedTransaction(tx);
                          }
                        }}
                        aria-label={`View transaction for ${formatCustomerName(tx.customer)}`}
                      >
                        <td>
                          <div className="lp-table-customer-row">
                            <div className="lp-customer-avatar">
                              {getInitials(tx.customer)}
                            </div>
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
                          </div>
                        </td>
                        <td>
                          <span className={typeBadgeClass(tx.type)}>
                            {typeLabel(tx.type)}
                          </span>
                        </td>
                        <td>
                          <span className={points.className}>{points.text}</span>
                        </td>
                        <td>{tx.reason ?? "—"}</td>
                        <td className="lp-order-id">{formatOrderId(tx.orderId)}</td>
                        <td>{formatDate(tx.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {displayPagination.totalPages > 1 && (
              <div className="lp-pagination">
                <span className="lp-pagination-info">
                  Page {displayPagination.page} of {displayPagination.totalPages} ·{" "}
                  {formatCount(displayPagination.total)} transactions
                </span>
                <div className="lp-pagination-actions">
                  <button
                    type="button"
                    className="lp-pagination-btn"
                    disabled={displayPagination.page <= 1}
                    onClick={() => setPage((prev) => prev - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="lp-pagination-btn"
                    disabled={displayPagination.page >= displayPagination.totalPages}
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

      <TransactionDetailPanel
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </>
  );
}
