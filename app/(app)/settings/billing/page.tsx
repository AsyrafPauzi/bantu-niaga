import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Billing" };

export default function BillingSettingsPage() {
  return (
    <PillarStub
      pillar="Settings"
      surface="Billing"
      description="Subscription tier, add-ons, AI Agents, payment method. Owner-only."
      baseFeatures={[
        "Tier: Starter (RM 50) · Micro (RM 80) · SME (RM 120)",
        "Per-add-on subscriptions (prorated)",
        "Per-AI-Agent subscriptions (prorated, includes 100 Fast Credits)",
        "Top-ups: RM 10 / 50 Fast Credits",
        "Payment via Billplz / Curlec",
      ]}
      primaryMode="desktop"
    />
  );
}
