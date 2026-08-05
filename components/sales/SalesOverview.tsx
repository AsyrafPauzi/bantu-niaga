import Link from "next/link";
import {
  Banknote,
  Bot,
  Clock,
  CreditCard,
  Plus,
  ShoppingCart,
  Smartphone,
  Users,
} from "lucide-react";
import { AdminCatalogEmpty } from "@/components/admin/AdminCatalogUi";
import {
  AdminOverviewPanel,
  AdminOverviewRow,
} from "@/components/admin/AdminOverviewPanel";
import {
  ModuleAttentionPills,
  ModuleDashboardHero,
  ModuleDashboardShell,
  ModuleHeroStat,
  ModuleQuickActions,
} from "@/components/dashboard/module-layout";
import { SalesBackLink } from "@/components/sales/SalesBackLink";
import { SalesMobileFab } from "@/components/sales/SalesMobileFab";
import { formatMyr } from "@/lib/marketing/metrics";
import type { SalesDashboardData } from "@/lib/sales/dashboard";
import { cn } from "@/lib/utils/cn";
import { fmtRelTime } from "@/lib/utils/relative-time";
import { pillarClasses } from "@/lib/pillars/theme";

const salesTheme = pillarClasses.sales;

function fmtTodayLabel(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

function fmtSaleWhen(iso: string, todayYmd: string): string {
  const d = new Date(iso);
  const saleDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(d);
  const time = d.toLocaleTimeString("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });
  if (saleDay === todayYmd) return `Today · ${time}`;
  return d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

function payLabel(method: string): string {
  if (method === "cash") return "Cash";
  if (method === "duitnow_qr_static") return "DuitNow QR";
  return method;
}

interface SalesOverviewProps {
  data: SalesDashboardData;
  showPos: boolean;
  showLeads: boolean;
  showAssistant?: boolean;
  showHistory?: boolean;
}

export function SalesOverview({
  data,
  showPos,
  showLeads,
  showAssistant = false,
  showHistory = false,
}: SalesOverviewProps) {
  const { summary, leads, recentSales, todayYmd, week, topProducts, cashiers, notifications } =
    data;
  const hasSalesToday = summary.txnToday > 0;
  const weekDelta =
    week.priorSalesMyr > 0
      ? Math.round(
          ((week.salesMyr - week.priorSalesMyr) / week.priorSalesMyr) * 100,
        )
      : null;

  const heroHeadline = !hasSalesToday
    ? "Counter is ready — ring up your first sale"
    : summary.txnToday === 1
      ? "One sale in the bag today"
      : `${summary.txnToday} sales · ${formatMyr(summary.salesTodayMyr)} today`;

  const heroSub = !hasSalesToday
    ? "Cash and static DuitNow from your Operations catalog. Every completed sale posts to Finance automatically."
    : summary.avgTicketMyr > 0
      ? `Average ticket ${formatMyr(summary.avgTicketMyr)} · ${fmtTodayLabel(todayYmd)}${week.txnCount > 0 ? ` · ${formatMyr(week.salesMyr)} this week${weekDelta != null ? ` (${weekDelta >= 0 ? "+" : ""}${weekDelta}% vs prior week)` : ""}` : ""}`
      : fmtTodayLabel(todayYmd);

  const attentionItems = [
    showLeads && leads.overdue > 0
      ? {
          label: `${leads.overdue} overdue follow-up${leads.overdue === 1 ? "" : "s"}`,
          href: "/sales/leads?follow_up=overdue",
          tone: "danger" as const,
        }
      : null,
    showLeads && leads.dueToday > 0
      ? {
          label: `${leads.dueToday} follow-up${leads.dueToday === 1 ? "" : "s"} due today`,
          href: "/sales/leads?follow_up=due_today",
          tone: "warning" as const,
        }
      : null,
    showLeads && leads.open > 0 && leads.overdue === 0 && leads.dueToday === 0
      ? {
          label: `${leads.open} open lead${leads.open === 1 ? "" : "s"} in pipeline`,
          href: "/sales/leads",
          tone: "neutral" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    href: string;
    tone: "danger" | "warning" | "neutral";
  }>;

  const quickActions = [
    showPos
      ? {
          href: "/sales/pos",
          icon: ShoppingCart,
          title: "POS counter",
          subtitle: "Ring up a sale",
        }
      : null,
    showLeads
      ? {
          href: "/sales/leads",
          icon: Users,
          title: "Leads",
          subtitle: "Pipeline & follow-ups",
        }
      : null,
    showAssistant
      ? {
          href: "/sales/assistant",
          icon: Bot,
          title: "Ask Sufi",
          subtitle: "Sales copilot",
        }
      : null,
    showHistory
      ? {
          href: "/sales/history",
          icon: CreditCard,
          title: "History",
          subtitle: "Receipts & export",
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    icon: typeof ShoppingCart;
    title: string;
    subtitle: string;
  }>;

  return (
    <ModuleDashboardShell className="pb-20 lg:pb-8">
      <SalesBackLink href="/home" label="Home" />

      <ModuleDashboardHero
        module="Sales"
        pillar="sales"
        headline={heroHeadline}
        subcopy={heroSub}
        cta={
          showPos ? (
            <Link
              href="/sales/pos"
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors",
                salesTheme.btnPrimary,
              )}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              New sale
            </Link>
          ) : null
        }
      >
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Sales today"
            value={formatMyr(summary.salesTodayMyr)}
            hint={hasSalesToday ? `${summary.txnToday} ticket${summary.txnToday === 1 ? "" : "s"}` : "No tickets yet"}
            icon={ShoppingCart}
            iconClassName={salesTheme.eyebrow}
          />
          <ModuleHeroStat
            label="Avg ticket"
            value={hasSalesToday ? formatMyr(summary.avgTicketMyr) : "—"}
            hint={hasSalesToday ? "Per transaction" : "Opens after first sale"}
            icon={CreditCard}
            iconClassName={salesTheme.eyebrow}
          />
          <ModuleHeroStat
            label="Cash"
            value={formatMyr(summary.cashTodayMyr)}
            hint={hasSalesToday ? `${summary.cashPct}% of today` : "—"}
            icon={Banknote}
            iconClassName={salesTheme.eyebrow}
          />
          <ModuleHeroStat
            label="DuitNow QR"
            value={formatMyr(summary.duitnowTodayMyr)}
            hint={hasSalesToday ? `${summary.duitnowPct}% of today` : "—"}
            icon={Smartphone}
            iconClassName={salesTheme.eyebrow}
          />
        </div>

        {hasSalesToday ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted dark:text-cream-400">
              <span>Cash</span>
              <span>{summary.cashPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/60 dark:bg-hairline-dark">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${summary.cashPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted dark:text-cream-400">
              <span>DuitNow QR</span>
              <span>{summary.duitnowPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/60 dark:bg-hairline-dark">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${summary.duitnowPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </ModuleDashboardHero>

      {attentionItems.length > 0 ? (
        <ModuleAttentionPills items={attentionItems} />
      ) : null}

      {topProducts.length > 0 ? (
        <AdminOverviewPanel
          title="Top sellers today"
          subtitle="By revenue at the counter"
        >
          <ul>
            {topProducts.map((p) => (
              <li
                key={p.product_name}
                className="flex items-center justify-between gap-3 border-b border-cream-200 px-4 py-3 last:border-0 dark:border-hairline-dark"
              >
                <div>
                  <p className="text-sm font-medium text-ink dark:text-cream-100">
                    {p.product_name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {p.quantity} sold
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatMyr(p.revenue_myr)}
                </span>
              </li>
            ))}
          </ul>
        </AdminOverviewPanel>
      ) : null}

      {cashiers.length > 1 ? (
        <AdminOverviewPanel
          title="Cashiers today"
          subtitle="Sales by staff member"
        >
          <ul>
            {cashiers.map((c) => (
              <li
                key={c.cashier_user_id}
                className="flex items-center justify-between gap-3 border-b border-cream-200 px-4 py-3 last:border-0 dark:border-hairline-dark"
              >
                <p className="text-sm font-medium text-ink dark:text-cream-100">
                  {c.display_name}
                </p>
                <span className="text-sm tabular-nums text-ink-muted">
                  {c.txn_count} · {formatMyr(c.total_myr)}
                </span>
              </li>
            ))}
          </ul>
        </AdminOverviewPanel>
      ) : null}

      <AdminOverviewPanel
        title="Recent receipts"
        subtitle="Today's completed POS sales"
        action={
          showHistory ? (
            <Link
              href="/sales/history"
              className="text-xs font-semibold text-[#2563EB] hover:text-blue-800 dark:text-blue-300"
            >
              View history
            </Link>
          ) : showPos ? (
            <Link
              href="/sales/pos"
              className="text-xs font-semibold text-[#2563EB] hover:text-blue-800 dark:text-blue-300"
            >
              Open POS
            </Link>
          ) : null
        }
      >
        {recentSales.length === 0 ? (
          <div className="p-4 sm:p-5">
            <AdminCatalogEmpty
              icon={ShoppingCart}
              title="No sales yet"
              hint={
                showPos
                  ? "Tap New sale to open the counter and ring up from your product catalog."
                  : "Ask a cashier or manager to complete the first sale."
              }
              action={
                showPos ? (
                  <Link
                    href="/sales/pos"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white",
                      salesTheme.btnPrimary,
                    )}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Open POS
                  </Link>
                ) : undefined
              }
              className={cn("p-4 sm:p-5", salesTheme.sectionPanel)}
            />
          </div>
        ) : (
          <ul>
            {recentSales.map((row) => (
              <li key={row.id}>
                <AdminOverviewRow
                  href={
                    showHistory
                      ? `/sales/receipts/${row.id}`
                      : "/sales/pos"
                  }
                  title={`${row.sale_number} · ${row.customer_name?.trim() || "Walk-in"}`}
                  subtitle={fmtSaleWhen(row.created_at, todayYmd)}
                  badge={
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        row.payment_method === "cash"
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                          : "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
                      )}
                    >
                      {payLabel(row.payment_method)}
                    </span>
                  }
                  trailing={
                    <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      +{formatMyr(row.total_myr)}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </AdminOverviewPanel>

      <AdminOverviewPanel
        title="Activity feed"
        subtitle="Recent sales events for your team"
      >
        <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-muted sm:px-5 dark:text-cream-400">
              Leads, POS sales, and exports will appear here.
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
                    salesTheme.iconBox,
                  )}
                >
                  <Clock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink dark:text-cream-100">{item.message}</p>
                  <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                    {fmtRelTime(item.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminOverviewPanel>

      {quickActions.length > 0 ? (
        <ModuleQuickActions module="Sales" pillar="sales" actions={quickActions} />
      ) : null}

      {showPos ? <SalesMobileFab /> : null}
    </ModuleDashboardShell>
  );
}
