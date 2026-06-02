import { useCallback, useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  Banner,
  BlockStack,
  Spinner,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";

function applySettingsToForm(settings) {
  return {
    pointsPerDollar: String(settings.pointsPerDollar ?? ""),
    rewardThreshold: String(settings.rewardThreshold ?? ""),
    pointsName: settings.pointsName ?? "",
    isActive: Boolean(settings.isActive),
  };
}

export default function SettingsPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    pointsPerDollar: "",
    rewardThreshold: "",
    pointsName: "",
    isActive: true,
  });

  const loadSettings = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await fetchWithSession(app, "/api/loyalty");
      setForm(applySettingsToForm(data));
    } catch (err) {
      setError(err.message ?? "Failed to load loyalty settings");
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        pointsPerDollar: Number(form.pointsPerDollar),
        rewardThreshold: Number(form.rewardThreshold),
        pointsName: form.pointsName,
        isActive: form.isActive,
      };

      const data = await fetchWithSession(app, "/api/loyalty", {
        method: "PUT",
        body: payload,
      });

      setForm(applySettingsToForm(data));
      setSuccess("Loyalty settings saved successfully.");
    } catch (err) {
      setError(err.message ?? "Failed to save loyalty settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Loyalty Settings"
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: saving,
        disabled: loading,
      }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" title="Error" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {success && (
          <Layout.Section>
            <Banner
              tone="success"
              title="Saved"
              onDismiss={() => setSuccess(null)}
            >
              <p>{success}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            {loading ? (
              <BlockStack gap="400" inlineAlign="center">
                <Spinner accessibilityLabel="Loading settings" size="large" />
                <Text as="p" tone="subdued">
                  Loading loyalty settings…
                </Text>
              </BlockStack>
            ) : (
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
                  helpText="How many points customers earn per $1 spent"
                />
                <TextField
                  label="Reward threshold"
                  type="number"
                  min={1}
                  autoComplete="off"
                  value={form.rewardThreshold}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, rewardThreshold: value }))
                  }
                  helpText="Points required to redeem a reward"
                />
                <TextField
                  label="Points name"
                  autoComplete="off"
                  value={form.pointsName}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, pointsName: value }))
                  }
                  helpText='Display name for points (e.g. "points", "stars")'
                />
                <Checkbox
                  label="Loyalty program active"
                  checked={form.isActive}
                  onChange={(checked) =>
                    setForm((prev) => ({ ...prev, isActive: checked }))
                  }
                  helpText="When disabled, new points are not awarded on orders"
                />
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saving}
                >
                  Save settings
                </Button>
              </FormLayout>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
