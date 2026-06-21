import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";
import TierBadge from "../components/Customers/TierBadge.jsx";
import CustomerDetailPanel from "../components/Customers/CustomerDetailPanel.jsx";

const TIER_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "BRONZE", label: "Bronze" },
  { value: "SILVER", label: "Silver" },
  { value: "GOLD", label: "Gold" },
  { value: "PLATINUM", label: "Platinum" },
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

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
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

function buildCustomersQuery({ page, search, tier }) {
  const params = new URLSearchParams({ page: String(page), limit: "20" });

  const trimmed = search.trim();
  if (trimmed) {
    if (trimmed.includes("@")) {
      params.set("email", trimmed);
    } else {
      params.set("name", trimmed);
    }
  }

  if (tier) {
    params.set("tier", tier);
  }

  return params.toString();
}

export default function CustomersPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const loadCustomers = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const query = buildCustomersQuery({ page, search, tier: tierFilter });

      const data = await fetchWithSession(app, `/api/customers?${query}`);

      setCustomers(data.data ?? []);
      setPagination(data.pagination ?? { limit: 20, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.message ?? "Failed to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [app, page, search, tierFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [loadCustomers]);

  useEffect(() => {
    if (!selectedCustomer) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedCustomer(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedCustomer]);

  const handlePageChange = (nextPage) => {
    setPage(nextPage);
  };

  const showEmptyState = !loading && !error && customers.length === 0;
  const hasFilters = search.trim() || tierFilter;

  return (
    <>
      {error && (
        <div className="lp-banner lp-banner--critical" role="alert">
          Could not load customers: {error}
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
              placeholder="Search by name or email…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              aria-label="Search customers"
            />
          </div>

          <select
            className="lp-filter-select"
            value={tierFilter}
            onChange={(event) => {
              setTierFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by tier"
          >
            {TIER_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="lp-loading-center">
            <Spinner accessibilityLabel="Loading customers" size="large" />
          </div>
        ) : showEmptyState ? (
          <div className="lp-empty-state">
            {hasFilters ? (
              <>
                <p>No customers match your search.</p>
                <p>Try adjusting your filters or search term.</p>
              </>
            ) : (
              <>
                <p>No loyalty customers yet.</p>
                <p>Customers will appear here when they earn points on orders.</p>
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
                    <th>Email</th>
                    <th>Tier</th>
                    <th>Points Balance</th>
                    <th>Lifetime Spend</th>
                    <th>Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedCustomer(customer);
                        }
                      }}
                      aria-label={`View details for ${formatCustomerName(customer)}`}
                    >
                      <td>
                        <div className="lp-table-customer-row">
                          <div className="lp-customer-avatar">{getInitials(customer)}</div>
                          <span className="lp-table-customer-name">
                            {formatCustomerName(customer)}
                          </span>
                        </div>
                      </td>
                      <td>{customer.email ?? "—"}</td>
                      <td>
                        <TierBadge tier={customer.tier} />
                      </td>
                      <td>
                        <span className="lp-points-positive">
                          {formatCount(customer.totalPoints)}
                        </span>
                      </td>
                      <td>{formatCurrency(customer.lifetimeSpend)}</td>
                      <td>{formatDate(customer.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="lp-pagination">
                <span className="lp-pagination-info">
                  Page {page} of {pagination.totalPages} ·{" "}
                  {formatCount(pagination.total)} customers
                </span>
                <div className="lp-pagination-actions">
                  <button
                    type="button"
                    className="lp-pagination-btn"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="lp-pagination-btn"
                    disabled={page >= pagination.totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CustomerDetailPanel
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
    </>
  );
}
