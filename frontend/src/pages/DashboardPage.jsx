import { useCallback, useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Banner,
  BlockStack,
  InlineGrid,
  Spinner,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithSession } from "../utils/api.js";

function MetricCard({ title, value }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">
          {title}
        </Text>
        <Text as="p" variant="heading2xl">
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}

function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

export default function DashboardPage() {
  const app = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({
    totalLoyaltyMembers: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    memberGrowthThisMonth: { newMembers: 0 },
  });

  const loadDashboard = useCallback(async () => {
    if (!app) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await fetchWithSession(app, "/api/dashboard");

      setMetrics({
        totalLoyaltyMembers: data.totalLoyaltyMembers ?? 0,
        totalPointsIssued: data.totalPointsIssued ?? 0,
        totalPointsRedeemed: data.totalPointsRedeemed ?? 0,
        memberGrowthThisMonth: data.memberGrowthThisMonth ?? { newMembers: 0 },
      });
    } catch (err) {
      setError(err.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <Page title="Dashboard">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" title="Could not load dashboard">
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          {loading ? (
            <Card>
              <BlockStack gap="400" inlineAlign="center">
                <Spinner accessibilityLabel="Loading dashboard" size="large" />
              </BlockStack>
            </Card>
          ) : (
            <InlineGrid columns={{ xs: 1, sm: 2, lg: 2 }} gap="400">
              <MetricCard
                title="Total Loyalty Members"
                value={formatCount(metrics.totalLoyaltyMembers)}
              />
              <MetricCard
                title="Total Points Issued"
                value={formatCount(metrics.totalPointsIssued)}
              />
              <MetricCard
                title="Total Points Redeemed"
                value={formatCount(metrics.totalPointsRedeemed)}
              />
              <MetricCard
                title="New Members This Month"
                value={formatCount(metrics.memberGrowthThisMonth.newMembers)}
              />
            </InlineGrid>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
