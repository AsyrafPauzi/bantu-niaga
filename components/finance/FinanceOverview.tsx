import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  CircleDot,
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
import {
  ModuleAttentionPills,
  ModuleDashboardShell,
  ModuleQuickActions,
} from "@/components/dashboard/module-layout";
import { StatusPill } from "@/components/dashboard/status-pill";
import { AccountantExportButton } from "@/components/finance/AccountantExportButton";
import { FinanceMonthPicker } from "@/components/finance/FinanceMonthPicker";
import { FinanceNewInvoiceButton } from "@/components/finance/FinanceNewInvoiceButton";
import type { FinanceDashboardData } from "@/lib/finance/dashboard";
import {
  buildInvoiceShareMessage,
  formatMyr,
  invoiceShareUrl,
  whatsAppShareUrl,
} from "@/lib/finance/schemas";
import { cn } from "@/lib/utils/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { fmtRelTime } from "@/lib/utils/relative-time";
import { pillarClasses } from "@/lib/pillars/theme";

const financeTheme = pillarClasses.finance;

const QUICK_ACTIONS = [
  {
    href: "/finance/invoices/new",
    icon: <Plus />,
    title: "New invoice",
    subtitle: "Bill a customer",
  },
  {
    href: "/finance/expenses",
    icon: <Receipt />,
    title: "Log expense",
    subtitle: "Snap a receipt",
  },
  {
    href: "/finance/income",
    icon: <Wallet />,
    title: "Log income",
    subtitle: "Capital, loans & sales",
  },
  {
    href: "/finance/invoices?kind=quote",
    icon: <MessageSquareQuote />,
    title: "Quotes",
    subtitle: "Send before billing",
  },
  {
    href: "/finance/reports",
    icon: <BarChart3 />,
    title: "Reports",
    subtitle: "Ledger, P&L & charts",
  },
  {
    href: "/finance/invoices",
    icon: <FileText />,
    title: "Invoices",
    subtitle: "Track & share",
  },
  {
    href: "/finance/customers",
    icon: <Users />,
    title: "Customers",
    subtitle: "Billing contacts",
  },
] as const;

/* ── Shortcut row shown right below the hero on mobile ───────── */
const MOBILE_SHORTCUTS = [
  { href: "/finance/invoices/new",  Icon: Plus,          label: "Invoice",  color: "bg-brand-500" },
  { href: "/finance/expenses",      Icon: Receipt,       label: "Expense",  color: "bg-rose-500" },
  { href: "/finance/income",        Icon: Wallet,        label: "Income",   color: "bg-emerald-500" },
  { href: "/finance/invoices",      Icon: FileText,      label: "Invoices", color: "bg-violet-500" },
  { href: "/finance/reports",       Icon: BarChart3,     label: "Reports",  color: "bg-amber-500" },
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
    return dueDate < malaysiaTodayYmd() ? "Overdue" : "Awaiting";
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
  expensesAllowed?: boolean;
}

export function FinanceOverview({
  data,
  businessName,
  expensesAllowed = true,
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
          label: `${counts.overdueInvoices} overdue`,
          href: "/finance/invoices?status=sent",
          tone: "danger" as const,
        }
      : null,
    counts.sentInvoices > 0
      ? {
          label: `${formatMyr(summary.invoice_outstanding_myr)} awaiting`,
          href: "/finance/invoices?status=sent",
          tone: "warning" as const,
        }
      : null,
    counts.draftInvoices > 0
      ? {
          label: `${counts.draftInvoices} draft${counts.draftInvoices === 1 ? "" : "s"}`,
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

  const quickActions = expensesAllowed
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter((a) => a.href !== "/finance/expenses");

  const mobileShortcuts = expensesAllowed
    ? MOBILE_SHORTCUTS
    : MOBILE_SHORTCUTS.filter((s) => s.href !== "/finance/expenses");

  return (
    <ModuleDashboardShell className="pb-20 md:pb-8">

      {/* ═══════════════════════════════════════════════════════
          HERO CARD — Net balance + 4 KPIs
      ══════════════════════════════════════════════════════════ */}
      <section className={cn(
        "relative overflow-hidden rounded-2xl border p-4 shadow-sm md:p-5",
        financeTheme.heroBorder, financeTheme.heroBg,
      )}>
        {/* Decorative blob */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/20 blur-2xl" />

        {/* Month picker row */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <FinanceMonthPicker value={month} />
            {netChange ? (
              <span className={cn("text-xs font-semibold", pctTone(comparison.net_pct))}>
                {netChange}
              </span>
            ) : null}
          </div>
          <FinanceNewInvoiceButton />
        </div>

        {/* Net headline */}
        <div className="mb-4">
          <p className={cn(
            "text-[10px] font-semibold uppercase tracking-widest",
            financeTheme.eyebrow,
          )}>
            Finance · {monthLabel}
          </p>
          <p className={cn(
            "mt-1 text-3xl font-bold tracking-tight tabular-nums md:text-4xl",
            makingMoney ? "text-status-success" : "text-status-danger",
          )}>
            {formatMyr(summary.net_myr)}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
            {!hasActivity
              ? "Start by logging a transaction or sending an invoice"
              : makingMoney
                ? "More money in than out — great work"
                : "Expenses exceeded income this period"}
          </p>
        </div>

        {/* 4 KPI tiles — 2×2 on mobile, 4×1 on md+ */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {/* Money In */}
          <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-status-success">
              <TrendingUp className="h-3 w-3" />
              In
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {formatMyr(summary.income_myr)}
            </p>
            {comparison.income_pct !== null ? (
              <p className={cn("mt-0.5 text-[10px] font-medium", pctTone(comparison.income_pct))}>
                {formatPctChange(comparison.income_pct, comparison.prev_month_label)}
              </p>
            ) : null}
          </div>

          {/* Money Out */}
          <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-status-danger">
              <TrendingDown className="h-3 w-3" />
              Out
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {formatMyr(summary.expense_myr)}
            </p>
            {comparison.expense_pct !== null ? (
              <p className={cn("mt-0.5 text-[10px] font-medium", pctTone(comparison.expense_pct, true))}>
                {formatPctChange(comparison.expense_pct, comparison.prev_month_label)}
              </p>
            ) : null}
          </div>

          {/* POS Today */}
          <Link
            href="/sales"
            className="rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 backdrop-blur-sm transition-colors hover:border-brand-200 dark:border-hairline-dark dark:bg-panel-dark/80 dark:hover:border-brand-700"
          >
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">
              <ShoppingCart className="h-3 w-3" />
              POS today
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {formatMyr(posToday.sales_total_myr)}
            </p>
            <p className="mt-0.5 text-[10px] text-ink-muted dark:text-cream-400">
              {posToday.sales_count === 0
                ? "No sales yet"
                : `${posToday.sales_count} sale${posToday.sales_count === 1 ? "" : "s"}`}
            </p>
          </Link>

          {/* Invoices outstanding */}
          <Link
            href="/finance/invoices?status=sent"
            className="rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 backdrop-blur-sm transition-colors hover:border-brand-200 dark:border-hairline-dark dark:bg-panel-dark/80 dark:hover:border-brand-700"
          >
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <Wallet className="h-3 w-3" />
              Unpaid
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {formatMyr(summary.invoice_outstanding_myr)}
            </p>
            <p className="mt-0.5 text-[10px] text-ink-muted dark:text-cream-400">
              {counts.sentInvoices === 0
                ? "All cleared"
                : `${counts.sentInvoices} invoice${counts.sentInvoices === 1 ? "" : "s"}`}
            </p>
          </Link>
        </div>

        {/* Income vs Expense bar */}
        {hasActivity ? (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] font-medium text-ink-muted dark:text-cream-400">
              <span>Income {incomeBarPct}%</span>
              <span>Expenses {100 - incomeBarPct}%</span>
            </div>
            <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-white/40 dark:bg-hairline-dark">
              <div className="bg-status-success/80 transition-all" style={{ width: `${incomeBarPct}%` }} />
              <div className="bg-status-danger/80 transition-all" style={{ width: `${100 - incomeBarPct}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      {/* ═══════════════════════════════════════════════════════
          ATTENTION PILLS
      ══════════════════════════════════════════════════════════ */}
      <ModuleAttentionPills items={attentionItems} />

      {/* ═══════════════════════════════════════════════════════
          QUICK-ACTION SHORTCUT ROW (mobile-first icon rail)
      ══════════════════════════════════════════════════════════ */}
      <div className="-mx-1 flex gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
        {mobileShortcuts.map(({ href, Icon, label, color }) => (
          <Link
            key={href}
            href={href}
            className="flex min-w-[60px] flex-none flex-col items-center gap-1.5"
          >
            <span className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm transition-transform active:scale-95",
              color,
            )}>
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-center text-[11px] font-medium leading-tight text-ink-muted dark:text-cream-400">
              {label}
            </span>
          </Link>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          WHO OWES YOU — chase list (highest priority on mobile)
      ══════════════════════════════════════════════════════════ */}
      {chaseList.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm dark:border-hairline-dark dark:bg-panel-dark">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">Who owes you</h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {formatMyr(summary.invoice_outstanding_myr)} outstanding
              </p>
            </div>
            <Link
              href="/finance/invoices?status=sent"
              className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              All unpaid <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Chase rows — touch-friendly */}
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {chaseList.map((inv) => {
              const shareUrl =
                idcompany && appUrl
                  ? invoiceShareUrl(appUrl, idcompany, inv.share_hash)
                  : "";
              const waMessage = shareUrl
                ? buildInvoiceShareMessage(businessName, inv.number, inv.total_myr, shareUrl)
                : `Hi ${inv.customer_name}, friendly reminder for invoice ${inv.number} (${formatMyr(inv.total_myr)}).`;
              const waHref = inv.customer_phone
                ? `https://wa.me/${inv.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(waMessage)}`
                : whatsAppShareUrl(waMessage);

              return (
                <li
                  key={inv.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    inv.is_overdue && "bg-rose-50/40 dark:bg-rose-950/10",
                  )}
                >
                  {/* Status icon */}
                  {inv.is_overdue ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-status-danger" />
                  ) : (
                    <CircleDot className="h-4 w-4 shrink-0 text-status-warning" />
                  )}

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                      {inv.customer_name}
                    </p>
                    <p className="text-xs text-ink-muted dark:text-cream-400">
                      {inv.number}
                      {inv.due_date ? ` · due ${fmtShortDate(inv.due_date)}` : ""}
                    </p>
                  </div>

                  {/* Amount */}
                  <p className="shrink-0 text-sm font-bold tabular-nums text-ink dark:text-cream-100">
                    {formatMyr(inv.total_myr)}
                  </p>

                  {/* WhatsApp CTA */}
                  <Tooltip content="Chase on WhatsApp" side="top">
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Chase ${inv.customer_name} on WhatsApp`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 active:scale-95 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </a>
                  </Tooltip>

                  {/* Open invoice */}
                  <Tooltip content="Open invoice" side="top">
                    <Link
                      href={`/finance/invoices/${inv.id}/edit`}
                      aria-label="Open invoice"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cream-300 bg-white text-ink-muted transition-colors hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          RECENT CASH FLOW + INVOICES — side by side on tablet+
      ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {/* Recent cash flow */}
        <AdminOverviewPanel
          title="Recent cash flow"
          subtitle="Latest money in & out"
          action={
            <Link
              href="/finance/reports"
              className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              Reports <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {recentTransactions.length === 0 ? (
              <div className="px-4 py-6">
                <AdminCatalogEmpty
                  icon={<Receipt />}
                  title="No entries yet"
                  hint={
                    expensesAllowed
                      ? "Log expenses and income to build your cash-flow picture."
                      : "Upgrade to Basic to track expenses."
                  }
                  className="border-none bg-transparent py-6 dark:bg-transparent"
                  action={
                    expensesAllowed ? (
                      <Link
                        href="/finance/expenses"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                      >
                        <Plus className="h-4 w-4" />
                        Log expense
                      </Link>
                    ) : (
                      <Link
                        href="/settings/subscription"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                      >
                        Upgrade plan
                      </Link>
                    )
                  }
                />
              </div>
            ) : (
              recentTransactions.map((row) => (
                <AdminOverviewRow
                  key={row.id}
                  href={row.kind === "income" ? "/finance/income" : "/finance/expenses"}
                  title={row.description}
                  subtitle={
                    row.counterparty
                      ? `${fmtShortDate(row.txn_date)} · ${row.counterparty}`
                      : fmtShortDate(row.txn_date)
                  }
                  badge={
                    <StatusPill tone={row.kind === "income" ? "success" : "danger"}>
                      {row.kind === "income" ? "In" : "Out"}
                    </StatusPill>
                  }
                  trailing={
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      row.kind === "income" ? "text-status-success" : "text-status-danger",
                    )}>
                      {(row.kind === "income" ? "+" : "−") + formatMyr(row.amount_myr)}
                    </span>
                  }
                />
              ))
            )}
          </div>
        </AdminOverviewPanel>

        {/* Invoices & quotes */}
        <AdminOverviewPanel
          title="Invoices & quotes"
          subtitle={`${counts.customers} billing customer${counts.customers === 1 ? "" : "s"}`}
          action={
            <Link
              href="/finance/invoices"
              className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {recentInvoices.length === 0 ? (
              <div className="px-4 py-6">
                <AdminCatalogEmpty
                  icon={<FileText />}
                  title="No invoices yet"
                  hint="Send your first bill — customers get a share link with optional DuitNow."
                  className="border-none bg-transparent py-6 dark:bg-transparent"
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
                    <StatusPill tone={invoiceStatusTone(inv.status, inv.due_date)}>
                      {invoiceStatusLabel(inv.status, inv.document_kind, inv.due_date)}
                    </StatusPill>
                  }
                  trailing={
                    <span className="text-sm font-bold tabular-nums text-ink dark:text-cream-100">
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

      {/* ═══════════════════════════════════════════════════════
          EXPENSE BREAKDOWN — only if data exists
      ══════════════════════════════════════════════════════════ */}
      {expenseCategories.length > 0 ? (
        <AdminOverviewPanel
          title="Expense breakdown"
          subtitle={`Top categories · ${monthLabel}`}
          action={
            expensesAllowed ? (
              <Link
                href="/finance/expenses"
                className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                Log expense <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                href="/settings/subscription"
                className="text-xs font-semibold text-brand-700 dark:text-brand-200"
              >
                Upgrade
              </Link>
            )
          }
        >
          <div className="space-y-3 px-4 py-3 md:px-5">
            {expenseCategories.map((cat, i) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 capitalize text-ink dark:text-cream-100">
                    {i === 0 && <TrendingDown className="h-3.5 w-3.5 shrink-0 text-status-danger" />}
                    {cat.category}
                  </span>
                  <span className="font-semibold tabular-nums text-ink dark:text-cream-100">
                    {formatMyr(cat.amount_myr)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
                  <div
                    className="h-full rounded-full bg-status-danger/80 transition-all"
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </AdminOverviewPanel>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          ACTIVITY FEED — compact, max 5 items
      ══════════════════════════════════════════════════════════ */}
      {notifications.length > 0 ? (
        <AdminOverviewPanel
          title="Activity"
          subtitle="Recent finance events"
        >
          <div className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {notifications.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-2.5 md:px-5">
                <span className={cn(
                  "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                  financeTheme.iconBox,
                )}>
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink dark:text-cream-100">{item.message}</p>
                  <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                    {fmtRelTime(item.created_at)}
                  </p>
                </div>
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-status-success" />
              </div>
            ))}
          </div>
        </AdminOverviewPanel>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          EVERYTHING IN FINANCE — quick-action grid
      ══════════════════════════════════════════════════════════ */}
      <ModuleQuickActions
        module="Finance"
        pillar="finance"
        actions={quickActions}
        footer={<AccountantExportButton defaultMonth={month} compact />}
      />
    </ModuleDashboardShell>
  );
}
