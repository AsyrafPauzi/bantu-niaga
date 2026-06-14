import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Megaphone,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { TxRow } from "@/components/dashboard/tx-row";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCount } from "@/lib/marketing/metrics";
import {
  getKpiSnapshot,
  getRecentActivity,
} from "@/lib/marketing/dashboard-queries";
import {
  formatMyrAmount,
  getDemoActivity,
  getDemoFigures,
} from "@/lib/demo/figures";
import {
  hasPillar,
  minimumTierFor,
  type Pillar,
} from "@/lib/auth/entitlements";
import { tierBy, type TierKey } from "@/lib/settings/plans";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

const TONE_TILE: Record<
  "brand" | "accent" | "success" | "warning" | "neutral",
  { wrap: string; icon: string }
> = {
  brand: {
    wrap: "bg-brand-50 dark:bg-brand-900/30",
    icon: "text-brand-700 dark:text-brand-200",
  },
  accent: {
    wrap: "bg-accent-50 dark:bg-accent-700/20",
    icon: "text-accent-700 dark:text-accent-200",
  },
  success: {
    wrap: "bg-status-success/10",
    icon: "text-status-success",
  },
  warning: {
    wrap: "bg-status-warning/20",
    icon: "text-[#8C5C0A] dark:text-[#F5C97A]",
  },
  neutral: {
    wrap: "bg-cream-200 dark:bg-hairline-dark",
    icon: "text-ink-muted dark:text-cream-400",
  },
};

function todayParts() {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-MY", { weekday: "long" });
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return { weekday: weekday.toUpperCase(), greeting };
}

function fmtRel(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  return `${days}d ago`;
}

function eventIcon(name: string): {
  icon: LucideIcon;
  tone: "brand" | "success" | "warning" | "neutral";
} {
  switch (name) {
    case "customer.created":
      return { icon: UserPlus, tone: "success" };
    case "customer.tag_changed":
      return { icon: Tag, tone: "brand" };
    case "customer.merged":
      return { icon: UserCheck, tone: "brand" };
    case "customer.deleted":
      return { icon: AlertTriangle, tone: "warning" };
    default:
      return { icon: Users, tone: "neutral" };
  }
}

async function fetchDisplayName(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return "there";
  const { data: profile } = await supabase
    .from("users")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();
  const dn =
    (profile?.display_name as string | undefined) ??
    (profile?.email as string | undefined) ??
    data.user?.email ??
    "there";
  if (dn.includes("@")) return dn.split("@")[0];
  return dn.split(" ")[0];
}

export default async function HomePage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const { weekday, greeting } = todayParts();
  const supabase = await createSupabaseServerClient();
  const [displayName, snapshot, activity] = await Promise.all([
    fetchDisplayName(),
    getKpiSnapshot(supabase, user.businessId),
    getRecentActivity(supabase, user.businessId, 6),
  ]);

  const figures = getDemoFigures(user.businessId);
  const demoActivity = getDemoActivity(user.businessId, 3);

  const { data: bizRow } = await supabase
    .from("businesses")
    .select("tier")
    .eq("id", user.businessId)
    .maybeSingle();
  const tier = (bizRow?.tier ?? "starter") as TierKey;
  const maxBar = Math.max(
    ...figures.cashflow.flatMap((d) => [d.inflow, d.outflow]),
  );
  const inflow7d = figures.cashflow.reduce((a, d) => a + d.inflow, 0) * 100;
  const outflow7d = figures.cashflow.reduce((a, d) => a + d.outflow, 0) * 100;
  const docsThisMonth = (snapshot.totalCustomers % 19) + 4;

  interface PillarTile {
    href: string;
    label: string;
    pillar: Pillar;
    icon: LucideIcon;
    metric: string;
    secondary: string;
    helper: string;
    tone: "brand" | "accent" | "success" | "warning" | "neutral";
    live: boolean;
  }

  const PILLAR_OVERVIEW: PillarTile[] = [
    {
      href: "/admin",
      label: "Admin",
      pillar: "admin",
      icon: FileText,
      metric: String(docsThisMonth),
      secondary: "docs",
      helper: `${docsThisMonth} active this month`,
      tone: "brand",
      live: false,
    },
    {
      href: "/finance",
      label: "Finance",
      pillar: "finance",
      icon: Banknote,
      metric: `RM ${formatMyrAmount(figures.financeMtd)}`,
      secondary: "MTD",
      helper: `${figures.outstandingInvoices} invoices outstanding`,
      tone: "success",
      live: false,
    },
    {
      href: "/operations",
      label: "Operations",
      pillar: "operations",
      icon: Boxes,
      metric: String(figures.opsBacklog),
      secondary: `${figures.opsAtRisk} SLA risk`,
      helper:
        figures.opsAtRisk > 0 ? "Some orders need attention" : "All on track",
      tone: figures.opsAtRisk > 0 ? "warning" : "brand",
      live: false,
    },
    {
      href: "/marketing",
      label: "Marketing",
      pillar: "marketing",
      icon: Megaphone,
      metric: formatCount(snapshot.totalCustomers),
      secondary: `+${formatCount(snapshot.newThisMonth)} MTD`,
      helper: "Customers in CRM",
      tone: "accent",
      live: true,
    },
    {
      href: "/sales",
      label: "Sales",
      pillar: "sales",
      icon: ShoppingCart,
      metric: formatCount(figures.salesTickets),
      secondary: `RM ${formatMyrAmount(figures.salesToday)} today`,
      helper: "Across all channels",
      tone: "brand",
      live: false,
    },
    {
      href: "/hr",
      label: "HR",
      pillar: "hr",
      icon: Users,
      metric: String(figures.hrHeadcount),
      secondary: `${figures.hrPendingLeave} pending leave`,
      helper:
        figures.hrPendingLeave > 0
          ? "Approve in HR dashboard"
          : "All caught up",
      tone: "brand",
      live: false,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={weekday}
        title={`${greeting}, ${displayName}`}
        description="One screen, every module. Here's the pulse of your business right now."
        action={
          <Link
            href="/boardroom"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            Open Boardroom
          </Link>
        }
      />

      <section
        aria-label="Headline KPIs"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <KpiTile
          label="Revenue (MTD)"
          value={`RM ${formatMyrAmount(figures.revenueMtd)}`}
          delta={`${figures.revenueGrowthPct >= 0 ? "+" : ""}${figures.revenueGrowthPct}%`}
          deltaTone={figures.revenueGrowthPct >= 0 ? "success" : "warning"}
          helper="vs last month"
          icon={TrendingUp}
        />
        <KpiTile
          label="Outstanding"
          value={`RM ${formatMyrAmount(figures.outstanding)}`}
          delta={`${figures.outstandingInvoices} invoices`}
          deltaTone="warning"
          helper="unpaid"
          icon={Clock}
        />
        <KpiTile
          label="Low stock"
          value={`${figures.lowStock} SKU`}
          delta={
            figures.lowStockDelta === 0
              ? "0"
              : figures.lowStockDelta > 0
                ? `+${figures.lowStockDelta}`
                : `${figures.lowStockDelta}`
          }
          deltaTone={
            figures.lowStockDelta > 0
              ? "danger"
              : figures.lowStockDelta < 0
                ? "success"
                : "neutral"
          }
          helper="since yesterday"
          icon={AlertTriangle}
        />
        <KpiTile
          label="New customers"
          value={formatCount(snapshot.newThisMonth)}
          delta={
            snapshot.newThisMonth > 0
              ? `+${formatCount(snapshot.newThisMonth)}`
              : "0"
          }
          deltaTone={snapshot.newThisMonth > 0 ? "success" : "neutral"}
          helper="this month · live"
          icon={UserPlus}
        />
      </section>

      <AiBanner
        label="Bantu Niaga AI"
        message={
          snapshot.atRiskCount > 0
            ? `${formatCount(snapshot.atRiskCount)} customers at-risk and revenue MTD is tracking ${figures.revenueGrowthPct >= 0 ? "+" : ""}${figures.revenueGrowthPct}%. Open the Boardroom for a synthesised plan.`
            : `Outstanding AR is RM ${formatMyrAmount(figures.outstanding)} across ${figures.outstandingInvoices} invoices, ${figures.lowStock} SKUs are running low, and ${formatCount(snapshot.newThisMonth)} new customers joined this month. Open the Boardroom for a synthesised plan.`
        }
        cta="Open Boardroom"
        href="/boardroom"
      />

      <section aria-label="Module overview">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
            Module overview
          </h2>
          <Link
            href="/boardroom"
            className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            Ask Bantu AI →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {PILLAR_OVERVIEW.map((pillar) => {
            const tone = TONE_TILE[pillar.tone];
            const locked = !hasPillar(tier, pillar.pillar);
            const minTier = locked ? tierBy(minimumTierFor(pillar.pillar)) : null;
            const href = locked
              ? `/settings/subscription?locked=${pillar.pillar}`
              : pillar.href;
            return (
              <Link
                key={pillar.href}
                href={href}
                aria-disabled={locked || undefined}
                title={
                  locked
                    ? `Available on ${minTier?.label ?? "a higher"} plan — click to upgrade`
                    : undefined
                }
                className={`group rounded-xl border p-4 shadow-card transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-hairline-dark ${
                  locked
                    ? "border-cream-200 bg-cream-100/60 dark:bg-panel-dark/60"
                    : "border-hairline-light bg-panel-light hover:shadow-elevated dark:bg-panel-dark"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      locked
                        ? "bg-cream-200 text-ink-subtle dark:bg-hairline-dark dark:text-cream-500"
                        : `${tone.wrap} ${tone.icon}`
                    }`}
                  >
                    <pillar.icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${
                      locked
                        ? "text-ink-subtle dark:text-cream-500"
                        : "text-ink-muted group-hover:text-brand-700 dark:text-cream-400"
                    }`}
                  >
                    {pillar.label}{" "}
                    {locked ? (
                      <Lock className="h-3 w-3" strokeWidth={2.5} />
                    ) : (
                      "→"
                    )}
                  </span>
                </div>
                {locked ? (
                  <>
                    <p className="mt-3 text-xs text-ink dark:text-cream-100">
                      Locked on your current plan
                    </p>
                    <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                      Upgrade to <strong>{minTier?.label}</strong> to unlock
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-3 flex items-baseline gap-2">
                      <p className="text-2xl font-bold tabular-nums text-ink dark:text-cream-100">
                        {pillar.metric}
                      </p>
                      <p className="text-xs font-medium text-ink-muted dark:text-cream-400">
                        {pillar.secondary}
                      </p>
                    </div>
                    <p
                      className={`mt-1 text-xs ${pillar.live ? "text-status-success" : "text-ink-muted"} dark:text-cream-400`}
                    >
                      {pillar.live ? "● Live" : pillar.helper}
                    </p>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="7-day cashflow"
          subtitle="Inflow vs outflow · last 7 days"
          className="lg:col-span-2"
          action={
            <span className="inline-flex items-center gap-3 text-[11px] font-medium text-ink-muted dark:text-cream-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />
                Inflow
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-accent-500" />
                Outflow
              </span>
            </span>
          }
        >
          <div className="flex h-44 items-end gap-3 sm:h-52">
            {figures.cashflow.map((d) => (
              <div
                key={d.day}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    className="w-3 rounded-t-md bg-brand-500 sm:w-4"
                    style={{ height: `${(d.inflow / maxBar) * 100}%` }}
                    title={`Inflow RM ${d.inflow * 100}`}
                  />
                  <div
                    className="w-3 rounded-t-md bg-accent-500 sm:w-4"
                    style={{ height: `${(d.outflow / maxBar) * 100}%` }}
                    title={`Outflow RM ${d.outflow * 100}`}
                  />
                </div>
                <span className="text-[11px] font-medium text-ink-muted dark:text-cream-400">
                  {d.day}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-cream-200 pt-4 text-sm dark:border-hairline-dark">
            <div>
              <p className="font-semibold text-status-success">
                +RM {formatMyrAmount(inflow7d)}
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Inflow · 7 days
              </p>
            </div>
            <div>
              <p className="font-semibold text-accent-700 dark:text-accent-200">
                −RM {formatMyrAmount(outflow7d)}
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Outflow · 7 days
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink dark:text-cream-100">
                +RM {formatMyrAmount(inflow7d - outflow7d)}
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Net change
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Recent activity"
          subtitle="Live cross-module events"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <Link
              href="/marketing/customers"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              All
            </Link>
          }
        >
          {demoActivity.map((row) => {
            const icon =
              row.kind === "invoice_paid"
                ? CheckCircle2
                : row.kind === "pos_sale"
                  ? ShoppingCart
                  : Boxes;
            const tone =
              row.kind === "invoice_paid"
                ? "success"
                : row.kind === "pos_sale"
                  ? "brand"
                  : "warning";
            return (
              <TxRow
                key={row.id}
                icon={icon}
                tone={tone}
                title={row.title}
                subtitle={row.subtitle}
                amount={row.amount}
              />
            );
          })}
          {activity.slice(0, 3).map((row) => {
            const ev = eventIcon(row.event_name);
            return (
              <TxRow
                key={row.id}
                icon={ev.icon}
                tone={ev.tone}
                title={row.summary}
                subtitle={fmtRel(row.created_at)}
                amount="Live"
              />
            );
          })}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="Today's quick actions"
          subtitle="One-tap entries into the most-used flows"
          className="lg:col-span-2"
          bodyClassName="grid gap-3 sm:grid-cols-2"
        >
          {[
            {
              icon: UserPlus,
              title: "Add customer",
              subtitle: "Card-index CRM",
              href: "/marketing/customers/new",
              tone: "accent" as const,
            },
            {
              icon: Megaphone,
              title: "Plan a post",
              subtitle: "TikTok · IG · FB",
              href: "/marketing/content/new",
              tone: "brand" as const,
            },
            {
              icon: TrendingUp,
              title: "Create invoice",
              subtitle: "Bill a customer in seconds",
              href: "/finance/invoices",
              tone: "success" as const,
            },
            {
              icon: ShoppingCart,
              title: "Open POS",
              subtitle: "Process a sale or refund",
              href: "/sales/pos",
              tone: "brand" as const,
            },
          ].map((action) => {
            const tone = TONE_TILE[action.tone];
            return (
              <Link
                key={action.title}
                href={action.href}
                className="flex items-center gap-3 rounded-lg border border-cream-200 p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:border-hairline-dark dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.wrap} ${tone.icon}`}
                >
                  <action.icon className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                    {action.title}
                  </p>
                  <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                    {action.subtitle}
                  </p>
                </div>
              </Link>
            );
          })}
        </SectionCard>

        <SectionCard
          title="What's next"
          subtitle="System status"
          bodyClassName="space-y-2.5"
        >
          <p className="text-sm text-ink-muted dark:text-cream-400">
            Marketing CRM and the Marketplace are wired to real data.
            Finance, Operations, Sales, and HR modules will replace today&apos;s
            figures with their own ledgers as each ships.
          </p>
          <ul className="space-y-1.5">
            {[
              { label: "Marketing CRM (live)", tone: "success" as const },
              { label: "Marketplace add-ons (live)", tone: "success" as const },
              {
                label: "Module dashboards (UI ready)",
                tone: "warning" as const,
              },
              { label: "AI Boardroom (preview)", tone: "warning" as const },
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 text-xs text-ink dark:text-cream-100"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    item.tone === "success"
                      ? "bg-status-success"
                      : item.tone === "warning"
                        ? "bg-accent-500"
                        : "bg-ink-subtle"
                  }`}
                  aria-hidden
                />
                {item.label}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <p className="text-center text-[11px] text-ink-subtle">
        Marketing CRM and the Marketplace run on real data · Finance,
        Operations, Sales, and HR modules will swap in their own data services
        as each ships.
      </p>
    </div>
  );
}
