import { Button } from "@shopify/polaris";

export default function DeleteConfirmDialog({ reward, deleting, onClose, onConfirm }) {
  if (!reward) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="lp-panel-overlay"
        aria-label="Close confirmation"
        onClick={onClose}
      />
      <div className="lp-modal lp-modal--compact" role="alertdialog" aria-labelledby="delete-reward-title">
        <div className="lp-modal-header">
          <h2 id="delete-reward-title" className="lp-modal-title">
            Delete reward?
          </h2>
          <button
            type="button"
            className="lp-detail-panel-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="lp-modal-body">
          <p className="lp-modal-text">
            Are you sure you want to delete <strong>{reward.name}</strong>? This action
            cannot be undone.
          </p>

          <div className="lp-modal-actions">
            <Button onClick={onClose} disabled={deleting}>
              Cancel
            </Button>
            <Button tone="critical" onClick={onConfirm} loading={deleting}>
              Delete reward
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
