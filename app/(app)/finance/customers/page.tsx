import { redirect } from "next/navigation";
import { FinanceBackLink } from "@/components/finance/FinanceBackLink";
import { FinanceAddCustomerButton } from "@/components/finance/FinanceAddCustomerButton";
import { FinanceCustomerPanel } from "@/components/finance/FinanceCustomerPanel";
import { FinanceSubpageShell } from "@/components/finance/FinanceSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { Card, CardBody } from "@/components/ui/card";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  loadFinanceCustomersPage,
  loadFinanceCustomersSummary,
} from "@/lib/finance/customers";
import { parsePagination } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { customersSubpageHero } from "@/lib/finance/subpage-hero";
import { formatMyr } from "@/lib/finance/schemas";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function FinanceCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "finance")) {
    return (
      <div className="space-y-4">
        <FinanceBackLink />
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              You don&apos;t have access to Finance.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const pagination = parsePagination(params, { defaultPageSize: 10 });
  const searchQuery =
    typeof params.q === "string" ? params.q.trim() : "";

  const supabase = await createSupabaseServerClient();
  const [summary, pageData] = await Promise.all([
    loadFinanceCustomersSummary(supabase, user.businessId),
    loadFinanceCustomersPage(supabase, user.businessId, {
      from: pagination.from,
      to: pagination.to,
      q: searchQuery || undefined,
    }),
  ]);

  const hero = customersSubpageHero(summary);

  return (
    <FinanceSubpageShell
      headline={hero.headline}
      subcopy={hero.subcopy}
      variant={hero.variant}
      action={<FinanceAddCustomerButton />}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Saved"
            value={summary.total}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Reachable"
            value={summary.with_contact}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Billed before"
            value={summary.active_billers}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Unpaid"
            value={formatMyr(summary.outstanding_myr)}
            iconClassName="text-rose-700 dark:text-rose-300"
          />
        </div>
      }
    >
      <FinanceCustomerPanel
        initialCustomers={pageData.customers}
        summary={summary}
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pageData.total}
        searchQuery={searchQuery}
        shellMode
      />
    </FinanceSubpageShell>
  );
}
