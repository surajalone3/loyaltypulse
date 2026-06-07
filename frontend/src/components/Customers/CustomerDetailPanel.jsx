import TierBadge from "./TierBadge.jsx";

function formatCustomerName(customer) {
  const parts = [customer?.firstName, customer?.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return "Unknown";
}

function formatDate(iso) {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
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

export default function CustomerDetailPanel({ customer, onClose }) {
  if (!customer) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="lp-panel-overlay"
        aria-label="Close customer details"
        onClick={onClose}
      />
      <aside className="lp-detail-panel" role="dialog" aria-label="Customer details">
        <div className="lp-detail-panel-header">
          <div className="lp-detail-panel-title">
            <div className="lp-customer-avatar lp-customer-avatar--large">
              {getInitials(customer)}
            </div>
            <div>
              <h2>{formatCustomerName(customer)}</h2>
              <p>{customer.email ?? "No email"}</p>
            </div>
          </div>
          <button
            type="button"
            className="lp-detail-panel-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="lp-detail-panel-body">
          <div className="lp-detail-field">
            <span className="lp-detail-label">Tier</span>
            <TierBadge tier={customer.tier} />
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Lifetime Spend</span>
            <span className="lp-detail-value">{formatCurrency(customer.lifetimeSpend)}</span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Current Points</span>
            <span className="lp-detail-value lp-detail-value--accent">
              {formatCount(customer.totalPoints)}
            </span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Created Date</span>
            <span className="lp-detail-value">{formatDate(customer.createdAt)}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
