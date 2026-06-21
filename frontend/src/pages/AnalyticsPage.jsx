import ComingSoonPage from "../components/ui/ComingSoonPage.jsx";

export default function AnalyticsPage() {
  return (
    <ComingSoonPage
      title="Advanced analytics"
      description="Deep loyalty insights, cohort trends, and revenue attribution will live here in LoyaltyPulse V2."
      features={[
        "Points velocity and redemption forecasting",
        "Tier migration and retention cohorts",
        "Revenue impact by loyalty segment",
        "Custom date ranges and exportable reports",
      ]}
    />
  );
}
