import { redirect } from "next/navigation";
import { MarketplacePageHeader } from "@/components/marketplace/MarketplacePageHeader";
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
      <MarketplacePageHeader
        canEdit={canEdit}
        planLabel={tier?.label ?? business.tier}
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

