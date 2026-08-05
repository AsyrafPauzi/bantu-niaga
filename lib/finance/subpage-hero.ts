import type { LegacyModuleHeroVariant } from "@/components/dashboard/module-layout";
import type { FinanceAnalyticsSummary } from "@/lib/finance/analytics";
import type { FinanceCustomersSummary } from "@/lib/finance/customers";
import type { ExpenseCategoryInsight } from "@/lib/finance/helpers";
import type { FinanceInvoicesSummary } from "@/lib/finance/invoices-summary";
import { formatMyr } from "@/lib/finance/schemas";

export function invoiceSubpageHero(summary: FinanceInvoicesSummary): {
  headline: string;
  subcopy: string;
  variant: LegacyModuleHeroVariant;
} {
  const headline =
    summary.outstanding_myr > 0
      ? `${formatMyr(summary.outstanding_myr)} awaiting payment`
      : summary.invoice_count === 0
        ? "Send your first invoice"
        : "All caught up on payments";

  const subcopy =
    summary.overdue_count > 0
      ? `${summary.overdue_count} overdue — chase them on WhatsApp.`
      : summary.draft_count > 0
        ? `${summary.draft_count} draft${summary.draft_count === 1 ? "" : "s"} ready to send.`
        : "Share a link; customers pay via DuitNow on the invoice page.";

  return {
    headline,
    subcopy,
    variant: summary.overdue_count > 0 ? "attention" : "calm",
  };
}

export function expensesSubpageHero(opts: {
  monthExpenseMyr: number;
  expenseCount: number;
  monthLabel: string;
  topCategory: ExpenseCategoryInsight | null;
}): { headline: string; subcopy: string; variant: LegacyModuleHeroVariant } {
  const headline =
    opts.expenseCount === 0
      ? "No spends logged this month"
      : `${formatMyr(opts.monthExpenseMyr)} out this month`;

  const subcopy =
    opts.expenseCount === 0
      ? "Log petrol, lunch, rent — keep your P&L honest."
      : `${opts.expenseCount} expense${opts.expenseCount === 1 ? "" : "s"} in ${opts.monthLabel}${
          opts.topCategory
            ? ` · top: ${opts.topCategory.category.replace(/_/g, " ")}`
            : ""
        }`;

  return { headline, subcopy, variant: "calm" };
}

export function incomeSubpageHero(opts: {
  monthIncomeMyr: number;
  incomeCount: number;
  monthLabel: string;
}): { headline: string; subcopy: string; variant: LegacyModuleHeroVariant } {
  const headline =
    opts.incomeCount === 0
      ? "No income logged this month"
      : `${formatMyr(opts.monthIncomeMyr)} in this month`;

  const subcopy =
    opts.incomeCount === 0
      ? "Log cash sales, transfers, and other inflows beside invoices."
      : `${opts.incomeCount} entr${opts.incomeCount === 1 ? "y" : "ies"} in ${opts.monthLabel}`;

  return { headline, subcopy, variant: "calm" };
}

export function customersSubpageHero(
  summary: FinanceCustomersSummary,
): { headline: string; subcopy: string; variant: LegacyModuleHeroVariant } {
  const headline =
    summary.total === 0
      ? "Add your first customer"
      : `${summary.total} customer${summary.total === 1 ? "" : "s"} on file`;

  const subcopy =
    summary.total === 0
      ? "Reuse names on invoices and quotes — no retyping."
      : summary.outstanding_myr > 0
        ? `${formatMyr(summary.outstanding_myr)} outstanding across ${summary.active_billers} active biller${summary.active_billers === 1 ? "" : "s"}`
        : `${summary.with_contact} with phone or email on file`;

  return {
    headline,
    subcopy,
    variant: summary.outstanding_myr > 0 ? "attention" : "calm",
  };
}

export function reportsSubpageHero(
  analytics: FinanceAnalyticsSummary,
): { headline: string; subcopy: string; variant: LegacyModuleHeroVariant } {
  const isProfit = analytics.net_myr >= 0;
  const headline = isProfit
    ? `${formatMyr(analytics.net_myr)} net for the period`
    : `${formatMyr(Math.abs(analytics.net_myr))} net outflow`;

  const subcopy = `${analytics.txn_count} transaction${analytics.txn_count === 1 ? "" : "s"} · ledger, P&L, and analytics in one place.`;

  return {
    headline,
    subcopy,
    variant: !isProfit && analytics.total_expense_myr > 0 ? "attention" : "calm",
  };
}
