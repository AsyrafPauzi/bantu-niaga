import { redirect } from "next/navigation";
import { AdminGuideJourney } from "@/components/admin/AdminGuideJourney";
import { AdminMobileFab } from "@/components/admin/AdminMobileFab";
import { AdminOverview } from "@/components/admin/AdminOverview";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { loadAdminOverview } from "@/lib/admin/overview";
import { hasAdminAssistantAddon } from "@/lib/marketplace/entitlements";
import { canSurface } from "@/lib/permissions";
import { loadBusiness } from "@/lib/settings/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/home");

  const canStorage = canSurface(user.role, "admin", "storage");
  const canTasks = canSurface(user.role, "admin", "tasks");
  const canCompliance = canSurface(user.role, "admin", "compliance");
  const hasAdminAssistant = await hasAdminAssistantAddon(user.businessId);

  const data = await loadAdminOverview(supabase, user.businessId, {
    canStorage,
    canTasks,
    canCompliance,
    tier: business.tier,
    hasAdminAssistant,
  });

  return (
    <div className="space-y-4">
      <AdminGuideJourney businessId={user.businessId} />
      <AdminOverview
        data={data}
        canStorage={canStorage}
        canTasks={canTasks}
        canCompliance={canCompliance}
      />
      <AdminMobileFab canStorage={canStorage} canTasks={canTasks} />
    </div>
  );
}
