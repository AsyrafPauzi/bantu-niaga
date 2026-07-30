import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import {
  FinanceReportsPanel,
  type FinanceReportTab,
} from "@/components/finance/FinanceReportsPanel";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListPagination } from "@/components/ui/list-pagination";
import { parsePagination } from "@/lib/pagination";
import {
  formatFinancePeriodLabel,
  loadFinanceAnalyticsForRange,
  parseReportDateRange,
} from "@/lib/finance/analytics";
import { computeFinancePnLStatementForRange } from "@/lib/finance/helpers";
import { loadBusiness } from "@/lib/settings/business";
import type { FinanceTransactionRow } from "@/lib/finance/schemas";

export const metadata = { title: "Finance reports" };
export const dynamic = "force-dynamic";

function parseTab(raw: string | string[] | undefined): FinanceReportTab {
  const value = typeof raw === "string" ? raw : undefined;
  if (value === "pnl" || value === "analytics" || value === "ledger") return value;
  return "ledger";
}

export default async function FinanceReportsPage({
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
  const range = parseReportDateRange({
    days: typeof params.days === "string" ? params.days : undefined,
    from: typeof params.from === "string" ? params.from : undefined,
    to: typeof params.to === "string" ? params.to : undefined,
  });
  const tab = parseTab(params.tab);
  const { start, end } = range;
  const periodLabel = formatFinancePeriodLabel(start, end);
  const pagination = parsePagination(params, { defaultPageSize: 25 });

  const supabase = await createSupabaseServerClient();

  const paginationParams =
    range.mode === "custom"
      ? { tab, from: start, to: end }
      : { tab, days: String(range.days ?? 7) };

  const [analytics, pnl, business, txnResult] = await Promise.all([
    loadFinanceAnalyticsForRange(supabase, user.businessId, start, end, {
      days: range.days,
      mode: range.mode,
    }),
    computeFinancePnLStatementForRange(
      supabase,
      user.businessId,
      start,
      end,
      periodLabel,
    ),
    loadBusiness(user.businessId),
    supabase
      .from("finance_transactions")
      .select(
        "id, business_id, kind, amount_myr, category, description, counterparty, " +
          "payment_method, txn_date, finance_invoice_id, admin_file_id, created_by, created_at, updated_at",
        { count: "exact" },
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .gte("txn_date", start)
      .lte("txn_date", end)
      .order("txn_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(pagination.from, pagination.to),
  ]);

  const { data, error, count } = txnResult;
  const total = count ?? data?.length ?? 0;
  const transactions = (data ?? []) as unknown as FinanceTransactionRow[];

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
            Failed to load reports: {error.message}
          </CardBody>
        </Card>
      ) : (
        <>
          <FinanceReportsPanel
            tab={tab}
            range={range}
            analytics={analytics}
            pnl={pnl}
            transactions={transactions}
            businessName={business?.name}
          />
          {tab === "ledger" && total > pagination.pageSize ? (
            <ListPagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={total}
              basePath="/finance/reports"
              searchParams={paginationParams}
              className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
