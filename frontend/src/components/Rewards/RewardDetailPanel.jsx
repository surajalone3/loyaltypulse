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

function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

function StatusBadge({ isActive }) {
  return (
    <span className={isActive ? "lp-status-badge lp-status-badge--active" : "lp-status-badge lp-status-badge--inactive"}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function RewardDetailPanel({ reward, onClose, onEdit, onDelete }) {
  if (!reward) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="lp-panel-overlay"
        aria-label="Close reward details"
        onClick={onClose}
      />
      <aside className="lp-detail-panel" role="dialog" aria-label="Reward details">
        <div className="lp-detail-panel-header">
          <div className="lp-detail-panel-title">
            <div className="lp-reward-icon" aria-hidden="true">
              ★
            </div>
            <div>
              <h2>{reward.name}</h2>
              <p>{formatCount(reward.pointsRequired)} points required</p>
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
            <StatusBadge isActive={reward.isActive} />
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Description</span>
            <span className="lp-detail-value">
              {reward.description?.trim() ? reward.description : "No description"}
            </span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Points Required</span>
            <span className="lp-detail-value lp-detail-value--accent">
              {formatCount(reward.pointsRequired)}
            </span>
          </div>
          <div className="lp-detail-field">
            <span className="lp-detail-label">Created Date</span>
            <span className="lp-detail-value">{formatDate(reward.createdAt)}</span>
          </div>

          <div className="lp-detail-actions">
            <button type="button" className="lp-btn lp-btn--secondary" onClick={onEdit}>
              Edit reward
            </button>
            <button type="button" className="lp-btn lp-btn--danger" onClick={onDelete}>
              Delete reward
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
