import Link from "next/link";
import { redirect } from "next/navigation";
import { Upload, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { MarketingCustomersBackLink } from "@/components/marketing/MarketingCustomersBackLink";
import { NewCustomerFormPencil } from "@/components/marketing/NewCustomerFormPencil";
import {
  ModuleDashboardHero,
  ModuleHeroStat,
} from "@/components/dashboard/module-layout";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getKpiSnapshot } from "@/lib/marketing/dashboard-queries";
import { formatCount } from "@/lib/marketing/metrics";
import { newCustomerSubpageHero } from "@/lib/marketing/subpage-hero";

export const metadata = { title: "New customer" };
export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
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
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Marketing CRM.
          </p>
        </CardBody>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();
  const snapshot = await getKpiSnapshot(supabase, user.businessId);
  const hero = newCustomerSubpageHero(snapshot);

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingCustomersBackLink />

      <ModuleDashboardHero
        module="Marketing · Customers"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
        cta={
          <Link
            href="/marketing/customers/import"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition-colors hover:bg-white dark:border-violet-900/50 dark:bg-panel-dark/80 dark:text-violet-200"
          >
            <Upload className="h-4 w-4" strokeWidth={2} />
            Import CSV
          </Link>
        }
      >
        {snapshot.totalCustomers > 0 ? (
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <ModuleHeroStat
              label="In CRM"
              value={formatCount(snapshot.totalCustomers)}
              icon={<Users />}
              iconClassName="text-violet-700 dark:text-violet-300"
            />
            <ModuleHeroStat
              label="VIP"
              value={formatCount(snapshot.vipCount)}
              hint="auto-tagged"
              iconClassName="text-amber-700 dark:text-amber-300"
            />
            <ModuleHeroStat
              label="Dormant"
              value={formatCount(snapshot.dormantCount)}
              hint="win-back pool"
              iconClassName="text-slate-600 dark:text-slate-300"
            />
          </div>
        ) : null}
      </ModuleDashboardHero>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <NewCustomerFormPencil />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              What happens next
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-ink dark:text-cream-100">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Phone is normalised to +60 and checked against your existing
                  list.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  VIP, repeat, and dormant tags update from POS and Finance
                  orders — not from this form.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Manual tags here are for your own labels — wholesale, regular,
                  and so on.
                </span>
              </li>
            </ul>
          </div>

          {snapshot.totalCustomers >= 5 ? (
            <Card>
              <CardBody className="space-y-2 text-sm">
                <p className="font-semibold text-ink dark:text-cream-100">
                  Adding many at once?
                </p>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  CSV import handles up to 5,000 rows with phone dedupe preview
                  before commit.
                </p>
                <Link
                  href="/marketing/customers/import"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                >
                  <Upload className="h-4 w-4" strokeWidth={2} />
                  Open import wizard
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
