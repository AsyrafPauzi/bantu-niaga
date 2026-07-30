import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { FinanceIncomePanel } from "@/components/finance/FinanceIncomePanel";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListPagination } from "@/components/ui/list-pagination";
import { parsePagination } from "@/lib/pagination";
import {
  computeFinanceMonthSummary,
  loadIncomeMonthInsights,
} from "@/lib/finance/helpers";
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
      <div className="space-y-6">
        <p className="text-sm text-ink-muted dark:text-cream-400">
          You don&apos;t have access to Finance.
        </p>
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

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <Link
        href="/finance"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Finance dashboard
      </Link>

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load income: {error.message}
          </CardBody>
        </Card>
      ) : (
        <>
          <FinanceIncomePanel
            initialTransactions={transactions}
            monthIncomeMyr={summary.income_myr}
            monthLabel={insights.monthLabel}
            incomeCount={insights.incomeCount}
            categories={insights.categories}
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
        </>
      )}
    </div>
  );
}
