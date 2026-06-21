import { useCallback, useEffect, useState } from "react";
import {
  FormLayout,
  TextField,
  Checkbox,
  Button,
  Spinner,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../../utils/api.js";

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

function applyTiersToForm(tiers) {
  const byKey = Object.fromEntries(tiers.map((tier) => [tier.tierKey, tier]));
  return TIER_ORDER.map((tierKey) => ({
    tierKey,
    name: byKey[tierKey]?.name ?? "",
    minLifetimeSpend: String(byKey[tierKey]?.minLifetimeSpend ?? "0"),
    color: byKey[tierKey]?.color ?? "#CD7F32",
    benefitsDescription: byKey[tierKey]?.benefitsDescription ?? "",
    enabled: byKey[tierKey]?.enabled ?? true,
  }));
}

function validateTiersForm(tiers) {
  const errors = [];
  const hexRe = /^#([0-9A-Fa-f]{6})$/;

  tiers.forEach((tier, index) => {
    if (!tier.name.trim()) {
      errors.push(`${tier.tierKey}: name is required.`);
    }

    const minSpend = Number(tier.minLifetimeSpend);
    if (Number.isNaN(minSpend) || minSpend < 0) {
      errors.push(`${tier.tierKey}: minimum spend must be 0 or greater.`);
    }

    if (!hexRe.test(tier.color)) {
      errors.push(`${tier.tierKey}: color must be a hex value like #CD7F32.`);
    }
  });

  const enabled = tiers.filter((tier) => tier.enabled);
  if (enabled.length === 0) {
    errors.push("At least one tier must remain enabled.");
  }

  const bronze = tiers.find((tier) => tier.tierKey === "BRONZE");
  if (bronze?.enabled && Number(bronze.minLifetimeSpend) !== 0) {
    errors.push("Bronze minimum spend must be 0 when enabled.");
  }

  for (let i = 1; i < enabled.length; i++) {
    const prev = Number(enabled[i - 1].minLifetimeSpend);
    const current = Number(enabled[i].minLifetimeSpend);
    if (current <= prev) {
      errors.push("Enabled tier thresholds must increase in order.");
      break;
    }
  }

  return errors;
}

function TierEditorCard({ tier, onChange }) {
  return (
    <article className="lp-tier-editor-card">
      <div className="lp-tier-editor-card-header">
        <span
          className="lp-tier-editor-swatch"
          style={{ backgroundColor: tier.color }}
          aria-hidden
        />
        <h3 className="lp-tier-editor-card-title">{tier.tierKey}</h3>
        <Checkbox
          label="Enabled"
          checked={tier.enabled}
          onChange={(enabled) => onChange({ ...tier, enabled })}
        />
      </div>
      <FormLayout>
        <TextField
          label="Display name"
          value={tier.name}
          autoComplete="off"
          onChange={(name) => onChange({ ...tier, name })}
        />
        <TextField
          label="Minimum lifetime spend ($)"
          type="number"
          min={0}
          value={tier.minLifetimeSpend}
          autoComplete="off"
          onChange={(minLifetimeSpend) => onChange({ ...tier, minLifetimeSpend })}
          helpText="Total customer spend required to reach this tier"
        />
        <TextField
          label="Badge color"
          value={tier.color}
          autoComplete="off"
          onChange={(color) => onChange({ ...tier, color })}
          helpText="Hex color used in admin and storefront badges"
        />
        <TextField
          label="Benefits description"
          value={tier.benefitsDescription}
          autoComplete="off"
          multiline={3}
          onChange={(benefitsDescription) =>
            onChange({ ...tier, benefitsDescription })
          }
        />
      </FormLayout>
    </article>
  );
}

export default function TierSettingsSection() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [tiers, setTiers] = useState(() => applyTiersToForm([]));

  const loadTiers = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchWithSession(app, "/api/tiers");
      setTiers(applyTiersToForm(data.tiers ?? []));
    } catch (err) {
      setError(err.message ?? "Failed to load tier settings");
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

  const updateTier = (index, nextTier) => {
    setTiers((prev) => prev.map((tier, i) => (i === index ? nextTier : tier)));
  };

  const handleSave = async () => {
    const validationErrors = validateTiersForm(tiers);
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
        tiers: tiers.map((tier) => ({
          tierKey: tier.tierKey,
          name: tier.name.trim(),
          minLifetimeSpend: Number(tier.minLifetimeSpend),
          color: tier.color,
          benefitsDescription: tier.benefitsDescription.trim(),
          enabled: tier.enabled,
        })),
      };

      const data = await fetchWithSession(app, "/api/tiers", {
        method: "PUT",
        body: payload,
      });

      setTiers(applyTiersToForm(data.tiers ?? []));
      setSuccess("Tier settings saved. Customer tiers were recalculated.");
    } catch (err) {
      setError(err.message ?? "Failed to save tier settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="lp-loading-center" style={{ padding: "2rem" }}>
        <Spinner accessibilityLabel="Loading tiers" size="large" />
      </div>
    );
  }

  return (
    <>
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

      <div className="lp-tier-editor-grid">
        {tiers.map((tier, index) => (
          <TierEditorCard
            key={tier.tierKey}
            tier={tier}
            onChange={(nextTier) => updateTier(index, nextTier)}
          />
        ))}
      </div>

      <div className="lp-settings-actions">
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Save tier settings
        </Button>
        <Button onClick={loadTiers} disabled={saving}>
          Reset changes
        </Button>
      </div>
    </>
  );
}
