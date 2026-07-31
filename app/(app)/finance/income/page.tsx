import { redirect } from "next/navigation";
import { FinanceBackLink } from "@/components/finance/FinanceBackLink";
import { FinanceIncomePanel } from "@/components/finance/FinanceIncomePanel";
import { FinanceSubpageShell } from "@/components/finance/FinanceSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { Card, CardBody } from "@/components/ui/card";
import { ListPagination } from "@/components/ui/list-pagination";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parsePagination } from "@/lib/pagination";
import {
  computeFinanceMonthSummary,
  loadIncomeMonthInsights,
} from "@/lib/finance/helpers";
import { incomeSubpageHero } from "@/lib/finance/subpage-hero";
import { formatMyr } from "@/lib/finance/schemas";
import { loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import type { FinanceTransactionRow } from "@/lib/finance/schemas";

export const metadata = { title: "Income" };
export const dynamic = "force-dynamic";

export default async function IncomePage({
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
  const pagination = parsePagination(params, { defaultPageSize: 15 });
  const supabase = await createSupabaseServerClient();

  const [summary, insights] = await Promise.all([
    computeFinanceMonthSummary(supabase, user.businessId),
    loadIncomeMonthInsights(supabase, user.businessId),
  ]);

  const { data, error, count } = await supabase
    .from("finance_transactions")
    .select(
      "id, business_id, kind, amount_myr, category, description, counterparty, " +
        "payment_method, txn_date, finance_invoice_id, admin_file_id, created_by, created_at, updated_at",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .eq("kind", "income")
    .is("deleted_at", null)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);
  const total = count ?? data?.length ?? 0;
  const rows = (data ?? []) as unknown as FinanceTransactionRow[];
  const fileNames = await loadAdminFileNames(
    supabase,
    user.businessId,
    rows.map((r) => r.admin_file_id).filter(Boolean) as string[],
  );
  const transactions = rows.map((row) => ({
    ...row,
    admin_file_name: row.admin_file_id
      ? (fileNames.get(row.admin_file_id) ?? null)
      : null,
  }));

  const hero = incomeSubpageHero({
    monthIncomeMyr: summary.income_myr,
    incomeCount: insights.incomeCount,
    monthLabel: insights.monthLabel,
  });

  if (error) {
    return (
      <div className="space-y-4">
        <FinanceBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load income: {error.message}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <FinanceSubpageShell
      headline={hero.headline}
      subcopy={hero.subcopy}
      variant={hero.variant}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="This month"
            value={formatMyr(summary.income_myr)}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Logged"
            value={insights.incomeCount}
            iconClassName="text-teal-700 dark:text-teal-300"
          />
          <ModuleHeroStat
            label="Categories"
            value={insights.categories.length}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Net month"
            value={formatMyr(summary.income_myr - summary.expense_myr)}
            iconClassName={
              summary.income_myr >= summary.expense_myr
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-700 dark:text-rose-300"
            }
          />
        </div>
      }
    >
      <FinanceIncomePanel
        initialTransactions={transactions}
        monthIncomeMyr={summary.income_myr}
        monthLabel={insights.monthLabel}
        incomeCount={insights.incomeCount}
        categories={insights.categories}
        shellMode
      />
      {total > pagination.pageSize ? (
        <ListPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={total}
          basePath="/finance/income"
          className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark"
        />
      ) : null}
    </FinanceSubpageShell>
  );
}
