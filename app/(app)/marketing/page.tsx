import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Camera,
  Eye,
  Facebook,
  Gift,
  Heart,
  MessageSquare,
  Plus,
  Search,
  Send,
  Share2,
  Star,
  Tag,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { BulletRow } from "@/components/dashboard/bullet-row";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { ListRow } from "@/components/dashboard/list-row";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TxRow } from "@/components/dashboard/tx-row";
import { Card, CardBody } from "@/components/ui/card";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCount, formatMyr } from "@/lib/marketing/metrics";
import {
  getCustomerGrowthSeries,
  getKpiDeltas,
  getKpiSnapshot,
  getRecentActivity,
  getSegmentBreakdown,
  getTopCustomers,
  getUpcomingContent,
} from "@/lib/marketing/dashboard-queries";
import { getDemoChannelMix, getDemoTopPosts } from "@/lib/demo/figures";

export const metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  {
    icon: Send,
    title: "Send broadcast",
    subtitle: "WhatsApp · email",
    href: "/marketing/broadcasts",
  },
  {
    icon: Tag,
    title: "Tag customers",
    subtitle: "Bulk auto-tag",
    href: "/marketing/customers?bulk=tag",
  },
  {
    icon: Gift,
    title: "Create coupon",
    subtitle: "% / RM off",
    href: "/marketing/coupons",
  },
  {
    icon: Calendar,
    title: "Schedule post",
    subtitle: "TikTok · IG · FB",
    href: "/marketing/content/new",
  },
  {
    icon: Upload,
    title: "Import CSV",
    subtitle: "Bulk upload",
    href: "/marketing/customers/import",
  },
];

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtRel(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `${months} mo${months === 1 ? "" : "s"} ago`;
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

function eventIcon(name: string): LucideIcon {
  if (name === "customer.created") return UserPlus;
  if (name === "customer.tag_changed") return Tag;
  if (name === "customer.merged") return UserCheck;
  if (name === "customer.deleted") return AlertTriangle;
  return UserCheck;
}

export default async function MarketingOverviewPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "customers")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <h1 className="text-xl font-semibold text-ink dark:text-cream-100">
            Marketing
          </h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Marketing module. Ask your owner
            or manager.
          </p>
        </CardBody>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [snapshot, deltas, growth, segments, topCustomers, upcoming, activity] =
    await Promise.all([
      getKpiSnapshot(supabase, user.businessId),
      getKpiDeltas(supabase, user.businessId),
      getCustomerGrowthSeries(supabase, user.businessId, 12),
      getSegmentBreakdown(supabase, user.businessId),
      getTopCustomers(supabase, user.businessId, 5),
      getUpcomingContent(supabase, user.businessId, 7),
      getRecentActivity(supabase, user.businessId, 5),
    ]);

  const totalCustomers = snapshot.totalCustomers;
  const vipCount = snapshot.vipCount;
  const repeatCount = snapshot.repeatCount;
  const newCount = snapshot.newThisMonth;
  const atRiskCount = snapshot.atRiskCount;
  const dormantCount = snapshot.dormantCount;

  const channelMix = getDemoChannelMix(user.businessId);
  const topPosts = getDemoTopPosts(user.businessId, 4);

  const segPct = (n: number): number =>
    totalCustomers > 0 ? Math.min(100, Math.round((n / totalCustomers) * 100)) : 0;

  // Segment slugs map to the `tags` query param accepted by
  // `app/api/marketing/customers/route.ts` (and the `/marketing/customers`
  // server page). The auto_tag values are defined in
  // `lib/marketing/schemas.ts` (AUTO_TAGS).
  const SEGMENT_ROWS = [
    {
      label: "VIP",
      slug: "vip",
      sublabel: "≥ RM 1,000 lifetime spend",
      value: formatCount(vipCount),
      fill: segPct(vipCount),
      tone: "accent" as const,
    },
    {
      label: "Repeat",
      slug: "repeat",
      sublabel: "3+ orders in last 90 days",
      value: formatCount(repeatCount),
      fill: segPct(repeatCount),
      tone: "brand" as const,
    },
    {
      label: "New (MTD)",
      slug: "new",
      sublabel: "Joined this month",
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

  const growthMax = Math.max(1, ...growth.map((g) => g.newAdditions));
  const newThisMonthRow = growth[growth.length - 1]?.newAdditions ?? 0;
  const newLastMonthRow = growth[growth.length - 2]?.newAdditions ?? 0;
  const momDelta = newThisMonthRow - newLastMonthRow;
  const momPct =
    newLastMonthRow > 0
      ? Math.round((momDelta / newLastMonthRow) * 100)
      : newThisMonthRow > 0
        ? 100
        : 0;

  const fmtSignedCount = (n: number): string =>
    `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-MY")}`;

  const aiMessage =
    atRiskCount > 0
      ? `${formatCount(atRiskCount)} customers are At-risk and your VIP cohort is ${formatCount(vipCount)} strong. Send a personalised win-back broadcast — I can draft it.`
      : `${formatCount(totalCustomers)} active customers · ${formatCount(vipCount)} VIPs. No At-risk segment right now; great time to nurture Repeats into VIPs.`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketing"
        title="Overview"
        description="Customer base, segments, channels, and content — at a glance."
        action={
          <div className="flex items-center gap-2">
            <form
              method="get"
              action="/marketing/customers"
              role="search"
              aria-label="Search customers"
              className="hidden items-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-sm shadow-card md:flex dark:border-hairline-dark dark:bg-panel-dark"
            >
              <label htmlFor="marketing-overview-search" className="sr-only">
                Search customers, content
              </label>
              <Search
                className="h-4 w-4 text-ink-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              <input
                id="marketing-overview-search"
                type="search"
                name="q"
                placeholder="Search customers, content…"
                className="w-56 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100 dark:placeholder:text-cream-400"
              />
              <button type="submit" className="sr-only">
                Search
              </button>
            </form>
            <Link
              href="/marketing/customers/new"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              New customer
            </Link>
          </div>
        }
      />

      <section
        aria-label="Headline KPIs"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <KpiTile
          label="Total customers"
          value={formatCount(totalCustomers)}
          delta={
            deltas.totalCustomersDelta !== 0
              ? fmtSignedCount(deltas.totalCustomersDelta)
              : undefined
          }
          deltaTone={deltas.totalCustomersDelta >= 0 ? "success" : "danger"}
          helper="vs last month"
          icon={Users}
        />
        <KpiTile
          label="New (MTD)"
          value={formatCount(newCount)}
          delta={momDelta !== 0 ? `${momPct >= 0 ? "+" : ""}${momPct}%` : undefined}
          deltaTone={momDelta >= 0 ? "success" : "danger"}
          helper="vs last month"
          icon={UserPlus}
        />
        <KpiTile
          label="VIP customers"
          value={formatCount(vipCount)}
          delta={
            totalCustomers > 0
              ? `${Math.round((vipCount / totalCustomers) * 100)}% of base`
              : undefined
          }
          deltaTone="brand"
          helper={`${formatMyr(snapshot.totalSpendMyr)} lifetime`}
          icon={Star}
        />
        <KpiTile
          label="At-risk"
          value={formatCount(atRiskCount)}
          delta={atRiskCount > 0 ? "needs care" : "all clear"}
          deltaTone={atRiskCount > 0 ? "warning" : "success"}
          helper="auto-segmented"
          icon={AlertTriangle}
        />
      </section>

      <AiBanner
        label="Maya · Marketing AI"
        message={aiMessage}
        cta="Draft broadcast"
        disabled
        disabledLabel="Coming soon"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="Customer segments"
          subtitle="Auto-tagged by spend, recency, and frequency"
          className="lg:col-span-2"
          bodyClassName="space-y-4"
          action={
            <Link
              href="/marketing/segments"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              View all
            </Link>
          }
        >
          {SEGMENT_ROWS.map((s) => (
            <Link
              key={s.label}
              href={`/marketing/customers?tags=${encodeURIComponent(s.slug)}`}
              aria-label={`View ${s.label} customers`}
              className="block rounded-lg -mx-1 px-1 py-1 transition-colors hover:bg-cream-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:bg-hairline-dark/30"
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
        </SectionCard>

        <SectionCard
          title="Recent activity"
          subtitle="Live customer events"
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
          {activity.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted dark:text-cream-400">
              No recent activity yet.
            </p>
          ) : (
            activity.map((row) => (
              <TxRow
                key={row.id}
                icon={eventIcon(row.event_name)}
                tone={row.event_name === "customer.deleted" ? "warning" : "brand"}
                title={row.summary}
                subtitle={fmtRel(row.created_at)}
                amount={row.event_name.replace("customer.", "")}
              />
            ))
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="Top customers"
          subtitle="By lifetime spend"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <Link
              href="/marketing/customers?sort=total_spend_myr&order=desc"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              All
            </Link>
          }
        >
          {topCustomers.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted dark:text-cream-400">
              No customers yet.
            </p>
          ) : (
            topCustomers.map((c) => (
              <Link
                key={c.id}
                href={`/marketing/customers/${c.id}`}
                className="block hover:bg-cream-100/40 dark:hover:bg-hairline-dark/30"
              >
                <ListRow
                  initials={initialsOf(c.name)}
                  title={c.name}
                  subtitle={`${c.auto_tags.includes("vip") ? "VIP" : c.auto_tags.includes("repeat") ? "Repeat" : "—"} · ${formatCount(c.order_count)} orders`}
                  value={formatMyr(c.total_spend_myr)}
                />
              </Link>
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming content"
          subtitle="Next 7 days · TikTok, IG, FB"
          className="lg:col-span-2"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <Link
              href="/marketing/content"
              className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-200"
            >
              Open calendar
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted dark:text-cream-400">
              Nothing scheduled in the next 7 days.{" "}
              <Link
                href="/marketing/content/new"
                className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                Plan a post →
              </Link>
            </p>
          ) : (
            upcoming.map((p) => {
              const meta = CHANNEL_META[p.channel];
              const Icon = meta.icon;
              return (
                <Link
                  key={p.id}
                  href={`/marketing/content/${p.id}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-cream-100/40 dark:hover:bg-hairline-dark/30"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream-100 dark:bg-hairline-dark/40">
                    <Icon className={`h-4 w-4 ${meta.color}`} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                      {p.hook ?? "Untitled post"}
                    </p>
                    <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                      <span className={`font-semibold ${meta.color}`}>
                        {meta.label}
                      </span>{" "}
                      · {fmtScheduled(p.scheduled_at)}
                    </p>
                  </div>
                  <StatusPill
                    tone={p.status === "scheduled" ? "success" : "neutral"}
                  >
                    {p.status === "scheduled" ? "Scheduled" : "Draft"}
                  </StatusPill>
                </Link>
              );
            })
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
      <SectionCard
        title="Customer growth"
        subtitle={`New customers per month · last ${growth.length} months`}
        className="lg:col-span-2"
        action={
          <span
            title="Default range"
            aria-label={`Default range: last ${growth.length} months`}
            className="inline-flex items-center rounded-full bg-cream-200 px-2.5 py-1 text-[11px] font-semibold text-ink dark:bg-hairline-dark dark:text-cream-100"
          >
            Last {growth.length} months
          </span>
        }
      >
        <div className="flex h-44 items-end gap-2 sm:h-48">
          {growth.map((g, i) => (
            <div
              key={g.month}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div
                className={`w-full rounded-t-md ${
                  i === growth.length - 1 ? "bg-accent-500" : "bg-brand-200"
                }`}
                style={{
                  height: `${Math.max(2, (g.newAdditions / growthMax) * 100)}%`,
                }}
                title={`${g.monthLabel}: +${g.newAdditions} (total ${g.total})`}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {growth.map((g) => (
            <span
              key={g.month}
              className="flex-1 text-center text-[11px] font-medium text-ink-muted dark:text-cream-400"
            >
              {g.monthLabel.split(" ")[0]}
            </span>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-cream-200 pt-4 text-sm dark:border-hairline-dark">
          <div>
            <p
              className={`font-semibold ${momDelta >= 0 ? "text-status-success" : "text-status-danger"}`}
            >
              {fmtSignedCount(momDelta)} this month
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {momDelta === 0 ? "—" : `${momPct >= 0 ? "+" : ""}${momPct}% MoM`}
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink dark:text-cream-100">
              {formatCount(totalCustomers)} total
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Active customer base
            </p>
          </div>
          <div>
            <p className="font-semibold text-brand-700 dark:text-brand-200">
              {formatMyr(snapshot.totalSpendMyr)}
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Lifetime spend
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Channel performance"
        subtitle="Reach + engagement · last 30 days"
        bodyClassName="space-y-4"
      >
        {channelMix
          .filter(
            (c): c is typeof c & { channel: "tiktok" | "instagram" | "facebook" } =>
              c.channel !== "whatsapp",
          )
          .map((row) => {
            const upcomingCount = upcoming.filter(
              (u) => u.channel === row.channel,
            ).length;
            return { ...row, posts: upcomingCount || row.posts };
          })
          .map((row) => {
          const meta = CHANNEL_META[row.channel];
          const Icon = meta.icon;
          return (
            <Link
              key={row.channel}
              href="/settings/integrations"
              aria-label={`Connect ${meta.label} in Settings → Integrations`}
              className="block space-y-1.5 rounded-lg -mx-1 px-1 py-1 transition-colors hover:bg-cream-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:bg-hairline-dark/30"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-ink dark:text-cream-100">
                  <Icon className={`h-4 w-4 ${meta.color}`} strokeWidth={2} />
                  {meta.label}
                </span>
                <span className="tabular-nums text-ink-muted dark:text-cream-400">
                  {row.reach} reach · {row.engagement}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
                <div
                  className={`h-full rounded-full ${
                    row.channel === "tiktok"
                      ? "bg-accent-500"
                      : row.channel === "instagram"
                        ? "bg-brand-500"
                        : "bg-brand-300"
                  }`}
                  style={{ width: `${row.fill}%` }}
                />
              </div>
              <p className="text-[11px] text-ink-muted dark:text-cream-400">
                {row.posts} upcoming post{row.posts === 1 ? "" : "s"}
              </p>
            </Link>
          );
        })}
        <p className="border-t border-cream-200 pt-3 text-[11px] italic text-ink-subtle dark:border-hairline-dark">
          Activate the TikTok Shop sync or WhatsApp Business add-on from{" "}
          <Link
            href="/settings/integrations"
            className="font-semibold not-italic text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            Settings → Integrations
          </Link>{" "}
          to swap in live metrics.
        </p>
      </SectionCard>
      </div>

      <SectionCard
        title="Top performing content"
        subtitle="Best posts in the last 30 days"
        action={
          <Link
            href="/marketing/content"
            className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            View all
          </Link>
        }
        bodyClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {topPosts.map((post) => {
          const meta = CHANNEL_META[post.channel];
          const Icon = meta.icon;
          return (
            <Link
              key={post.id}
              href="/marketing/content"
              aria-label={`Open the content calendar — sample ${meta.label} post`}
              className="block space-y-2 rounded-xl border border-cream-200 bg-cream-100/60 p-3 transition-shadow hover:shadow-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-hairline-dark dark:bg-hairline-dark/30"
            >
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-accent-50 dark:bg-accent-700/15">
                <Icon
                  className={`h-8 w-8 ${meta.color} opacity-70`}
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <p className="line-clamp-2 text-sm font-semibold text-ink dark:text-cream-100">
                  {post.title}
                </p>
                <p className={`mt-0.5 text-[11px] font-semibold ${meta.color}`}>
                  {meta.label}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-1 border-t border-cream-200 pt-2 text-[10px] dark:border-hairline-dark">
                {[
                  { icon: Eye, value: post.views },
                  { icon: Heart, value: post.likes },
                  { icon: MessageSquare, value: post.comments },
                  { icon: Share2, value: post.shares },
                ].map((m, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-0.5 text-ink-muted dark:text-cream-400"
                  >
                    <m.icon className="h-3 w-3" strokeWidth={2} />
                    <span className="tabular-nums">{m.value}</span>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </SectionCard>

      <section
        aria-label="Quick actions"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.title}
            href={a.href}
            className="flex items-center gap-3 rounded-xl border border-hairline-light bg-panel-light p-3.5 shadow-card transition-shadow hover:shadow-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-hairline-dark dark:bg-panel-dark"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200">
              <a.icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                {a.title}
              </p>
              <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                {a.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </section>

      <p className="text-center text-[11px] text-ink-subtle">
        Live customer + segment data · channel reach and post engagement will
        switch to real numbers once you activate the TikTok or WhatsApp add-on
        from the <Link href="/marketplace" className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">Marketplace</Link>.
      </p>
    </div>
  );
}
