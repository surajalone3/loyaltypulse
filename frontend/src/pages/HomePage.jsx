import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Banner,
  BlockStack,
} from "@shopify/polaris";

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appInfo, setAppInfo] = useState(null);
  const [productCount, setProductCount] = useState(null);

  useEffect(() => {
    try {
      setLoading(true);

      // Fake data for testing
      setTimeout(() => {
        setAppInfo({
          shop: "loyaltypulse-test.myshopify.com",
        });

        setProductCount(123);
        setLoading(false);
      }, 500);
    } catch (err) {
      setError(err.message || "Failed to load app data");
      setLoading(false);
    }
  }, []);

  return (
    <Page title="LoyaltyPulse">
      <Layout>
        <Layout.Section>
          {error && (
            <Banner tone="critical" title="Error">
              <p>{error}</p>
            </Banner>
          )}

          <Card>
            <BlockStack gap="400">
              {loading ? (
                <Text as="p">Loading...</Text>
              ) : (
                <>
                  <Text as="h2" variant="headingMd">
                    Welcome to LoyaltyPulse
                  </Text>

                  <Text as="p" variant="bodyMd">
                    Connected shop:{" "}
                    <strong>{appInfo?.shop}</strong>
                  </Text>

                  <Text as="p" variant="bodyMd">
                    Products in catalog:{" "}
                    <strong>{productCount}</strong>
                  </Text>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}