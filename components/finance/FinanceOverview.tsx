import Link from "next/link";
import {
  BarChart3,
  Clock,
  FileText,
  MessageSquare,
  MessageSquareQuote,
  Plus,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  AdminCatalogEmpty,
} from "@/components/admin/AdminCatalogUi";
import {
  AdminOverviewPanel,
  AdminOverviewRow,
} from "@/components/admin/AdminOverviewPanel";
import { AiBanner } from "@/components/dashboard/ai-banner";
import {
  ModuleAttentionPills,
  ModuleDashboardHero,
  ModuleDashboardShell,
  ModuleQuickActions,
} from "@/components/dashboard/module-layout";
import { StatusPill } from "@/components/dashboard/status-pill";
import { AccountantExportButton } from "@/components/finance/AccountantExportButton";
import { FinanceMonthPicker } from "@/components/finance/FinanceMonthPicker";
import type { FinanceDashboardData } from "@/lib/finance/dashboard";
import {
  buildInvoiceShareMessage,
  formatMyr,
  invoiceShareUrl,
  whatsAppShareUrl,
} from "@/lib/finance/schemas";
import { cn } from "@/lib/utils/cn";
import { fmtRelTime } from "@/lib/utils/relative-time";
import { pillarClasses } from "@/lib/pillars/theme";

const financeTheme = pillarClasses.finance;

const QUICK_ACTIONS = [
  {
    href: "/finance/invoices/new",
    icon: Plus,
    title: "New invoice",
    subtitle: "Bill a customer",
  },
  {
    href: "/finance/expenses",
    icon: Receipt,
    title: "Log expense",
    subtitle: "Snap a receipt",
  },
  {
    href: "/finance/income",
    icon: Wallet,
    title: "Log income",
    subtitle: "Capital, loans & sales",
  },
  {
    href: "/finance/invoices?kind=quote",
    icon: MessageSquareQuote,
    title: "Quotes",
    subtitle: "Send before billing",
  },
  {
    href: "/finance/reports",
    icon: BarChart3,
    title: "Reports",
    subtitle: "Ledger, P&L & charts",
  },
  {
    href: "/finance/invoices",
    icon: FileText,
    title: "Invoices",
    subtitle: "Track & share",
  },
  {
    href: "/finance/customers",
    icon: Users,
    title: "Customers",
    subtitle: "Billing contacts",
  },
] as const;

function fmtShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

function malaysiaTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

function invoiceStatusTone(
  status: string,
  dueDate: string | null,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "paid") return "success";
  if (status === "void") return "neutral";
  if (status === "draft") return "neutral";
  if (dueDate && dueDate < malaysiaTodayYmd()) return "danger";
  if (status === "sent") return "warning";
  return "neutral";
}

function invoiceStatusLabel(
  status: string,
  documentKind: string,
  dueDate: string | null,
): string {
  if (documentKind === "quote") {
    return status === "draft" ? "Quote draft" : "Quote sent";
  }
  if (status === "sent" && dueDate) {
    return dueDate < malaysiaTodayYmd() ? "Overdue" : "Awaiting pay";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatPctChange(
  pct: number | null,
  prevLabel: string,
): string | null {
  if (pct === null) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs ${prevLabel}`;
}

function pctTone(pct: number | null, invert = false): string {
  if (pct === null) return "text-ink-muted dark:text-cream-400";
  const positive = invert ? pct < 0 : pct > 0;
  const negative = invert ? pct > 0 : pct < 0;
  if (positive) return "text-status-success";
  if (negative) return "text-status-danger";
  return "text-ink-muted dark:text-cream-400";
}

interface FinanceOverviewProps {
  data: FinanceDashboardData;
  businessName: string;
}

export function FinanceOverview({
  data,
  businessName,
}: FinanceOverviewProps) {
  const {
    month,
    summary,
    comparison,
    monthLabel,
    recentTransactions,
    recentInvoices,
    chaseList,
    expenseCategories,
    posToday,
    counts,
    notifications,
    idcompany,
    appUrl,
  } = data;

  const makingMoney = summary.net_myr >= 0;
  const hasActivity =
    summary.income_myr > 0 ||
    summary.expense_myr > 0 ||
    recentInvoices.length > 0;

  const netChange = formatPctChange(comparison.net_pct, comparison.prev_month_label);

  const heroHeadline = !hasActivity
    ? "Let's get your first ringgit tracked"
    : makingMoney
      ? `You're up ${formatMyr(summary.net_myr)}`
      : `You're down ${formatMyr(Math.abs(summary.net_myr))}`;

  const heroSub = !hasActivity
    ? "Log an expense or send an invoice — Fayza can help you stay on top of cash flow."
    : makingMoney
      ? "More money in than out — nice work keeping the books tidy."
      : "Spending beat income — check expenses or chase unpaid invoices.";

  const incomeBarPct =
    summary.income_myr + summary.expense_myr > 0
      ? Math.round(
          (summary.income_myr / (summary.income_myr + summary.expense_myr)) *
            100,
        )
      : 50;

  const attentionItems = [
    counts.overdueInvoices > 0
      ? {
          label: `${counts.overdueInvoices} overdue invoice${counts.overdueInvoices === 1 ? "" : "s"}`,
          href: "/finance/invoices?status=sent",
          tone: "danger" as const,
        }
      : null,
    counts.sentInvoices > 0
      ? {
          label: `${formatMyr(summary.invoice_outstanding_myr)} awaiting payment`,
          href: "/finance/invoices?status=sent",
          tone: "warning" as const,
        }
      : null,
    counts.draftInvoices > 0
      ? {
          label: `${counts.draftInvoices} draft invoice${counts.draftInvoices === 1 ? "" : "s"} to send`,
          href: "/finance/invoices?status=draft",
          tone: "neutral" as const,
        }
      : null,
    counts.openQuotes > 0
      ? {
          label: `${counts.openQuotes} open quote${counts.openQuotes === 1 ? "" : "s"}`,
          href: "/finance/invoices?kind=quote",
          tone: "neutral" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    href: string;
    tone: "danger" | "warning" | "neutral";
  }>;

  return (
    <ModuleDashboardShell className="pb-20 lg:pb-8">
      <ModuleDashboardHero
        module="Finance"
        pillar="finance"
        headline={heroHeadline}
        subcopy={heroSub}
        headerExtra={
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <FinanceMonthPicker value={month} />
            {netChange ? (
              <span className={cn("text-xs font-semibold", pctTone(comparison.net_pct))}>
                {netChange}
              </span>
            ) : null}
          </div>
        }
        cta={
          <Link
            href="/finance/invoices/new"
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors",
              financeTheme.btnPrimary,
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New invoice
          </Link>
        }
      >
        <p className="mt-1 text-xs font-medium text-ink-muted dark:text-cream-400">
          {monthLabel}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/60 bg-white/70 p-4 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-status-success">
              <TrendingUp className="h-3.5 w-3.5" />
              Money in
            </p>
            <p className="mt-1 text-xl font-bold text-ink dark:text-cream-100">
              {formatMyr(summary.income_myr)}
            </p>
            {formatPctChange(comparison.income_pct, comparison.prev_month_label) ? (
              <p className={cn("mt-1 text-[11px] font-medium", pctTone(comparison.income_pct))}>
                {formatPctChange(comparison.income_pct, comparison.prev_month_label)}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-4 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-status-danger">
              <TrendingDown className="h-3.5 w-3.5" />
              Money out
            </p>
            <p className="mt-1 text-xl font-bold text-ink dark:text-cream-100">
              {formatMyr(summary.expense_myr)}
            </p>
            {formatPctChange(comparison.expense_pct, comparison.prev_month_label) ? (
              <p
                className={cn(
                  "mt-1 text-[11px] font-medium",
                  pctTone(comparison.expense_pct, true),
                )}
              >
                {formatPctChange(comparison.expense_pct, comparison.prev_month_label)}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-4 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">
              <Wallet className="h-3.5 w-3.5" />
              You keep
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-bold",
                makingMoney ? "text-status-success" : "text-status-danger",
              )}
            >
              {formatMyr(summary.net_myr)}
            </p>
          </div>
          <Link
            href="/sales"
            className="rounded-xl border border-white/60 bg-white/70 p-4 backdrop-blur-sm transition-colors hover:border-brand-200 dark:border-hairline-dark dark:bg-panel-dark/80 dark:hover:border-brand-700"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">
              <ShoppingCart className="h-3.5 w-3.5" />
              POS today
            </p>
            <p className="mt-1 text-xl font-bold text-ink dark:text-cream-100">
              {formatMyr(posToday.sales_total_myr)}
            </p>
            <p className="mt-1 text-[11px] text-ink-muted dark:text-cream-400">
              {posToday.sales_count === 0
                ? "No counter sales yet"
                : `${posToday.sales_count} sale${posToday.sales_count === 1 ? "" : "s"} · posts to ledger`}
            </p>
          </Link>
        </div>

        {hasActivity ? (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] font-medium text-ink-muted dark:text-cream-400">
              <span>Income</span>
              <span>Expenses</span>
            </div>
            <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
              <div
                className="bg-status-success transition-all"
                style={{ width: `${incomeBarPct}%` }}
              />
              <div
                className="bg-status-danger transition-all"
                style={{ width: `${100 - incomeBarPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </ModuleDashboardHero>

      <ModuleAttentionPills items={attentionItems} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {chaseList.length > 0 ? (
          <AdminOverviewPanel
            title="Who owes you"
            subtitle={`${formatMyr(summary.invoice_outstanding_myr)} outstanding`}
            className="lg:col-span-2"
            action={
              <Link
                href="/finance/invoices?status=sent"
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                All unpaid
              </Link>
            }
          >
            <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {chaseList.map((inv) => {
                const shareUrl =
                  idcompany && appUrl
                    ? invoiceShareUrl(appUrl, idcompany, inv.share_hash)
                    : "";
                const waMessage = shareUrl
                  ? buildInvoiceShareMessage(
                      businessName,
                      inv.number,
                      inv.total_myr,
                      shareUrl,
                    )
                  : `Hi ${inv.customer_name}, friendly reminder for invoice ${inv.number} (${formatMyr(inv.total_myr)}).`;
                const waHref = inv.customer_phone
                  ? `https://wa.me/${inv.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(waMessage)}`
                  : whatsAppShareUrl(waMessage);

                return (
                  <div
                    key={inv.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5",
                      inv.is_overdue && "bg-rose-50/30 dark:bg-rose-950/10",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink dark:text-cream-100">
                        {inv.customer_name}
                      </p>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {inv.number}
                        {inv.due_date
                          ? ` · due ${fmtShortDate(inv.due_date)}`
                          : " · no due date"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
                        {formatMyr(inv.total_myr)}
                      </p>
                      {inv.is_overdue ? (
                        <StatusPill tone="danger">Overdue</StatusPill>
                      ) : (
                        <StatusPill tone="warning">Sent</StatusPill>
                      )}
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                      <Link
                        href={`/finance/invoices/${inv.id}/edit`}
                        className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminOverviewPanel>
        ) : null}

        {expenseCategories.length > 0 ? (
          <AdminOverviewPanel
            title="Expense breakdown"
            subtitle={`Top categories · ${monthLabel}`}
            action={
              <Link
                href="/finance/expenses"
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                Log expense
              </Link>
            }
          >
            <div className="space-y-3 px-4 py-3 sm:px-5">
              {expenseCategories.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="capitalize text-ink dark:text-cream-100">
                      {cat.category}
                    </span>
                    <span className="font-semibold tabular-nums text-ink dark:text-cream-100">
                      {formatMyr(cat.amount_myr)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
                    <div
                      className="h-full rounded-full bg-status-danger/80"
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AdminOverviewPanel>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <AdminOverviewPanel
          title="Recent cash flow"
          subtitle="Latest money in & out"
          action={
            <Link
              href="/finance/reports"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              View reports
            </Link>
          }
        >
          <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {recentTransactions.length === 0 ? (
              <div className="px-4 py-6 sm:px-5">
                <AdminCatalogEmpty
                  icon={Receipt}
                  title="No entries yet"
                  hint="Log expenses and income to build your cash-flow picture."
                  className="border-none bg-transparent py-8 dark:bg-transparent"
                  action={
                    <Link
                      href="/finance/expenses"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                    >
                      <Plus className="h-4 w-4" />
                      Log expense
                    </Link>
                  }
                />
              </div>
            ) : (
              recentTransactions.map((row) => (
                <AdminOverviewRow
                  key={row.id}
                  href={
                    row.kind === "income"
                      ? "/finance/income"
                      : "/finance/expenses"
                  }
                  title={row.description}
                  subtitle={
                    row.counterparty
                      ? `${fmtShortDate(row.txn_date)} · ${row.counterparty}`
                      : fmtShortDate(row.txn_date)
                  }
                  badge={
                    <StatusPill
                      tone={row.kind === "income" ? "success" : "danger"}
                    >
                      {row.kind === "income" ? "In" : "Out"}
                    </StatusPill>
                  }
                  trailing={
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        row.kind === "income"
                          ? "text-status-success"
                          : "text-status-danger",
                      )}
                    >
                      {(row.kind === "income" ? "+" : "−") +
                        formatMyr(row.amount_myr)}
                    </span>
                  }
                />
              ))
            )}
          </div>
        </AdminOverviewPanel>

        <AdminOverviewPanel
          title="Invoices & quotes"
          subtitle={`${counts.customers} billing customer${counts.customers === 1 ? "" : "s"}`}
          action={
            <Link
              href="/finance/invoices"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              View all
            </Link>
          }
        >
          <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {recentInvoices.length === 0 ? (
              <div className="px-4 py-6 sm:px-5">
                <AdminCatalogEmpty
                  icon={FileText}
                  title="No invoices or quotes yet"
                  hint="Send your first bill — customers get a share link with optional DuitNow."
                  className="border-none bg-transparent py-8 dark:bg-transparent"
                  action={
                    <Link
                      href="/finance/invoices/new"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                    >
                      <Plus className="h-4 w-4" />
                      New invoice
                    </Link>
                  }
                />
              </div>
            ) : (
              recentInvoices.map((inv) => (
                <AdminOverviewRow
                  key={inv.id}
                  href={`/finance/invoices/${inv.id}/edit`}
                  title={inv.customer_name}
                  subtitle={`${inv.number} · ${fmtShortDate(inv.invoice_date)}`}
                  badge={
                    <StatusPill
                      tone={invoiceStatusTone(inv.status, inv.due_date)}
                    >
                      {invoiceStatusLabel(
                        inv.status,
                        inv.document_kind,
                        inv.due_date,
                      )}
                    </StatusPill>
                  }
                  trailing={
                    <span className="text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
                      {formatMyr(inv.total_myr)}
                    </span>
                  }
                  overdue={
                    inv.status === "sent" &&
                    !!inv.due_date &&
                    inv.due_date < malaysiaTodayYmd()
                  }
                />
              ))
            )}
          </div>
        </AdminOverviewPanel>
      </div>

      <AdminOverviewPanel
        title="Activity feed"
        subtitle="Recent finance events for your team"
      >
        <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-muted sm:px-5 dark:text-cream-400">
              Expenses, invoices, exports, and payments will appear here.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-4 py-3 sm:px-5"
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    financeTheme.iconBox,
                  )}
                >
                  <Clock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink dark:text-cream-100">
                    {item.message}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                    {fmtRelTime(item.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminOverviewPanel>

      <ModuleQuickActions
        module="Finance"
        pillar="finance"
        actions={QUICK_ACTIONS}
        footer={<AccountantExportButton defaultMonth={month} compact />}
      />

      <AiBanner
        label="Finance AI · Fayza"
        message={
          counts.overdueInvoices > 0
            ? `You have ${counts.overdueInvoices} overdue invoice${counts.overdueInvoices === 1 ? "" : "s"}. Ask Fayza for a chase plan or month-end checklist.`
            : "Ask Fayza to check cash flow, create invoices, log expenses, or chase unpaid bills."
        }
        cta="Chat with Fayza"
        href="/finance?fayza=open"
      />
    </ModuleDashboardShell>
  );
}
