import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { TxRow } from "@/components/dashboard/tx-row";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { computeFinanceMonthSummary } from "@/lib/finance/helpers";
import { formatMyr } from "@/lib/finance/schemas";
import { loadBusiness } from "@/lib/settings/business";

export const metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "finance")) {
    redirect("/home");
  }

  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/home");

  const admin = createServiceRoleClient();
  const summary = await computeFinanceMonthSummary(admin, user.businessId);

  const { data: recentTxns } = await admin
    .from("finance_transactions")
    .select("id, kind, description, amount_myr, txn_date, counterparty")
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("txn_date", { ascending: false })
    .limit(5);

  const { count: openInvoices } = await admin
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", user.businessId)
    .eq("status", "sent")
    .is("deleted_at", null);

  const makingMoney = summary.net_myr >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Overview"
        description="Am I making money this month? Simple cash flow — no accounting jargon."
        action={
          <Link
            href="/finance/invoices/new"
            className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New invoice
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiTile
          label="Income (this month)"
          value={formatMyr(summary.income_myr)}
          deltaTone="success"
          helper="money in"
          icon={TrendingUp}
        />
        <KpiTile
          label="Expenses (this month)"
          value={formatMyr(summary.expense_myr)}
          deltaTone="danger"
          helper="money out"
          icon={TrendingDown}
        />
        <KpiTile
          label="Net profit (P&L)"
          value={formatMyr(summary.net_myr)}
          delta={makingMoney ? "Making money" : "Spending more than earning"}
          deltaTone={makingMoney ? "success" : "danger"}
          helper={summary.month}
          icon={Wallet}
        />
        <KpiTile
          label="Unpaid invoices"
          value={formatMyr(summary.invoice_outstanding_myr)}
          delta={`${openInvoices ?? 0} sent`}
          deltaTone="warning"
          helper="awaiting payment"
          icon={FileText}
        />
      </section>

      <SectionCard
        title="Profit & loss snapshot"
        subtitle={`${summary.month} — income minus expenses`}
        bodyClassName="grid gap-4 sm:grid-cols-3"
      >
        <div className="rounded-lg border border-cream-200 p-4 dark:border-hairline-dark">
          <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-cream-400">
            Total in
          </p>
          <p className="mt-1 text-2xl font-semibold text-status-success">
            {formatMyr(summary.income_myr)}
          </p>
        </div>
        <div className="rounded-lg border border-cream-200 p-4 dark:border-hairline-dark">
          <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-cream-400">
            Total out
          </p>
          <p className="mt-1 text-2xl font-semibold text-status-danger">
            {formatMyr(summary.expense_myr)}
          </p>
        </div>
        <div className="rounded-lg border border-cream-200 p-4 dark:border-hairline-dark">
          <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-cream-400">
            You keep
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${makingMoney ? "text-status-success" : "text-status-danger"}`}
          >
            {formatMyr(summary.net_myr)}
          </p>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <SectionCard
          title="Recent cash flow"
          subtitle="Latest income & expenses"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <Link
              href="/finance/ledger"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              Full ledger
            </Link>
          }
        >
          {(recentTxns ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted dark:text-cream-400">
              No entries yet —{" "}
              <Link href="/finance/ledger" className="text-brand-600 underline">
                log income or expense
              </Link>
            </p>
          ) : (
            (recentTxns ?? []).map(
              (row: {
                id: string;
                kind: string;
                description: string;
                amount_myr: number;
                txn_date: string;
                counterparty: string | null;
              }) => (
                <TxRow
                  key={row.id}
                  icon={row.kind === "income" ? ArrowDownRight : ArrowUpRight}
                  tone={row.kind === "income" ? "success" : "danger"}
                  title={row.description}
                  subtitle={
                    row.counterparty
                      ? `${row.txn_date} · ${row.counterparty}`
                      : row.txn_date
                  }
                  amount={
                    (row.kind === "income" ? "+" : "−") +
                    formatMyr(Number(row.amount_myr))
                  }
                />
              ),
            )
          )}
        </SectionCard>

        <SectionCard
          title="Quick links"
          subtitle="Most common finance tasks"
          bodyClassName="grid gap-2"
        >
          <Link
            href="/finance/ledger"
            className="rounded-lg border border-cream-200 p-3 text-sm font-medium hover:border-brand-200 dark:border-hairline-dark dark:hover:border-brand-700"
          >
            Cash flow ledger
          </Link>
          <Link
            href="/finance/invoices"
            className="rounded-lg border border-cream-200 p-3 text-sm font-medium hover:border-brand-200 dark:border-hairline-dark dark:hover:border-brand-700"
          >
            Invoices & share links
          </Link>
          <Link
            href="/finance/expenses"
            className="rounded-lg border border-cream-200 p-3 text-sm font-medium hover:border-brand-200 dark:border-hairline-dark dark:hover:border-brand-700"
          >
            Quick expense log
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}
