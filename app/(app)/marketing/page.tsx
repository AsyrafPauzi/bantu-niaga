import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/marketing/KpiCard";
import {
  coerceKpiSnapshot,
  formatCount,
  formatMyr,
  type KpiSnapshotRaw,
} from "@/lib/marketing/metrics";

/**
 * Marketing M6 landing page.
 *
 * Replaces the M1–M5 `PillarStub` placeholder with 5 KPI cards reading
 * from the M6 `customer_analytics_v1` view (via the
 * `marketing_kpi_snapshot` RPC).
 *
 * In v1 the cards will read 0/0/0/0/0 until:
 *   - The other dev wires the upstream Finance / Operations / Sales
 *     events (D1–D4 in `marketing-implementation-plan.md` §3.3), AND
 *   - The Marketing event listener processes those events (this
 *     pillar's M6 RPC).
 *
 * Once events flow, the numbers light up without any code change here —
 * the view + RPC pull from the live `customers` table.
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
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "marketing_kpi_snapshot",
    { p_business_id: user.businessId },
  );

  const snapshotRow: KpiSnapshotRaw | null = Array.isArray(rpcData)
    ? ((rpcData[0] as KpiSnapshotRaw | undefined) ?? null)
    : ((rpcData as KpiSnapshotRaw | null | undefined) ?? null);
  const snapshot = coerceKpiSnapshot(snapshotRow);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
          Pillar 4
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink dark:text-cream-100">
          Marketing
        </h1>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          Reach customers and keep them coming back. Live KPI snapshot
          based on the Customer Profiles CRM and auto-segmentation
          tags.
        </p>
        {rpcError ? (
          <p className="mt-2 text-sm text-status-danger">
            Failed to load KPI snapshot: {rpcError.message}. Showing
            zero defaults.
          </p>
        ) : null}
      </header>

      <section
        aria-label="Customer KPIs"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <KpiCard
          label="Total customers"
          value={formatCount(snapshot.total_customers)}
          sublabel="Live + un-merged records"
          tone="default"
        />
        <KpiCard
          label="New this month"
          value={formatCount(snapshot.new_this_month)}
          sublabel="Created since the 1st"
          tone="positive"
        />
        <KpiCard
          label="VIPs"
          value={formatCount(snapshot.vip_count)}
          sublabel="≥ RM 1,000 spend or 10 orders"
          tone="vip"
        />
        <KpiCard
          label="Dormant"
          value={formatCount(snapshot.dormant_count)}
          sublabel="No purchase in 90+ days"
          tone="muted"
        />
        <KpiCard
          label="At-risk"
          value={formatCount(snapshot.at_risk_count)}
          sublabel="Repeat / VIP slipping (60–90 days)"
          tone="warning"
        />
      </section>

      <section
        aria-label="Marketing quick links"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <Link href="/marketing/customers">
          <Card className="h-full transition-colors hover:bg-cream-100 dark:hover:bg-hairline-dark/40">
            <CardBody>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                View all customers
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                Search, filter, segment and merge the CRM.
              </p>
              <p className="mt-3 text-xs font-medium text-brand-700 dark:text-brand-200">
                Open CRM →
              </p>
            </CardBody>
          </Card>
        </Link>
        <Link href="/marketing/content">
          <Card className="h-full transition-colors hover:bg-cream-100 dark:hover:bg-hairline-dark/40">
            <CardBody>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                Open content calendar
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                Plan TikTok / IG / FB posts on a week view.
              </p>
              <p className="mt-3 text-xs font-medium text-brand-700 dark:text-brand-200">
                Open calendar →
              </p>
            </CardBody>
          </Card>
        </Link>
        <Link href="/marketing/customers/import">
          <Card className="h-full transition-colors hover:bg-cream-100 dark:hover:bg-hairline-dark/40">
            <CardBody>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                Import customers
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                Upload CSV (up to 5,000 rows) with dry-run preview.
              </p>
              <p className="mt-3 text-xs font-medium text-brand-700 dark:text-brand-200">
                Open importer →
              </p>
            </CardBody>
          </Card>
        </Link>
      </section>

      <section
        aria-label="Customer health summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <Card>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              Repeat customers
            </p>
            <p className="mt-2 text-2xl font-semibold text-ink dark:text-cream-100">
              {formatCount(snapshot.repeat_count)}
            </p>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              2+ orders recorded
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              Total spend
            </p>
            <p className="mt-2 text-2xl font-semibold text-ink dark:text-cream-100">
              {formatMyr(snapshot.total_spend_myr_sum)}
            </p>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              Lifetime, all live customers
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              Avg order value
            </p>
            <p className="mt-2 text-2xl font-semibold text-ink dark:text-cream-100">
              {formatMyr(snapshot.avg_aov_myr)}
            </p>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              Across customers with ≥1 order
            </p>
          </CardBody>
        </Card>
      </section>

      <section aria-label="Add customer quick action">
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                Add a new customer
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                Manually enter name + phone, or import a batch.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/marketing/customers/new">
                <Button size="sm">Add manually</Button>
              </Link>
              <Link href="/marketing/customers/import">
                <Button size="sm" variant="secondary">
                  Import CSV
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
