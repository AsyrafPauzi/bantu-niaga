import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { MarketplaceView } from "@/components/marketplace/MarketplaceView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadCatalog } from "@/lib/marketplace/load";
import { loadBusiness } from "@/lib/settings/business";
import { tierBy } from "@/lib/settings/plans";

export const metadata = { title: "Marketplace" };
export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const [catalog, business] = await Promise.all([
    loadCatalog(),
    loadBusiness(user.businessId),
  ]);

  if (!business) redirect("/home");
  const canEdit = user.role === "owner";
  const tier = tierBy(business.tier);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Add-ons & integrations"
        description="Switch on extra capacity, channels, or AI capability — billed prorated to your next renewal."
        action={
          canEdit ? (
            <Badge tone="brand">{tier?.label ?? business.tier} plan</Badge>
          ) : (
            <Badge tone="warning">Read-only — owner role required</Badge>
          )
        }
      />

      <MarketplaceView
        initial={catalog}
        canEdit={canEdit}
        tier={business.tier}
        subscriptionRenewalAt={business.subscription_renewal_at}
      />
    </div>
  );
}
