import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Sales" };

export default function SalesPage() {
  return (
    <PillarStub
      pillar="Pillar 5"
      surface="Sales"
      description="Track leads and take payment at the counter."
      baseFeatures={[
        "Sales Prospect CRM (lead pipeline)",
        "Mobile POS — Cash + Static + Dynamic DuitNow QR",
        "POS discounts (fixed + percentage, optional manager PIN)",
        "Refunds & Voids with proper ledger reversal",
        "SST line on receipts (toggle per business)",
        "Lead → Won → POS one-tap conversion",
      ]}
    />
  );
}
