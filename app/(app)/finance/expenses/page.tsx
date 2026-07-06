import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { FinanceCashFlowPanel } from "@/components/finance/FinanceCashFlowPanel";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { computeFinanceMonthSummary } from "@/lib/finance/helpers";
import type { FinanceTransactionRow } from "@/lib/finance/schemas";

export const metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
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
        <PageHeader
          eyebrow="Finance"
          title="Log expense"
          description="Quick expense capture for daily spending."
        />
        <Card>
          <CardBody className="py-10 text-center text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Finance.
          </CardBody>
        </Card>
      </div>
    );
  }

  const admin = createServiceRoleClient();
  const summary = await computeFinanceMonthSummary(admin, user.businessId);

  const { data, error } = await admin
    .from("finance_transactions")
    .select(
      "id, business_id, kind, amount_myr, category, description, counterparty, " +
        "payment_method, txn_date, finance_invoice_id, created_by, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .eq("kind", "expense")
    .is("deleted_at", null)
    .order("txn_date", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Log expense"
        description="Snap-style quick log — amount, vendor, category. Keeps your monthly P&L honest."
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load expenses: {error.message}
          </CardBody>
        </Card>
      ) : (
        <FinanceCashFlowPanel
          initialTransactions={(data ?? []) as unknown as FinanceTransactionRow[]}
          initialSummary={summary}
          defaultKind="expense"
          title="Expenses"
        />
      )}
    </div>
  );
}
