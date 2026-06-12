import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Finance" };

export default function FinancePage() {
  return (
    <PillarStub
      pillar="Pillar 2"
      surface="Finance"
      description="Track money, send invoices, stay LHDN-compliant — without learning accounting jargon."
      baseFeatures={[
        "Basic Accounting Module — revenue / expense ledger with running balance",
        "Invoice Generator with secure share URL",
        "Per-business invoice numbering (INV-2026-0001 + secure hash)",
        "Simple SST line (flat percent toggle)",
        "Universal Pay Now panel — DuitNow ID + tap-to-copy (no merchant account needed)",
        "Quote → Invoice converter",
        "Late-payment reminder generator (BM/EN WA-ready scripts)",
      ]}
    />
  );
}
