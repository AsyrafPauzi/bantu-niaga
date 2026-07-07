import { FileCheck } from "lucide-react";
import { HrMarketplaceAddonGate } from "@/components/hr/HrMarketplaceAddonGate";

export function HrAdvancedLeavePolicyGate() {
  return (
    <HrMarketplaceAddonGate
      icon={FileCheck}
      title="Advanced Leave Policy"
      description="Automate AL carry-forward with caps, pro-rated entitlement for mid-year joiners, custom emergency and MC rules, hard balance enforcement, and team leave calendar views."
      priceLabel="RM 29/month (planned)"
      comingSoon
      marketplaceHint="Placeholder add-on · extends the free core leave balance"
    />
  );
}
