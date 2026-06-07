import ReviewStatusBadge from "./ReviewStatusBadge.jsx";

function formatCustomerName(customer, fallbackEmail) {
  const parts = [customer?.firstName, customer?.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return fallbackEmail ?? "Unknown";
}

function formatDate(iso, withTime = false) {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function getInitials(customer, email) {
  const first = customer?.firstName?.[0] ?? "";
  const last = customer?.lastName?.[0] ?? "";
  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

export default function ReviewDetailPanel({ review, onClose }) {
  if (!review) {
    return null;
  }

  const displayEmail = review.customer?.email ?? review.email;

  return (
    <>
      <button
        type="button"
        className="lp-panel-overlay"
        aria-label="Close review details"
        onClick={onClose}
      />
      <aside className="lp-detail-panel" role="dialog" aria-label="Review request details">
        <div className="lp-detail-panel-header">
          <div className="lp-detail-panel-title">
            <div className="lp-customer-avatar lp-customer-avatar--large">
              {getInitials(review.customer, displayEmail)}
            </div>
            <div>
              <h2>{formatCustomerName(review.customer, displayEmail)}</h2>
              <p>{displayEmail ?? "No email"}</p>
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
            <span className="lp-detail-label">Status</span>
            <ReviewStatusBadge status={review.status} />
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Order ID</span>
            <span className="lp-detail-value lp-detail-value--mono">
              {review.orderId ?? "—"}
            </span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Sent Date</span>
            <span className="lp-detail-value">{formatDate(review.sentAt, true)}</span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Created Date</span>
            <span className="lp-detail-value">{formatDate(review.createdAt, true)}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
