import { redirect } from "next/navigation";
import { OperationsGuideJourney } from "@/components/operations/OperationsGuideJourney";
import { OperationsMobileFab } from "@/components/operations/OperationsMobileFab";
import { OperationsOverview } from "@/components/operations/OperationsOverview";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { loadOperationsDashboardCached } from "@/lib/cache/dashboard-cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getOperationsVerticalProfile,
  normalizeBusinessType,
} from "@/lib/operations/vertical";

export const metadata = { title: "Operations" };
export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "operations")) {
    redirect("/home");
  }

  const admin = createServiceRoleClient();
  const [{ data: business }, data] = await Promise.all([
    admin
      .from("businesses")
      .select("business_type")
      .eq("id", user.businessId)
      .maybeSingle(),
    loadOperationsDashboardCached(user.businessId),
  ]);

  const profile = getOperationsVerticalProfile(
    normalizeBusinessType(business?.business_type),
  );

  return (
    <div className="space-y-4">
      <OperationsGuideJourney businessId={user.businessId} />
      <OperationsOverview data={data} profile={profile} />
      <OperationsMobileFab />
    </div>
  );
}
