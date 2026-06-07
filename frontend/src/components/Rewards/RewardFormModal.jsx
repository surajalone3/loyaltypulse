import { useEffect, useState } from "react";
import { Button, Checkbox, TextField } from "@shopify/polaris";

const EMPTY_FORM = {
  name: "",
  description: "",
  pointsRequired: "",
  isActive: true,
};

function rewardToForm(reward) {
  if (!reward) {
    return EMPTY_FORM;
  }
  return {
    name: reward.name ?? "",
    description: reward.description ?? "",
    pointsRequired: String(reward.pointsRequired ?? ""),
    isActive: Boolean(reward.isActive),
  };
}

export default function RewardFormModal({
  open,
  mode,
  reward,
  saving,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(rewardToForm(reward));
    }
  }, [open, reward]);

  if (!open) {
    return null;
  }

  const title = mode === "edit" ? "Edit Reward" : "Create Reward";

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || null,
      pointsRequired: Number(form.pointsRequired),
      isActive: form.isActive,
    });
  };

  return (
    <>
      <button
        type="button"
        className="lp-panel-overlay"
        aria-label="Close form"
        onClick={onClose}
      />
      <div className="lp-modal" role="dialog" aria-labelledby="reward-form-title">
        <div className="lp-modal-header">
          <h2 id="reward-form-title" className="lp-modal-title">
            {title}
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

        <form className="lp-modal-body" onSubmit={handleSubmit}>
          <div className="lp-settings-form lp-modal-form">
            <TextField
              label="Reward name"
              autoComplete="off"
              value={form.name}
              onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
              placeholder="e.g. $10 off next order"
            />
            <TextField
              label="Description"
              autoComplete="off"
              multiline={3}
              value={form.description}
              onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
              placeholder="Optional details shown to customers"
            />
            <TextField
              label="Points required"
              type="number"
              min={1}
              autoComplete="off"
              value={form.pointsRequired}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, pointsRequired: value }))
              }
              helpText="How many points a customer needs to redeem this reward"
            />
            <Checkbox
              label="Active"
              checked={form.isActive}
              onChange={(checked) =>
                setForm((prev) => ({ ...prev, isActive: checked }))
              }
              helpText="Inactive rewards are hidden from customers"
            />
          </div>

          <div className="lp-modal-actions">
            <Button onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" submit loading={saving}>
              {mode === "edit" ? "Save changes" : "Create reward"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
