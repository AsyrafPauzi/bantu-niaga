import Link from "next/link";
import {
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Package,
  Plus,
  ShoppingBag,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import {
  ModuleAttentionPills,
  ModuleDashboardHero,
  ModuleDashboardShell,
  ModuleQuickActions,
} from "@/components/dashboard/module-layout";
import type { OperationsDashboardData } from "@/lib/operations/dashboard";
import type {
  OperationsSurface,
  OperationsVerticalProfile,
} from "@/lib/operations/vertical";
import {
  bookingStatusLabel,
  formatBookingWhen,
  formatOrderAmount,
  orderStatusLabel,
  type OperationsOrderStatus,
} from "@/lib/operations/schemas";
import { cn } from "@/lib/utils/cn";

const QUICK_ACTION_DEFS: Record<
  OperationsSurface,
  {
    href: string;
    icon: typeof Package;
    title: string;
    subtitle: string;
    accent: string;
  }
> = {
  orders: {
    href: "/operations/orders",
    icon: Package,
    title: "Orders",
    subtitle: "To do → Done board",
    accent: "from-sky-500 to-blue-600",
  },
  bookings: {
    href: "/operations/bookings",
    icon: Calendar,
    title: "Bookings",
    subtitle: "Appointments & slots",
    accent: "from-violet-500 to-purple-600",
  },
  products: {
    href: "/operations/products",
    icon: ShoppingBag,
    title: "Products",
    subtitle: "Catalog & stock",
    accent: "from-emerald-500 to-teal-600",
  },
  services: {
    href: "/operations/services",
    icon: Wrench,
    title: "Services",
    subtitle: "Catalogue & pricing",
    accent: "from-rose-500 to-pink-600",
  },
  suppliers: {
    href: "/operations/suppliers",
    icon: Truck,
    title: "Suppliers",
    subtitle: "Vendor contacts",
    accent: "from-amber-500 to-orange-500",
  },
  assistant: {
    href: "/operations/assistant",
    icon: Bot,
    title: "Aiman AI",
    subtitle: "Ops copilot",
    accent: "from-indigo-500 to-fuchsia-600",
  },
};

function buildQuickActions(profile: OperationsVerticalProfile) {
  return profile.primarySurfaces.map((surface) => QUICK_ACTION_DEFS[surface]);
}

const ORDER_STATUS_CLASS: Record<OperationsOrderStatus, string> = {
  todo: "border-slate-200 bg-slate-50 text-slate-700 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-300",
  in_progress:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  ready:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  done: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
};

function malaysiaTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

function isOrderOverdue(dueDate: string | null, status: OperationsOrderStatus): boolean {
  if (!dueDate || status === "done") return false;
  return dueDate < malaysiaTodayYmd();
}

interface OperationsOverviewProps {
  data: OperationsDashboardData;
  profile: OperationsVerticalProfile;
}

export function OperationsOverview({ data, profile }: OperationsOverviewProps) {
  const {
    summary,
    recentOrders,
    upcomingBookings,
    todaySchedule,
    lowStockProducts,
    weekStats,
  } = data;

  const pipelineTotal = Math.max(
    summary.todo_count +
      summary.in_progress_count +
      summary.ready_count +
      summary.done_this_month,
    1,
  );

  const hasActivity =
    summary.open_orders > 0 ||
    summary.upcoming_bookings > 0 ||
    summary.done_this_month > 0 ||
    recentOrders.length > 0;

  const needsAttention =
    summary.overdue_count > 0 ||
    (profile.showStockAlerts && summary.low_stock_count > 0);

  const catalogCount = profile.showServices && !profile.showProducts
    ? summary.active_service_count
    : summary.active_product_count;

  const heroHeadline = !hasActivity
    ? profile.showServices && !profile.showProducts
      ? "Set up your service catalogue"
      : "Ready when your first order lands"
    : summary.overdue_count > 0
      ? `${summary.overdue_count} job${summary.overdue_count === 1 ? "" : "s"} need attention`
      : summary.open_orders > 0
        ? `${summary.open_orders} open on the board`
        : profile.showBookings && summary.upcoming_bookings > 0
          ? `${summary.upcoming_bookings} booking${summary.upcoming_bookings === 1 ? "" : "s"} ahead`
          : "You're caught up this week";

  const heroSub = !hasActivity
    ? profile.bundleName
      ? `${profile.modeLabel} — tuned for ${profile.bundleName}.`
      : `${profile.modeLabel} — add your catalogue and log your first job.`
    : summary.overdue_count > 0
      ? "Some orders are past due — nudge customers or move them along the board."
      : profile.showStockAlerts && summary.low_stock_count > 0
        ? `${summary.low_stock_count} product${summary.low_stock_count === 1 ? "" : "s"} running low — check stock before the rush.`
        : `${summary.done_this_month} completed this month. Keep the pipeline moving.`;

  const attentionItems = [
    summary.overdue_count > 0
      ? {
          label: `${summary.overdue_count} overdue order${summary.overdue_count === 1 ? "" : "s"}`,
          href: "/operations/orders",
          tone: "danger" as const,
        }
      : null,
    summary.low_stock_count > 0 && profile.showStockAlerts
      ? {
          label: `${summary.low_stock_count} low-stock SKU${summary.low_stock_count === 1 ? "" : "s"}`,
          href: "/operations/products?low_stock=1",
          tone: "warning" as const,
        }
      : null,
    summary.upcoming_bookings > 0 && profile.showBookings
      ? {
          label: `${summary.upcoming_bookings} upcoming booking${summary.upcoming_bookings === 1 ? "" : "s"}`,
          href: "/operations/bookings",
          tone: "neutral" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    href: string;
    tone: "danger" | "warning" | "neutral";
  }>;

  return (
    <ModuleDashboardShell>
      <ModuleDashboardHero
        module="Operations"
        headline={heroHeadline}
        subcopy={heroSub}
        variant={needsAttention ? "attention" : "calm"}
        cta={
          <Link
            href={profile.primaryCta.href}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {profile.primaryCta.label}
          </Link>
        }
      >
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              <Package className="h-3 w-3" />
              Open
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink dark:text-cream-100">
              {summary.open_orders}
            </p>
            <p className="text-[10px] text-ink-muted dark:text-cream-500">
              {summary.todo_count} to do · {summary.in_progress_count} active
            </p>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              <Calendar className="h-3 w-3" />
              Bookings
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink dark:text-cream-100">
              {profile.showBookings ? summary.upcoming_bookings : "—"}
            </p>
            <p className="text-[10px] text-ink-muted dark:text-cream-500">
              {profile.showBookings
                ? `${summary.resource_count} resource${summary.resource_count === 1 ? "" : "s"}`
                : "Not in your pack"}
            </p>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Done
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink dark:text-cream-100">
              {summary.done_this_month}
            </p>
            <p className="text-[10px] text-ink-muted dark:text-cream-500">
              {weekStats.done_prev_week > 0
                ? `${weekStats.done_this_week} this week · ${weekStats.done_prev_week} prior`
                : "This month"}
            </p>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <ShoppingBag className="h-3 w-3" />
              {profile.catalogStatLabel}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink dark:text-cream-100">
              {catalogCount}
            </p>
            <p className="text-[10px] text-ink-muted dark:text-cream-500">
              {profile.showStockAlerts && summary.low_stock_count > 0
                ? `${summary.low_stock_count} low stock`
                : `${summary.supplier_count} suppliers`}
            </p>
          </div>
        </div>
      </ModuleDashboardHero>

      {todaySchedule.length > 0 && profile.showBookings ? (
        <section className="rounded-2xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Today&apos;s schedule
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Bookings in the next 8 hours
              </p>
            </div>
            <Link
              href="/operations/bookings"
              className="text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              Full calendar
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {todaySchedule.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-violet-200/60 bg-white/80 px-3 py-2 text-sm dark:border-violet-900/50 dark:bg-panel-dark/80"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink dark:text-cream-100">
                    {row.service_title}
                  </p>
                  <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                    {row.customer_name}
                    {row.resource_name ? ` · ${row.resource_name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted dark:text-cream-400">
                  {formatBookingWhen(row.starts_at, row.ends_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ModuleAttentionPills items={attentionItems} />

      <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Order pipeline
            </h2>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Where work sits right now
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/operations/orders"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              Open board
            </Link>
            <a
              href="/api/operations/export"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {[
            {
              label: "To do",
              count: summary.todo_count,
              color: "bg-slate-400",
              pct: Math.round((summary.todo_count / pipelineTotal) * 100),
            },
            {
              label: "In progress",
              count: summary.in_progress_count,
              color: "bg-amber-400",
              pct: Math.round((summary.in_progress_count / pipelineTotal) * 100),
            },
            {
              label: "Ready",
              count: summary.ready_count,
              color: "bg-sky-400",
              pct: Math.round((summary.ready_count / pipelineTotal) * 100),
            },
            {
              label: "Done this month",
              count: summary.done_this_month,
              color: "bg-emerald-500",
              pct: Math.round((summary.done_this_month / pipelineTotal) * 100),
            },
          ].map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-ink dark:text-cream-200">
                  {row.label}
                </span>
                <span className="tabular-nums text-ink-muted dark:text-cream-400">
                  {row.count}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream-100 dark:bg-hairline-dark/60">
                <div
                  className={cn("h-full rounded-full transition-all", row.color)}
                  style={{ width: `${Math.max(row.pct, row.count > 0 ? 8 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Recent orders
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Latest updates on the board
              </p>
            </div>
            <Link
              href="/operations/orders"
              className="text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              All
            </Link>
          </div>
          <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {recentOrders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted dark:text-cream-400 sm:px-5">
                No orders yet.{" "}
                <Link
                  href="/operations/orders"
                  className="font-medium text-brand-600 dark:text-brand-300"
                >
                  Create the first one
                </Link>
                .
              </p>
            ) : (
              recentOrders.map((row) => {
                const overdue = isOrderOverdue(row.due_date, row.status);
                const amount = formatOrderAmount(
                  row.amount_myr != null ? Number(row.amount_myr) : null,
                );
                return (
                  <Link
                    key={row.id}
                    href="/operations/orders"
                    className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-cream-50 dark:hover:bg-panel-dark/60 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                        {row.number} · {row.customer_name}
                      </p>
                      <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                        {row.title}
                        {row.due_date ? (
                          <span className={overdue ? " text-status-danger" : ""}>
                            {" "}
                            · due {row.due_date}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          ORDER_STATUS_CLASS[row.status],
                        )}
                      >
                        {orderStatusLabel(row.status)}
                      </span>
                      {amount ? (
                        <span className="text-xs font-medium tabular-nums text-ink dark:text-cream-100">
                          {amount}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {profile.showBookings ? (
          <section className="rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                  Upcoming bookings
                </h2>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  Held & confirmed slots ahead
                </p>
              </div>
              <Link
                href="/operations/bookings"
                className="text-xs font-semibold text-brand-700 dark:text-brand-200"
              >
                Calendar
              </Link>
            </div>
            <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {upcomingBookings.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-muted dark:text-cream-400 sm:px-5">
                  Nothing scheduled.{" "}
                  <Link
                    href="/operations/bookings"
                    className="font-medium text-brand-600 dark:text-brand-300"
                  >
                    Book a slot
                  </Link>
                  .
                </p>
              ) : (
                upcomingBookings.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                        {row.service_title}
                      </p>
                      <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                        {row.customer_name}
                        {row.resource_name ? ` · ${row.resource_name}` : ""}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted dark:text-cream-500">
                        <Clock className="h-3 w-3 shrink-0" />
                        {formatBookingWhen(row.starts_at, row.ends_at)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
                      {bookingStatusLabel(row.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>

      {profile.showStockAlerts && lowStockProducts.length > 0 ? (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Low stock alert
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                At or below your threshold
              </p>
            </div>
            <Link
              href="/operations/products"
              className="text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              Manage catalog
            </Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {lowStockProducts.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-amber-200/80 bg-white/80 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-panel-dark/80"
              >
                <span className="font-semibold text-ink dark:text-cream-100">
                  {row.name}
                </span>
                <span className="text-ink-muted dark:text-cream-400">
                  {" "}
                  ({row.sku}) — {row.stock_qty} left
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ModuleQuickActions
        module="Operations"
        actions={buildQuickActions(profile)}
        footer={
          <Link
            href={profile.primaryCta.href}
            className="group flex flex-col items-center justify-center rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 p-4 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-hairline-dark dark:bg-panel-dark/50 dark:hover:border-brand-700"
          >
            <Plus className="h-6 w-6 text-brand-600 dark:text-brand-300" />
            <p className="mt-2 text-sm font-semibold text-ink dark:text-cream-100">
              {profile.primaryCta.label}
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {profile.modeLabel}
            </p>
          </Link>
        }
      />

      <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-violet-950/20 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                {summary.supplier_count} supplier
                {summary.supplier_count === 1 ? "" : "s"} on file
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Keep vendor contacts handy for reorders and PO follow-ups.
              </p>
            </div>
          </div>
          <Link
            href="/operations/suppliers"
            className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
          >
            View suppliers
          </Link>
        </div>
      </div>
    </ModuleDashboardShell>
  );
}
