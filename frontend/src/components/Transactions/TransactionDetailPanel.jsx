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
    hour: "numeric",
    minute: "2-digit",
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
      return type ?? "Unknown";
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

export default function TransactionDetailPanel({ transaction, onClose }) {
  if (!transaction) {
    return null;
  }

  const points = formatPoints(transaction.type, transaction.points);

  return (
    <>
      <button
        type="button"
        className="lp-panel-overlay"
        aria-label="Close transaction details"
        onClick={onClose}
      />
      <aside className="lp-detail-panel" role="dialog" aria-label="Transaction details">
        <div className="lp-detail-panel-header">
          <div className="lp-detail-panel-title">
            <div className="lp-customer-avatar lp-customer-avatar--large">
              {getInitials(transaction.customer)}
            </div>
            <div>
              <h2>{formatCustomerName(transaction.customer)}</h2>
              <p>{transaction.customer?.email ?? "No email"}</p>
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
            <span className="lp-detail-label">Transaction Type</span>
            <span className={typeBadgeClass(transaction.type)}>
              {typeLabel(transaction.type)}
            </span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Points</span>
            <span className={`lp-detail-value ${points.className}`}>{points.text}</span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Reason</span>
            <span className="lp-detail-value">{transaction.reason ?? "—"}</span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Order ID</span>
            <span className="lp-detail-value lp-detail-value--mono">
              {transaction.orderId ?? "—"}
            </span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Created Date</span>
            <span className="lp-detail-value">{formatDate(transaction.createdAt)}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
