import { PillarStub } from "@/components/ui/pillar-stub";
import { PosCouponRedeem } from "@/components/sales/PosCouponRedeem";

export const metadata = { title: "POS" };

export default function PosPage() {
  return (
    <div className="space-y-6">
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
          "Coupon validate / redeem (forward-compat)",
        ]}
        primaryMode="mobile"
      />

      <PosCouponRedeem />
    </div>
  );
}
