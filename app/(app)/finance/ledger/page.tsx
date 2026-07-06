import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { FinanceCashFlowPanel } from "@/components/finance/FinanceCashFlowPanel";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { computeFinanceMonthSummary } from "@/lib/finance/helpers";
import type { FinanceTransactionRow } from "@/lib/finance/schemas";

export const metadata = { title: "Ledger" };
export const dynamic = "force-dynamic";

export default async function LedgerPage() {
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
          title="Cash flow ledger"
          description="Chronological income and expense entries."
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
    .is("deleted_at", null)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Cash flow ledger"
        description="Every ringgit in and out — with a running profit & loss for this month."
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load ledger: {error.message}
          </CardBody>
        </Card>
      ) : (
        <FinanceCashFlowPanel
          initialTransactions={(data ?? []) as unknown as FinanceTransactionRow[]}
          initialSummary={summary}
          title="Ledger"
        />
      )}
    </div>
  );
}
