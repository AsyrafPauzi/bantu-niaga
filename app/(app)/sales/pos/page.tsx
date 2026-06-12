import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "POS" };

export default function PosPage() {
  return (
    <PillarStub
      pillar="Sales"
      surface="Mobile POS"
      description="Fast, quick-tap product grid built for retail or cafe smartphones. Goal: log a sale in under 5 seconds."
      baseFeatures={[
        "Big-tap product grid (with variants)",
        "Cash + Static + Dynamic DuitNow QR",
        "Discounts: fixed amount + percentage, optional manager PIN",
        "Refund / Void with ledger reversal",
        "SST line on receipts",
        "Optional customer attach",
      ]}
      primaryMode="mobile"
    />
  );
}
