import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return (
    <PillarStub
      pillar="Finance"
      surface="Invoices"
      description="Generate invoices with secure share URL, share via WhatsApp, mark paid in one tap."
      baseFeatures={[
        "Secure URL: bantuniaga.com/[idcompany]/inv-[hash]",
        "Per-business sequential numbering (INV-2026-0001)",
        "SST line (when enabled per business)",
        "Pay Now panel: DuitNow ID + amount + reference, tap-to-copy",
        "Statuses: Draft → Sent → Paid → Void",
        "Quote → Invoice convert",
        "Late-payment reminder (BM/EN script)",
      ]}
    />
  );
}
