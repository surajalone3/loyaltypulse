import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";
import RewardFormModal from "../components/Rewards/RewardFormModal.jsx";
import RewardDetailPanel from "../components/Rewards/RewardDetailPanel.jsx";
import DeleteConfirmDialog from "../components/Rewards/DeleteConfirmDialog.jsx";
import MetricCard from "../components/ui/MetricCard.jsx";
import { formatCount, formatDate } from "../utils/format.js";

function StatusBadge({ isActive }) {
  return (
    <span
      className={
        isActive
          ? "lp-status-badge lp-status-badge--active"
          : "lp-status-badge lp-status-badge--inactive"
      }
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function RewardsPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [summary, setSummary] = useState({
    activeRewards: 0,
    totalRedemptions: 0,
    totalPointsRedeemed: 0,
  });
  const [selectedReward, setSelectedReward] = useState(null);
  const [formModal, setFormModal] = useState({ open: false, mode: "create", reward: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadRewards = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [data, dashboard] = await Promise.all([
        fetchWithSession(app, "/api/rewards"),
        fetchWithSession(app, "/api/dashboard").catch(() => ({ metrics: {} })),
      ]);

      setRewards(data.data ?? []);
      setSummary({
        activeRewards: dashboard.metrics?.activeRewards ?? 0,
        totalRedemptions: dashboard.metrics?.totalRedemptions ?? 0,
        totalPointsRedeemed: dashboard.metrics?.totalPointsRedeemed ?? 0,
      });
    } catch (err) {
      setError(err.message ?? "Failed to load rewards");
      setRewards([]);
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  useEffect(() => {
    if (!selectedReward && !formModal.open && !deleteTarget) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (deleteTarget) {
          setDeleteTarget(null);
        } else if (formModal.open) {
          setFormModal({ open: false, mode: "create", reward: null });
        } else {
          setSelectedReward(null);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedReward, formModal.open, deleteTarget]);

  const openCreate = () => {
    setSelectedReward(null);
    setFormModal({ open: true, mode: "create", reward: null });
  };

  const openEdit = (reward) => {
    setSelectedReward(null);
    setFormModal({ open: true, mode: "edit", reward });
  };

  const handleFormSubmit = async (payload) => {
    try {
      setSaving(true);
      setError(null);

      if (formModal.mode === "edit" && formModal.reward) {
        const updated = await fetchWithSession(app, `/api/rewards/${formModal.reward.id}`, {
          method: "PUT",
          body: payload,
        });
        setRewards((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      } else {
        const created = await fetchWithSession(app, "/api/rewards", {
          method: "POST",
          body: payload,
        });
        setRewards((prev) => [created, ...prev]);
      }

      setFormModal({ open: false, mode: "create", reward: null });
    } catch (err) {
      setError(err.message ?? "Failed to save reward");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      await fetchWithSession(app, `/api/rewards/${deleteTarget.id}`, {
        method: "DELETE",
      });

      setRewards((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      if (selectedReward?.id === deleteTarget.id) {
        setSelectedReward(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message ?? "Failed to delete reward");
    } finally {
      setDeleting(false);
    }
  };

  const showEmptyState = !loading && !error && rewards.length === 0;
  const activeCount = rewards.filter((reward) => reward.isActive).length;

  return (
    <div className="lp-page-stack">
      {error && (
        <div className="lp-banner lp-banner--critical" role="alert">
          {error}
        </div>
      )}

      <div className="lp-metric-grid lp-metric-grid--three">
        <MetricCard label="Active rewards" value={formatCount(activeCount)} accent />
        <MetricCard label="Total redemptions" value={formatCount(summary.totalRedemptions)} />
        <MetricCard
          label="Points redeemed"
          value={formatCount(summary.totalPointsRedeemed)}
        />
      </div>

      <div className="lp-page-toolbar">
        <div>
          <h2 className="lp-page-toolbar-title">Reward catalog</h2>
          <p className="lp-page-toolbar-subtitle">
            Manage redeemable rewards customers can unlock with points.
          </p>
        </div>
        <button type="button" className="lp-btn lp-btn--primary" onClick={openCreate}>
          + Create reward
        </button>
      </div>

      {loading ? (
        <div className="lp-card lp-loading-center">
          <Spinner accessibilityLabel="Loading rewards" size="large" />
        </div>
      ) : showEmptyState ? (
        <div className="lp-card lp-empty-state">
          <p>No rewards created yet</p>
          <p>Create your first reward to let customers redeem their points.</p>
          <button type="button" className="lp-btn lp-btn--primary" onClick={openCreate}>
            + Create reward
          </button>
        </div>
      ) : (
        <div className="lp-reward-grid">
          {rewards.map((reward) => (
            <article
              key={reward.id}
              className="lp-reward-card"
              onClick={() => setSelectedReward(reward)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedReward(reward);
                }
              }}
              tabIndex={0}
              aria-label={`View details for ${reward.name}`}
            >
              <div className="lp-reward-card-top">
                <h3 className="lp-reward-card-name">{reward.name}</h3>
                <StatusBadge isActive={reward.isActive} />
              </div>
              <p className="lp-reward-card-points">{formatCount(reward.pointsRequired)} pts</p>
              <p className="lp-reward-card-meta">Created {formatDate(reward.createdAt)}</p>
              <div className="lp-reward-card-actions">
                <button
                  type="button"
                  className="lp-btn lp-btn--ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(reward);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="lp-btn lp-btn--ghost lp-btn--danger-text"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(reward);
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <RewardFormModal
        open={formModal.open}
        mode={formModal.mode}
        reward={formModal.reward}
        saving={saving}
        onClose={() => setFormModal({ open: false, mode: "create", reward: null })}
        onSubmit={handleFormSubmit}
      />

      <RewardDetailPanel
        reward={selectedReward}
        onClose={() => setSelectedReward(null)}
        onEdit={() => {
          openEdit(selectedReward);
        }}
        onDelete={() => {
          setDeleteTarget(selectedReward);
        }}
      />

      <DeleteConfirmDialog
        reward={deleteTarget}
        deleting={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
