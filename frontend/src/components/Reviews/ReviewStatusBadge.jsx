const STATUS_STYLES = {
  PENDING: "lp-review-status lp-review-status--pending",
  SENT: "lp-review-status lp-review-status--sent",
  REVIEWED: "lp-review-status lp-review-status--reviewed",
};

const STATUS_LABELS = {
  PENDING: "Pending",
  SENT: "Sent",
  REVIEWED: "Reviewed",
};

export default function ReviewStatusBadge({ status }) {
  const normalized = status?.toUpperCase() ?? "PENDING";
  const className = STATUS_STYLES[normalized] ?? STATUS_STYLES.PENDING;
  const label = STATUS_LABELS[normalized] ?? normalized;

  return <span className={className}>{label}</span>;
}
