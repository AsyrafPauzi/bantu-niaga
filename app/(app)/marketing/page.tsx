import { redirect } from "next/navigation";
import { MarketingGuideJourney } from "@/components/marketing/MarketingGuideJourney";
import { MarketingMobileFab } from "@/components/marketing/MarketingMobileFab";
import { MarketingOverview } from "@/components/marketing/MarketingOverview";
import { Card, CardBody } from "@/components/ui/card";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCustomerGrowthSeries,
  getKpiDeltas,
  getKpiSnapshot,
  getRecentActivity,
  getTopCustomers,
  getTopPostedContent,
  getUpcomingContent,
} from "@/lib/marketing/dashboard-queries";
import { loadPillarNotifications } from "@/lib/notifications/load-pillar";

export const metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";

export default async function MarketingOverviewPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "customers")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <h1 className="text-xl font-semibold text-ink dark:text-cream-100">
            Marketing
          </h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Marketing module. Ask your owner
            or manager.
          </p>
        </CardBody>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [
    snapshot,
    deltas,
    growth,
    topCustomers,
    upcoming,
    activity,
    topContent,
    teamNotifications,
  ] = await Promise.all([
    getKpiSnapshot(supabase, user.businessId),
    getKpiDeltas(supabase, user.businessId),
    getCustomerGrowthSeries(supabase, user.businessId, 12),
    getTopCustomers(supabase, user.businessId, 5),
    getUpcomingContent(supabase, user.businessId, 7),
    getRecentActivity(supabase, user.businessId, 5),
    getTopPostedContent(supabase, user.businessId, 4),
    loadPillarNotifications(supabase, user.businessId, "marketing", 12),
  ]);

  return (
    <div className="space-y-4">
      <MarketingGuideJourney businessId={user.businessId} />
      <MarketingOverview
        snapshot={snapshot}
        deltas={deltas}
        growth={growth}
        topCustomers={topCustomers}
        upcoming={upcoming}
        topContent={topContent}
        activity={activity}
        teamNotifications={teamNotifications}
      />
      <MarketingMobileFab />
    </div>
  );
}
