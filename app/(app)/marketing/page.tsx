import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCount, formatMyr } from "@/lib/marketing/metrics";
import {
  getCustomerGrowthSeries,
  getKpiDeltas,
  getKpiSnapshot,
  getNewCustomersSparkline,
  getRecentActivity,
  getSegmentBreakdown,
  getSpendDistribution,
  getTopCustomers,
  getUpcomingContent,
} from "@/lib/marketing/dashboard-queries";
import { DashboardHeader } from "@/components/marketing/dashboard/DashboardHeader";
import { DashboardSection } from "@/components/marketing/dashboard/DashboardSection";
import { KpiTileBig } from "@/components/marketing/dashboard/KpiTileBig";
import { GrowthChart } from "@/components/marketing/dashboard/GrowthChart";
import { SegmentDonut } from "@/components/marketing/dashboard/SegmentDonut";
import { TopCustomersTable } from "@/components/marketing/dashboard/TopCustomersTable";
import { UpcomingContentList } from "@/components/marketing/dashboard/UpcomingContentList";
import { RecentActivityFeed } from "@/components/marketing/dashboard/RecentActivityFeed";
import { SpendDistributionBar } from "@/components/marketing/dashboard/SpendDistributionBar";
import { QuickActionsRow } from "@/components/marketing/dashboard/QuickActionsRow";
import { ConnectPosCard } from "@/components/marketing/dashboard/ConnectPosCard";
import { PeriodPill } from "@/components/marketing/dashboard/PeriodPill";

/**
 * Marketing pillar landing page — dense CRM dashboard.
 *
 * Server Component. Pulls all dashboard data in parallel via
 * `Promise.all` so the page renders in a single round-trip. Each
 * chart child component is a "use client" island that wraps Recharts.
 */
export const metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";

export default async function MarketingLandingPage() {
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
            You don&apos;t have access to the Marketing pillar. Ask your
            owner / manager.
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
    segments,
    topCustomers,
    upcomingContent,
    recentActivity,
    spendBuckets,
    spark,
    businessRow,
  ] = await Promise.all([
    getKpiSnapshot(supabase, user.businessId),
    getKpiDeltas(supabase, user.businessId),
    getCustomerGrowthSeries(supabase, user.businessId, 12),
    getSegmentBreakdown(supabase, user.businessId),
    getTopCustomers(supabase, user.businessId, 5),
    getUpcomingContent(supabase, user.businessId, 7),
    getRecentActivity(supabase, user.businessId, 8),
    getSpendDistribution(supabase, user.businessId),
    getNewCustomersSparkline(supabase, user.businessId, 7),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", user.businessId)
      .maybeSingle(),
  ]);

  const businessName =
    typeof businessRow?.data?.name === "string" ? businessRow.data.name : "";

  const orderCount = Math.round(
    snapshot.totalSpendMyr > 0 && snapshot.avgAovMyr > 0
      ? snapshot.totalSpendMyr / snapshot.avgAovMyr
      : 0,
  );

  const summary = `${formatCount(snapshot.totalCustomers)} customers · ${formatMyr(snapshot.totalSpendMyr)} lifetime spend · ${formatCount(snapshot.vipCount)} VIPs`;

  const formatSignedCount = (n: number): string =>
    `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-MY")}`;
  const formatSignedMyr = (n: number): string => {
    if (!Number.isFinite(n) || n === 0) return "RM 0";
    const sign = n > 0 ? "+" : "−";
    return `${sign}RM ${Math.abs(n).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        businessName={businessName}
        summary={summary}
        action={<PeriodPill label="This month" />}
      />

      <QuickActionsRow />

      <section
        aria-label="Headline KPIs"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <KpiTileBig
          label="Total customers"
          value={formatCount(snapshot.totalCustomers)}
          sublabel="Live + un-merged records"
          tone="brand"
          delta={
            deltas.totalCustomersDelta !== 0
              ? {
                  value: deltas.totalCustomersDelta,
                  display: formatSignedCount(deltas.totalCustomersDelta),
                  label: "vs last month",
                }
              : null
          }
          spark={spark}
          sparkKey="total-customers"
        />
        <KpiTileBig
          label="New this month"
          value={formatCount(snapshot.newThisMonth)}
          sublabel="Created since the 1st"
          tone="success"
          delta={{
            value: snapshot.newThisMonth,
            display: `${snapshot.newThisMonth > 0 ? "+" : ""}${formatCount(snapshot.newThisMonth)}`,
            label: "this month",
          }}
          spark={spark}
          sparkKey="new-this-month"
        />
        <KpiTileBig
          label="Total spend"
          value={formatMyr(snapshot.totalSpendMyr)}
          sublabel="Lifetime, all live customers"
          tone="accent"
          delta={
            deltas.totalSpendDelta !== 0
              ? {
                  value: deltas.totalSpendDelta,
                  display: formatSignedMyr(deltas.totalSpendDelta),
                  label: "vs last month",
                }
              : null
          }
        />
        <KpiTileBig
          label="Avg order value"
          value={formatMyr(snapshot.avgAovMyr)}
          sublabel={`Across ${formatCount(orderCount)} orders`}
          tone="info"
          delta={
            deltas.aovDelta !== 0
              ? {
                  value: deltas.aovDelta,
                  display: formatSignedMyr(deltas.aovDelta),
                  label: "vs last month",
                }
              : null
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <Card>
            <DashboardSection
              accent
              className="p-4 sm:p-5"
              title="Customer growth"
              subtitle="Cumulative customers vs new additions, last 12 months."
            >
              <GrowthChart data={growth} />
            </DashboardSection>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
            <Card>
              <DashboardSection
                accent
                className="p-4 sm:p-5"
                title="Auto-segments"
                subtitle="VIP / Repeat / New / Dormant / At-risk distribution."
              >
                <SegmentDonut slices={segments} />
              </DashboardSection>
            </Card>

            <Card>
              <DashboardSection
                accent
                className="p-4 sm:p-5"
                title="Spend distribution"
                subtitle="How your book splits across spend bands."
              >
                <SpendDistributionBar data={spendBuckets} />
              </DashboardSection>
            </Card>
          </div>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <Card>
            <DashboardSection
              accent
              className="p-4 sm:p-5"
              title="Top customers"
              subtitle="By lifetime spend."
            >
              <TopCustomersTable rows={topCustomers} />
            </DashboardSection>
          </Card>

          <Card>
            <DashboardSection
              accent
              className="p-4 sm:p-5"
              title="Upcoming content"
              subtitle="Next 7 days · TikTok, IG, FB."
            >
              <UpcomingContentList rows={upcomingContent} />
            </DashboardSection>
          </Card>

          <Card>
            <DashboardSection
              accent
              className="p-4 sm:p-5"
              title="Recent activity"
              subtitle="Live customer events."
            >
              <RecentActivityFeed rows={recentActivity} />
            </DashboardSection>
          </Card>
        </div>
      </div>

      <ConnectPosCard />
    </div>
  );
}
