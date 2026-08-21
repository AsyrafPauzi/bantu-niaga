import { redirect } from "next/navigation";
import { SalesGuideJourney } from "@/components/sales/SalesGuideJourney";
import { SalesOverview } from "@/components/sales/SalesOverview";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageSalesCore, canUseLeads, canUsePos } from "@/lib/sales/access";
import { loadSalesDashboardCached } from "@/lib/cache/dashboard-cache";

export const metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

export default async function SalesPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const data = await loadSalesDashboardCached(user.businessId);

  return (
    <>
      <SalesGuideJourney businessId={user.businessId} />
      <SalesOverview
        data={data}
        showPos={canUsePos(user.role)}
        showLeads={canUseLeads(user.role)}
        showHistory={canManageSalesCore(user.role)}
      />
    </>
  );
}
