import { UserCircle } from "lucide-react";
import { HrMarketplaceAddonGate } from "@/components/hr/HrMarketplaceAddonGate";

export function HrStaffPortalGate() {
  return (
    <HrMarketplaceAddonGate
      icon={UserCircle}
      title="Staff Self-Service Portal"
      description="Give each staff member their own login to check leave balance, view history, and apply for leave — without sharing the owner dashboard."
      priceLabel="RM 29/month (planned)"
      comingSoon
      marketplaceHint="Placeholder add-on · full portal ships in a later release"
    />
  );
}
