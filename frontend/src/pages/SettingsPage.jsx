import { useCallback, useEffect, useState } from "react";
import {
  FormLayout,
  TextField,
  Checkbox,
  Button,
  Spinner,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";
import TierSettingsSection from "../components/Settings/TierSettingsSection.jsx";

function applySettingsToForm(settings) {
  return {
    programName: settings.programName ?? "",
    pointsPerDollar: String(settings.pointsPerDollar ?? ""),
    welcomeBonus: String(settings.welcomeBonus ?? "0"),
    referralBonus: String(settings.referralBonus ?? "0"),
    reviewRequestDelayDays: String(settings.reviewRequestDelayDays ?? "7"),
    reviewRequestsEnabled: Boolean(settings.reviewRequestsEnabled ?? true),
    programEnabled: Boolean(
      settings.programEnabled ?? settings.isActive ?? true
    ),
  };
}

function validateForm(form) {
  const errors = [];

  if (!form.programName.trim()) {
    errors.push("Program name is required.");
  } else if (form.programName.trim().length > 50) {
    errors.push("Program name must be 50 characters or fewer.");
  }

  const pointsPerDollar = Number(form.pointsPerDollar);
  if (!Number.isInteger(pointsPerDollar) || pointsPerDollar < 1) {
    errors.push("Points per dollar must be a whole number greater than 0.");
  }

  const welcomeBonus = Number(form.welcomeBonus);
  if (!Number.isInteger(welcomeBonus) || welcomeBonus < 0) {
    errors.push("Welcome bonus must be 0 or greater.");
  }

  const referralBonus = Number(form.referralBonus);
  if (!Number.isInteger(referralBonus) || referralBonus < 0) {
    errors.push("Referral bonus must be 0 or greater.");
  }

  const reviewRequestDelayDays = Number(form.reviewRequestDelayDays);
  if (!Number.isInteger(reviewRequestDelayDays) || reviewRequestDelayDays < 0) {
    errors.push("Review request delay must be 0 or greater.");
  }

  return errors;
}

function SettingsSection({ title, description, children }) {
  return (
    <section className="lp-settings-section">
      <div className="lp-settings-section-header">
        <h2 className="lp-settings-section-title">{title}</h2>
        {description && <p className="lp-settings-section-desc">{description}</p>}
      </div>
      <div className="lp-settings-section-body">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    programName: "",
    pointsPerDollar: "",
    welcomeBonus: "0",
    referralBonus: "0",
    reviewRequestDelayDays: "7",
    reviewRequestsEnabled: true,
    programEnabled: true,
  });
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const loadSettings = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await fetchWithSession(app, "/api/settings");
      setForm(applySettingsToForm(data));
      setLastSavedAt(data.updatedAt ?? null);
    } catch (err) {
      setError(err.message ?? "Failed to load loyalty program settings");
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    const validationErrors = validateForm(form);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      setSuccess(null);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        programName: form.programName.trim(),
        pointsPerDollar: Number(form.pointsPerDollar),
        welcomeBonus: Number(form.welcomeBonus),
        referralBonus: Number(form.referralBonus),
        reviewRequestDelayDays: Number(form.reviewRequestDelayDays),
        reviewRequestsEnabled: form.reviewRequestsEnabled,
        programEnabled: form.programEnabled,
      };

      const data = await fetchWithSession(app, "/api/settings", {
        method: "PUT",
        body: payload,
      });

      setForm(applySettingsToForm(data));
      setLastSavedAt(data.updatedAt ?? new Date().toISOString());
      setSuccess("Loyalty program settings saved successfully.");
    } catch (err) {
      setError(err.message ?? "Failed to save loyalty program settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="lp-settings-page-header">
        <div>
          <h1 className="lp-settings-page-title">Loyalty program settings</h1>
          <p className="lp-settings-page-subtitle">
            Configure how customers earn and engage with your loyalty program.
          </p>
        </div>
        {lastSavedAt && !loading && (
          <Text as="p" tone="subdued" variant="bodySm">
            Last saved {new Date(lastSavedAt).toLocaleString()}
          </Text>
        )}
      </div>

      {error && (
        <div className="lp-banner lp-banner--critical" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="lp-banner lp-banner--success" role="status">
          {success}
        </div>
      )}

      <div className="lp-card lp-settings-card">
        {loading ? (
          <div className="lp-loading-center">
            <Spinner accessibilityLabel="Loading settings" size="large" />
          </div>
        ) : (
          <div className="lp-settings-form lp-settings-form--wide">
            <SettingsSection
              title="Program identity"
              description="How your loyalty currency appears to customers on the storefront."
            >
              <FormLayout>
                <TextField
                  label="Program name"
                  autoComplete="off"
                  value={form.programName}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, programName: value }))
                  }
                  helpText='Displayed in the widget (e.g. "Stars", "Points", "Coins")'
                  placeholder="Stars"
                />
              </FormLayout>
            </SettingsSection>

            <SettingsSection
              title="Earning rules"
              description="Control how points are awarded from customer purchases."
            >
              <FormLayout>
                <TextField
                  label="Points per dollar"
                  type="number"
                  min={1}
                  autoComplete="off"
                  value={form.pointsPerDollar}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, pointsPerDollar: value }))
                  }
                  helpText="Points earned for every $1 spent (e.g. 10 = 10 points per dollar)"
                  placeholder="10"
                />
              </FormLayout>
            </SettingsSection>

            <SettingsSection
              title="Bonuses"
              description="Welcome and referral bonuses are awarded automatically when referred customers complete their first purchase."
            >
              <FormLayout>
                <TextField
                  label="Welcome bonus"
                  type="number"
                  min={0}
                  autoComplete="off"
                  value={form.welcomeBonus}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, welcomeBonus: value }))
                  }
                  helpText="Points awarded when a customer joins the program"
                  placeholder="100"
                />
                <TextField
                  label="Referral bonus"
                  type="number"
                  min={0}
                  autoComplete="off"
                  value={form.referralBonus}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, referralBonus: value }))
                  }
                  helpText="Points awarded for successful referrals"
                  placeholder="250"
                />
              </FormLayout>
            </SettingsSection>

            <SettingsSection
              title="Review requests"
              description="Automatically ask customers for product reviews after they complete an order."
            >
              <FormLayout>
                <TextField
                  label="Review request delay (days)"
                  type="number"
                  min={0}
                  autoComplete="off"
                  value={form.reviewRequestDelayDays}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, reviewRequestDelayDays: value }))
                  }
                  helpText="Days after order completion before the review request is sent"
                  placeholder="7"
                />
                <Checkbox
                  label="Enable review requests"
                  checked={form.reviewRequestsEnabled}
                  onChange={(checked) =>
                    setForm((prev) => ({ ...prev, reviewRequestsEnabled: checked }))
                  }
                  helpText="When disabled, new review requests are not created for paid orders"
                />
              </FormLayout>
            </SettingsSection>

            <SettingsSection
              title="Availability"
              description="Pause the program without uninstalling the app."
            >
              <Checkbox
                label="Program enabled"
                checked={form.programEnabled}
                onChange={(checked) =>
                  setForm((prev) => ({ ...prev, programEnabled: checked }))
                }
                helpText="When disabled, new points are not awarded on paid orders"
              />
            </SettingsSection>

            <div className="lp-settings-actions">
              <Button variant="primary" onClick={handleSave} loading={saving}>
                Save settings
              </Button>
              <Button onClick={loadSettings} disabled={saving}>
                Reset changes
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="lp-settings-page-header" style={{ marginTop: "28px" }}>
        <div>
          <h2 className="lp-settings-page-title">Tier system</h2>
          <p className="lp-settings-page-subtitle">
            Configure spend thresholds, colors, and benefits for each loyalty tier.
          </p>
        </div>
      </div>

      <div className="lp-card lp-settings-card">
        <TierSettingsSection />
      </div>
    </>
  );
}
