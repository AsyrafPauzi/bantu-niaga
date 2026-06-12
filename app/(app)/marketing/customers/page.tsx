import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <PillarStub
      pillar="Marketing"
      surface="Customer Profiles CRM"
      description="Card-index customer log with auto-computed purchase metrics and segmentation tags."
      baseFeatures={[
        "Essential contact: name, phone (WA), email, address",
        "Derived: total_spend · last_purchase_at · order_count · AOV",
        "Manual tags + auto tags (new / repeat / vip / dormant / at-risk)",
        "Phone-based dedup on customer.created events",
        "CSV import + export",
      ]}
    />
  );
}
