import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <PillarStub
      pillar="Finance"
      surface="Expenses"
      description="Camera-first expense capture: snap a receipt, fill amount + category, save."
      baseFeatures={[
        "Quick-log fields: amount, category, vendor, date",
        "Receipt photo (stored under Admin Storage)",
        "Filter by date / category / payment method",
        "Auto-creates ledger entry",
      ]}
      primaryMode="mobile"
    />
  );
}
