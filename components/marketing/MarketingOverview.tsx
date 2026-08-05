import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  Clock,
  Eye,
  Facebook,
  Gift,
  Heart,
  MessageSquare,
  Plus,
  Send,
  Share2,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { AdminCatalogEmpty } from "@/components/admin/AdminCatalogUi";
import {
  AdminOverviewPanel,
  AdminOverviewRow,
} from "@/components/admin/AdminOverviewPanel";
import { BulletRow } from "@/components/dashboard/bullet-row";
import {
  ModuleAttentionPills,
  ModuleDashboardHero,
  ModuleDashboardShell,
  ModuleHeroStat,
  ModuleQuickActions,
} from "@/components/dashboard/module-layout";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatCount, formatMyr } from "@/lib/marketing/metrics";
import type {
  ActivityRow,
  KpiDeltas,
  KpiSnapshotResult,
  TopContentRow,
  TopCustomerRow,
  UpcomingContentRow,
} from "@/lib/marketing/dashboard-queries";
import type { PillarNotificationItem } from "@/lib/notifications/load-pillar";
import { cn } from "@/lib/utils/cn";
import { fmtRelTime } from "@/lib/utils/relative-time";
import { pillarClasses } from "@/lib/pillars/theme";

const marketingTheme = pillarClasses.marketing;

const QUICK_ACTIONS = [
  {
    href: "/marketing/broadcasts/new",
    icon: Send,
    title: "Send broadcast",
    subtitle: "WhatsApp or email",
  },
  {
    href: "/marketing/customers?bulk=tag",
    icon: Tag,
    title: "Refresh tags",
    subtitle: "Recompute auto-tags",
  },
  {
    href: "/marketing/coupons/new",
    icon: Gift,
    title: "Create coupon",
    subtitle: "% or RM off",
  },
  {
    href: "/marketing/content/new",
    icon: Calendar,
    title: "Plan content",
    subtitle: "Calendar drafts",
  },
  {
    href: "/marketing/assistant",
    icon: Sparkles,
    title: "Ask Maya",
    subtitle: "Campaign ideas",
  },
] as const;

const CHANNEL_META: Record<
  "tiktok" | "instagram" | "facebook",
  { label: string; icon: LucideIcon; color: string }
> = {
  tiktok: {
    label: "TikTok",
    icon: Video,
    color: "text-accent-700 dark:text-accent-200",
  },
  instagram: {
    label: "Instagram",
    icon: Camera,
    color: "text-brand-700 dark:text-brand-200",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    color: "text-brand-700 dark:text-brand-200",
  },
};

function fmtRel(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return `${Math.round(days / 30)} mo ago`;
}

function fmtScheduled(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "—";
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) {
    return `Today · ${d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleString("en-MY", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtSignedCount(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-MY")}`;
}

function eventIcon(name: string): LucideIcon {
  if (name === "customer.created") return UserPlus;
  if (name === "customer.tag_changed") return Tag;
  return Users;
}

export interface MarketingOverviewProps {
  snapshot: KpiSnapshotResult;
  deltas: KpiDeltas;
  growth: Array<{ month: string; monthLabel: string; newAdditions: number; total: number }>;
  topCustomers: TopCustomerRow[];
  upcoming: UpcomingContentRow[];
  topContent: TopContentRow[];
  activity: ActivityRow[];
  teamNotifications: PillarNotificationItem[];
}

export function MarketingOverview({
  snapshot,
  deltas,
  growth,
  topCustomers,
  upcoming,
  topContent,
  activity,
  teamNotifications,
}: MarketingOverviewProps) {
  const totalCustomers = snapshot.totalCustomers;
  const vipCount = snapshot.vipCount;
  const repeatCount = snapshot.repeatCount;
  const newCount = snapshot.newThisMonth;
  const atRiskCount = snapshot.atRiskCount;
  const dormantCount = snapshot.dormantCount;

  const segPct = (n: number): number =>
    totalCustomers > 0 ? Math.min(100, Math.round((n / totalCustomers) * 100)) : 0;

  const SEGMENT_ROWS = [
    {
      label: "VIP",
      slug: "vip",
      sublabel: "RM 1,000+ lifetime spend",
      value: formatCount(vipCount),
      fill: segPct(vipCount),
      tone: "accent" as const,
    },
    {
      label: "Repeat",
      slug: "repeat",
      sublabel: "3+ orders in 90 days",
      value: formatCount(repeatCount),
      fill: segPct(repeatCount),
      tone: "brand" as const,
    },
    {
      label: "New this month",
      slug: "new",
      sublabel: "Joined in the current month",
      value: formatCount(newCount),
      fill: segPct(newCount),
      tone: "success" as const,
    },
    {
      label: "At-risk",
      slug: "at-risk",
      sublabel: "No purchase in 60+ days",
      value: formatCount(atRiskCount),
      fill: segPct(atRiskCount),
      tone: "warning" as const,
    },
    {
      label: "Dormant",
      slug: "dormant",
      sublabel: "No purchase in 120+ days",
      value: formatCount(dormantCount),
      fill: segPct(dormantCount),
      tone: "muted" as const,
    },
  ];

  const newThisMonthRow = growth[growth.length - 1]?.newAdditions ?? 0;
  const newLastMonthRow = growth[growth.length - 2]?.newAdditions ?? 0;
  const momDelta = newThisMonthRow - newLastMonthRow;
  const showGrowthChart =
    totalCustomers >= 3 && growth.some((g) => g.newAdditions > 0);
  const growthMax = Math.max(1, ...growth.map((g) => g.newAdditions));

  const heroHeadline =
    totalCustomers === 0
      ? "Your CRM starts here"
      : atRiskCount > 0
        ? `${formatCount(atRiskCount)} customer${atRiskCount === 1 ? "" : "s"} slipping away`
        : dormantCount > 0
          ? `${formatCount(dormantCount)} ready for a comeback`
          : `${formatCount(totalCustomers)} customers in your corner`;

  const heroSub =
    totalCustomers === 0
      ? "Add your first buyer or import a CSV — segments and broadcasts unlock once you have names."
      : atRiskCount > 0
        ? "They have not bought in 60+ days. A targeted broadcast or coupon usually wins a few back."
        : dormantCount > 0
          ? `${formatCount(dormantCount)} have been quiet 120+ days — a win-back promo this week is worth a shot.`
          : vipCount > 0
            ? `${formatCount(vipCount)} VIP${vipCount === 1 ? "" : "s"} driving ${formatMyr(snapshot.totalSpendMyr)} lifetime spend.`
            : "Segments, broadcasts, coupons, and your content calendar — all tied to real purchase data.";

  const newHint =
    newLastMonthRow > 0
      ? `${fmtSignedCount(momDelta)} vs last month`
      : newThisMonthRow > 0
        ? "first additions this month"
        : undefined;

  const attentionItems = [
    atRiskCount > 0
      ? {
          label: `${formatCount(atRiskCount)} at-risk — act now`,
          href: "/marketing/customers?tags=at-risk",
          tone: "danger" as const,
        }
      : null,
    dormantCount > 0
      ? {
          label: `${formatCount(dormantCount)} dormant — win back`,
          href: "/marketing/customers?tags=dormant",
          tone: "warning" as const,
        }
      : null,
    newCount > 0
      ? {
          label: `${formatCount(newCount)} new this month`,
          href: "/marketing/customers?tags=new",
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
      <Link
        href="/home"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700 dark:text-cream-400 dark:hover:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Home
      </Link>

      <ModuleDashboardHero
        module="Marketing"
        pillar="marketing"
        headline={heroHeadline}
        subcopy={heroSub}
        cta={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/marketing/customers"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border bg-white/80 px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-white dark:bg-panel-dark/80",
                marketingTheme.btnSecondary,
              )}
            >
              <Users className="h-4 w-4" strokeWidth={2} />
              All customers
            </Link>
            <Link
              href="/marketing/customers/new"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors",
                marketingTheme.btnPrimary,
              )}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              New customer
            </Link>
          </div>
        }
      >
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Customers"
            value={formatCount(totalCustomers)}
            hint={
              deltas.totalCustomersDelta !== 0
                ? `${fmtSignedCount(deltas.totalCustomersDelta)} vs last month`
                : "active in CRM"
            }
            icon={Users}
            iconClassName={marketingTheme.eyebrow}
            href="/marketing/customers"
          />
          <ModuleHeroStat
            label="New this month"
            value={formatCount(newCount)}
            hint={newHint}
            icon={UserPlus}
            iconClassName={marketingTheme.eyebrow}
            href="/marketing/customers?tags=new"
          />
          <ModuleHeroStat
            label="VIP"
            value={formatCount(vipCount)}
            hint={vipCount > 0 ? "top spenders" : "none yet"}
            icon={Star}
            iconClassName={marketingTheme.eyebrow}
            href="/marketing/customers?tags=vip"
          />
          <ModuleHeroStat
            label="Lifetime spend"
            value={formatMyr(snapshot.totalSpendMyr)}
            hint={
              snapshot.avgAovMyr > 0
                ? `${formatMyr(snapshot.avgAovMyr)} avg order`
                : "from all customers"
            }
            icon={TrendingUp}
            iconClassName={marketingTheme.eyebrow}
          />
        </div>
      </ModuleDashboardHero>

      <ModuleAttentionPills items={attentionItems} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <AdminOverviewPanel
          title="Who is in each segment?"
          subtitle="Auto-tags from your real purchase history"
          className="lg:col-span-7"
          action={
            <Link
              href="/marketing/segments"
              className="text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              Segments
            </Link>
          }
        >
          <div className="space-y-1 px-4 py-3 sm:px-5">
            {SEGMENT_ROWS.map((s) => (
              <Link
                key={s.label}
                href={`/marketing/customers?tags=${encodeURIComponent(s.slug)}`}
                className="block rounded-lg px-1 py-1 transition-colors hover:bg-cream-50 dark:hover:bg-panel-dark/60"
              >
                <BulletRow
                  label={s.label}
                  sublabel={s.sublabel}
                  value={s.value}
                  fill={s.fill}
                  tone={s.tone}
                />
              </Link>
            ))}
          </div>
        </AdminOverviewPanel>

        <AdminOverviewPanel
          title="Latest activity"
          subtitle="Customer events from your CRM"
          className="lg:col-span-5"
          action={
            <Link
              href="/marketing/customers"
              className="text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              View all
            </Link>
          }
        >
          <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {activity.length === 0 ? (
              <div className="px-4 py-6 sm:px-5">
                <AdminCatalogEmpty
                  icon={Users}
                  title="No activity yet"
                  hint="Create or import customers to start tracking events."
                  className="border-none bg-transparent py-6 dark:bg-transparent"
                />
              </div>
            ) : (
              activity.map((row) => {
                const Icon = eventIcon(row.event_name);
                return (
                  <div
                    key={row.id}
                    className="flex items-start gap-3 px-4 py-3 sm:px-5"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink dark:text-cream-100">
                        {row.summary}
                      </p>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {fmtRel(row.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </AdminOverviewPanel>

        <AdminOverviewPanel
          title="Top spenders"
          subtitle="Ranked by lifetime value"
          className="lg:col-span-5"
          action={
            <Link
              href="/marketing/customers?sort=total_spend_myr&order=desc"
              className="text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              Full list
            </Link>
          }
        >
          <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {topCustomers.length === 0 ? (
              <div className="px-4 py-6 sm:px-5">
                <AdminCatalogEmpty
                  icon={Users}
                  title="No customers yet"
                  hint="Add your first customer or import a CSV."
                  className="border-none bg-transparent py-6 dark:bg-transparent"
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Link
                        href="/marketing/customers/new"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                      >
                        <Plus className="h-4 w-4" />
                        New customer
                      </Link>
                      <Link
                        href="/marketing/customers/import"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100"
                      >
                        <Upload className="h-4 w-4" />
                        Import CSV
                      </Link>
                    </div>
                  }
                />
              </div>
            ) : (
              topCustomers.map((c) => (
                <AdminOverviewRow
                  key={c.id}
                  href={`/marketing/customers/${c.id}`}
                  title={c.name}
                  subtitle={
                    c.auto_tags.includes("vip")
                      ? "VIP"
                      : c.auto_tags.includes("repeat")
                        ? "Repeat buyer"
                        : c.auto_tags.includes("dormant")
                          ? "Dormant"
                          : `${formatCount(c.order_count)} orders`
                  }
                  trailing={
                    <span className="text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
                      {formatMyr(c.total_spend_myr)}
                    </span>
                  }
                />
              ))
            )}
          </div>
        </AdminOverviewPanel>

        <AdminOverviewPanel
          title="Coming up"
          subtitle="Scheduled or drafted in the next 7 days"
          className="lg:col-span-7"
          action={
            <Link
              href="/marketing/content"
              className="text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              Calendar
            </Link>
          }
        >
          <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {upcoming.length === 0 ? (
              <div className="px-4 py-6 sm:px-5">
                <AdminCatalogEmpty
                  icon={Calendar}
                  title="Nothing on the calendar"
                  hint="Plan TikTok, Instagram, or Facebook posts for the week ahead."
                  className="border-none bg-transparent py-6 dark:bg-transparent"
                  action={
                    <Link
                      href="/marketing/content/new"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                    >
                      <Plus className="h-4 w-4" />
                      Plan a post
                    </Link>
                  }
                />
              </div>
            ) : (
              upcoming.map((p) => {
                const meta = CHANNEL_META[p.channel];
                const Icon = meta.icon;
                return (
                  <AdminOverviewRow
                    key={p.id}
                    href={`/marketing/content/${p.id}`}
                    title={p.hook ?? "Untitled post"}
                    subtitle={`${meta.label} · ${fmtScheduled(p.scheduled_at)}`}
                    badge={
                      <StatusPill
                        tone={p.status === "scheduled" ? "success" : "neutral"}
                      >
                        {p.status === "scheduled" ? "Scheduled" : "Draft"}
                      </StatusPill>
                    }
                    trailing={
                      <Icon className={cn("h-4 w-4", meta.color)} strokeWidth={2} />
                    }
                  />
                );
              })
            )}
          </div>
        </AdminOverviewPanel>

        {showGrowthChart ? (
          <AdminOverviewPanel
            title="New customers over time"
            subtitle={`Monthly additions · last ${growth.length} months`}
            className="lg:col-span-12"
          >
            <div className="px-4 py-4 sm:px-5">
              <div className="flex h-32 items-end gap-1.5 sm:h-36 sm:gap-2">
                {growth.map((g, i) => (
                  <div
                    key={g.month}
                    className="group flex flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-[10px] font-semibold tabular-nums text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 dark:text-cream-400">
                      +{g.newAdditions}
                    </span>
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-colors",
                        i === growth.length - 1
                          ? "bg-violet-500"
                          : "bg-violet-200 dark:bg-violet-800",
                      )}
                      style={{
                        height: `${Math.max(4, (g.newAdditions / growthMax) * 100)}%`,
                      }}
                      title={`${g.monthLabel}: +${g.newAdditions}`}
                    />
                    <span className="hidden text-[9px] font-medium text-ink-muted sm:block dark:text-cream-500">
                      {g.monthLabel.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-6 border-t border-cream-200 pt-4 text-sm dark:border-hairline-dark">
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      momDelta >= 0 ? "text-status-success" : "text-status-danger",
                    )}
                  >
                    {fmtSignedCount(momDelta)} new vs last month
                  </p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    Month-on-month pace
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-ink dark:text-cream-100">
                    {formatCount(dormantCount)} dormant
                  </p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    Win-back opportunity
                  </p>
                </div>
              </div>
            </div>
          </AdminOverviewPanel>
        ) : null}
      </div>

      {topContent.length > 0 ? (
        <AdminOverviewPanel
          title="Recently posted"
          subtitle="Content marked as posted with engagement logged"
          action={
            <Link
              href="/marketing/content"
              className="text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              All content
            </Link>
          }
        >
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
            {topContent.map((post) => {
              const meta = CHANNEL_META[post.channel];
              const Icon = meta.icon;
              const hasEngagement =
                post.views > 0 ||
                post.likes > 0 ||
                post.comments_count > 0 ||
                post.shares > 0;
              return (
                <Link
                  key={post.id}
                  href={`/marketing/content/${post.id}`}
                  className="space-y-2 rounded-xl border border-cream-200 bg-cream-50/50 p-3 transition-shadow hover:shadow-card dark:border-hairline-dark dark:bg-panel-dark/40"
                >
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-white dark:bg-panel-dark">
                    <Icon className={cn("h-8 w-8 opacity-70", meta.color)} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="line-clamp-2 text-sm font-semibold text-ink dark:text-cream-100">
                      {post.hook ?? "Untitled"}
                    </p>
                    <p className={cn("mt-0.5 text-[11px] font-semibold", meta.color)}>
                      {meta.label}
                    </p>
                  </div>
                  {hasEngagement ? (
                    <div className="grid grid-cols-4 gap-1 border-t border-cream-200 pt-2 text-[10px] dark:border-hairline-dark">
                      {[
                        { icon: Eye, value: post.views },
                        { icon: Heart, value: post.likes },
                        { icon: MessageSquare, value: post.comments_count },
                        { icon: Share2, value: post.shares },
                      ].map((m, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center gap-0.5 text-ink-muted dark:text-cream-400"
                        >
                          <m.icon className="h-3 w-3" strokeWidth={2} />
                          <span className="tabular-nums">{formatCount(m.value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-ink-muted dark:text-cream-400">
                      Log engagement when posted
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </AdminOverviewPanel>
      ) : null}

      <AdminOverviewPanel
        title="Team activity feed"
        subtitle="Recent marketing events for your team"
      >
        <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {teamNotifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-muted sm:px-5 dark:text-cream-400">
              Customers, coupons, broadcasts, and imports will appear here.
            </div>
          ) : (
            teamNotifications.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-4 py-3 sm:px-5"
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    marketingTheme.iconBox,
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

      <ModuleQuickActions module="Marketing" pillar="marketing" actions={QUICK_ACTIONS} />
    </ModuleDashboardShell>
  );
}
