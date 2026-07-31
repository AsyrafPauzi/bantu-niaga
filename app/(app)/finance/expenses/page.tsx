import { redirect } from "next/navigation";
import { FinanceBackLink } from "@/components/finance/FinanceBackLink";
import { FinanceExpensesPanel } from "@/components/finance/FinanceExpensesPanel";
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
  loadExpenseMonthInsights,
} from "@/lib/finance/helpers";
import { expensesSubpageHero } from "@/lib/finance/subpage-hero";
import { formatMyr } from "@/lib/finance/schemas";
import { loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import type { FinanceTransactionRow } from "@/lib/finance/schemas";

export const metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage({
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
    loadExpenseMonthInsights(supabase, user.businessId),
  ]);

  const { data, error, count } = await supabase
    .from("finance_transactions")
    .select(
      "id, business_id, kind, amount_myr, category, description, counterparty, " +
        "payment_method, txn_date, finance_invoice_id, admin_file_id, created_by, created_at, updated_at",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .eq("kind", "expense")
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

  const topCategory = insights.categories[0] ?? null;
  const hero = expensesSubpageHero({
    monthExpenseMyr: summary.expense_myr,
    expenseCount: insights.expenseCount,
    monthLabel: insights.monthLabel,
    topCategory,
  });

  if (error) {
    return (
      <div className="space-y-4">
        <FinanceBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load expenses: {error.message}
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
            value={formatMyr(summary.expense_myr)}
            iconClassName="text-rose-700 dark:text-rose-300"
          />
          <ModuleHeroStat
            label="Logged"
            value={insights.expenseCount}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Categories"
            value={insights.categories.length}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Top spend"
            value={
              topCategory ? formatMyr(topCategory.amount_myr) : "—"
            }
            iconClassName="text-violet-700 dark:text-violet-300"
          />
        </div>
      }
    >
      <FinanceExpensesPanel
        initialTransactions={transactions}
        monthExpenseMyr={summary.expense_myr}
        monthLabel={insights.monthLabel}
        expenseCount={insights.expenseCount}
        categories={insights.categories}
        shellMode
      />
      {total > pagination.pageSize ? (
        <ListPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={total}
          basePath="/finance/expenses"
          className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark"
        />
      ) : null}
    </FinanceSubpageShell>
  );
}
