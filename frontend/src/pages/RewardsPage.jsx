import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";
import RewardFormModal from "../components/Rewards/RewardFormModal.jsx";
import RewardDetailPanel from "../components/Rewards/RewardDetailPanel.jsx";
import DeleteConfirmDialog from "../components/Rewards/DeleteConfirmDialog.jsx";

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

      const data = await fetchWithSession(app, "/api/rewards");
      setRewards(data.data ?? []);
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

  return (
    <>
      {error && (
        <div className="lp-banner lp-banner--critical" role="alert">
          {error}
        </div>
      )}

      <div className="lp-card">
        <div className="lp-customers-toolbar">
          <p className="lp-toolbar-hint">
            Manage redeemable rewards customers can unlock with points.
          </p>
          <button type="button" className="lp-btn lp-btn--primary" onClick={openCreate}>
            + Create Reward
          </button>
        </div>

        {loading ? (
          <div className="lp-loading-center">
            <Spinner accessibilityLabel="Loading rewards" size="large" />
          </div>
        ) : showEmptyState ? (
          <div className="lp-empty-state">
            <p>No rewards created yet</p>
            <p>Create your first reward to let customers redeem their points.</p>
            <button type="button" className="lp-btn lp-btn--primary" onClick={openCreate}>
              + Create Reward
            </button>
          </div>
        ) : (
          <div className="lp-table-wrap">
            <table className="lp-table lp-table--clickable">
              <thead>
                <tr>
                  <th>Reward Name</th>
                  <th>Points Required</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rewards.map((reward) => (
                  <tr
                    key={reward.id}
                    onClick={() => setSelectedReward(reward)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedReward(reward);
                      }
                    }}
                    aria-label={`View details for ${reward.name}`}
                  >
                    <td>
                      <span className="lp-table-customer-name">{reward.name}</span>
                    </td>
                    <td>
                      <span className="lp-points-positive">
                        {formatCount(reward.pointsRequired)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge isActive={reward.isActive} />
                    </td>
                    <td>{formatDate(reward.createdAt)}</td>
                    <td>
                      <div className="lp-row-actions">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    </>
  );
}
