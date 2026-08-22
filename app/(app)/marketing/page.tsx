import { redirect } from "next/navigation";
import { MarketingFollowUpDesk } from "@/components/marketing/MarketingFollowUpDesk";
import { MarketingGuideJourney } from "@/components/marketing/MarketingGuideJourney";
import { MarketingOverview } from "@/components/marketing/MarketingOverview";
import { Card, CardBody } from "@/components/ui/card";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { loadFollowUpDesk } from "@/lib/marketing/follow-up-desk-load";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCachedMarketingDashboard } from "@/lib/marketing/dashboard-cache";
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
  const [dashboard, teamNotifications, followUpDesk, businessRow] =
    await Promise.all([
      loadCachedMarketingDashboard(user.businessId),
      loadPillarNotifications(supabase, user.businessId, "marketing", 12),
      loadFollowUpDesk(user.businessId),
      supabase
        .from("businesses")
        .select("name")
        .eq("id", user.businessId)
        .maybeSingle(),
    ]);

  const {
    snapshot,
    deltas,
    growth,
    topCustomers,
    upcoming,
    activity,
    topContent,
  } = dashboard;

  const preferredLocale = "en" as const;

  return (
    <div className="space-y-4">
      <MarketingGuideJourney businessId={user.businessId} />
      <MarketingFollowUpDesk
        dormant={followUpDesk.dormant}
        noPurchase={followUpDesk.noPurchase}
        notMessaged={followUpDesk.notMessaged}
        businessName={businessRow.data?.name ?? undefined}
        preferredLocale={preferredLocale}
      />
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
    </div>
  );
}
