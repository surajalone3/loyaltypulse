export default function MetricCard({ label, value, trend, accent }) {
  return (
    <div className={`lp-metric-card${accent ? " lp-metric-card--accent" : ""}`}>
      <p className="lp-metric-label">{label}</p>
      <p className="lp-metric-value">{value}</p>
      {trend && (
        <p
          className={`lp-metric-trend lp-metric-trend--${trend.direction}`}
        >
          <span aria-hidden="true">{trend.direction === "up" ? "↑" : "↓"}</span>
          {trend.value}% {trend.label}
        </p>
      )}
    </div>
  );
}
