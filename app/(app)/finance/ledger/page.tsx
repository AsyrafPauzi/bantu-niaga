import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Ledger" };

export default function LedgerPage() {
  return (
    <PillarStub
      pillar="Finance"
      surface="Ledger"
      description="Simplified digital transaction ledger — chronological list of all entries with running balance and quick monthly summary."
      baseFeatures={[
        "Chronological revenue + expense entries",
        "Running balance",
        "Filters: date range, category, payment method",
        "Quick monthly summary card (in / out / net)",
      ]}
      primaryMode="desktop"
    />
  );
}
