import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Marketing" };

export default function MarketingPage() {
  return (
    <PillarStub
      pillar="Pillar 4"
      surface="Marketing"
      description="Reach customers and keep them coming back."
      baseFeatures={[
        "Customer Profiles CRM with derived purchase metrics",
        "Phone-based dedup (auto-merge, name-mismatch warning)",
        "Auto segmentation tags: new / repeat / vip / dormant / at-risk",
        "Customer CSV import + export",
        "Social Media Content Calendar (TikTok / IG / FB, plan-only)",
      ]}
    />
  );
}
