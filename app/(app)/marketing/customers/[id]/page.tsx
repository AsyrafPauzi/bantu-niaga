import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Edit3,
  Gift,
  MessageCircle,
  Phone,
  ShoppingBag,
  Sparkles,
  Tag,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCount, formatMyr } from "@/lib/marketing/metrics";
import { CustomerForm } from "@/components/marketing/CustomerForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Customer ${id.slice(0, 8)}` };
}

interface CustomerRow {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  address: string | null;
  manual_tags: string[];
  auto_tags: string[];
  notes: string | null;
  source: string | null;
  total_spend_myr: number;
  last_purchase_at: string | null;
  order_count: number;
  aov_myr: number | null;
  created_at: string;
  updated_at: string;
}

interface TagHistoryRow {
  id: string;
  prior_auto_tags: string[];
  new_auto_tags: string[];
  computed_at: string;
}

interface EventRow {
  id: string;
  name: string;
  payload: Record<string, unknown>;
  emitted_at: string;
}

type ActivityTab = "activity" | "orders" | "notes";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtRel(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function pickSegmentPills(autoTags: string[]): {
  label: string;
  tone: "accent" | "brand" | "success" | "warning" | "neutral";
}[] {
  const pills: {
    label: string;
    tone: "accent" | "brand" | "success" | "warning" | "neutral";
  }[] = [];
  if (autoTags.includes("vip")) pills.push({ label: "VIP", tone: "accent" });
  if (autoTags.includes("at-risk"))
    pills.push({ label: "At-risk", tone: "warning" });
  if (autoTags.includes("repeat"))
    pills.push({ label: "Repeat", tone: "brand" });
  if (autoTags.includes("new")) pills.push({ label: "New", tone: "success" });
  if (autoTags.includes("dormant"))
    pills.push({ label: "Dormant", tone: "neutral" });
  return pills.length > 0 ? pills : [{ label: "Unsegmented", tone: "neutral" }];
}

function eventLabel(ev: EventRow): {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone: "brand" | "success" | "warning" | "neutral";
} {
  switch (ev.name) {
    case "customer.created":
      return {
        icon: UserPlus,
        title: "Customer created",
        subtitle:
          typeof ev.payload.source === "string"
            ? `Source: ${ev.payload.source}`
            : "Manual entry",
        tone: "brand",
      };
    case "customer.updated":
      return {
        icon: Edit3,
        title: "Profile updated",
        subtitle: "Details edited",
        tone: "neutral",
      };
    case "customer.merged":
      return {
        icon: UserCheck,
        title: "Customer merged",
        subtitle: "Duplicate resolved",
        tone: "brand",
      };
    case "customer.tag_changed": {
      const added = Array.isArray(ev.payload.added_tags)
        ? (ev.payload.added_tags as string[])
        : [];
      const removed = Array.isArray(ev.payload.removed_tags)
        ? (ev.payload.removed_tags as string[])
        : [];
      const parts: string[] = [];
      if (added.length > 0) parts.push(`+${added.join(", ")}`);
      if (removed.length > 0) parts.push(`−${removed.join(", ")}`);
      return {
        icon: Tag,
        title: "Tags changed",
        subtitle: parts.join(" · ") || "Auto-tag recompute",
        tone: "neutral",
      };
    }
    default:
      return {
        icon: ShoppingBag,
        title: ev.name,
        subtitle: "Event",
        tone: "neutral",
      };
  }
}

const TONE_BG: Record<string, string> = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  success: "bg-status-success/10 text-status-success",
  warning: "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]",
  neutral:
    "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  pos: "POS",
  booking: "Booking",
  lead_conversion: "Lead conversion",
  csv_import: "CSV import",
  public_booking_page: "Public booking",
};

export default async function CustomerProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const activeTab: ActivityTab =
    tabParam === "orders" || tabParam === "notes" ? tabParam : "activity";

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
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Marketing CRM.
          </p>
        </CardBody>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select(
      "id, name, phone_e164, email, address, manual_tags, auto_tags, " +
        "notes, source, total_spend_myr, last_purchase_at, order_count, " +
        "aov_myr, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .eq("id", id)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .maybeSingle();

  if (error) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-status-danger">
            Failed to load customer: {error.message}
          </p>
        </CardBody>
      </Card>
    );
  }
  if (!customer) notFound();

  const c = customer as unknown as CustomerRow;
  const totalSpend =
    typeof c.total_spend_myr === "number"
      ? c.total_spend_myr
      : Number(c.total_spend_myr) || 0;
  const aov =
    c.aov_myr ?? (c.order_count > 0 ? totalSpend / c.order_count : 0);

  const [{ data: tagHistoryRaw }, { data: eventsRaw }] = await Promise.all([
    supabase
      .from("customer_tag_history")
      .select("id, prior_auto_tags, new_auto_tags, computed_at")
      .eq("business_id", user.businessId)
      .eq("customer_id", id)
      .order("computed_at", { ascending: false })
      .limit(5),
    supabase
      .from("events_outbox")
      .select("id, name, payload, emitted_at")
      .eq("business_id", user.businessId)
      .in("name", [
        "customer.created",
        "customer.updated",
        "customer.merged",
        "customer.tag_changed",
      ])
      .ilike("payload->>customer_id", id)
      .order("emitted_at", { ascending: false })
      .limit(8),
  ]);

  const tagHistory = (tagHistoryRaw ?? []) as unknown as TagHistoryRow[];
  let events = (eventsRaw ?? []) as unknown as EventRow[];
  if (events.length === 0) {
    events = [
      {
        id: "synth-created",
        name: "customer.created",
        payload: { source: c.source ?? "manual" },
        emitted_at: c.created_at,
      },
    ];
  }

  const segments = pickSegmentPills(c.auto_tags);

  const STAT_TILES: Array<{
    label: string;
    value: string;
    helper: string;
    tone: "brand" | "accent" | "neutral";
  }> = [
    {
      label: "Lifetime spend",
      value: formatMyr(totalSpend),
      helper:
        c.order_count > 0 ? `${c.order_count} orders` : "No orders yet",
      tone: "brand",
    },
    {
      label: "AOV",
      value: formatMyr(typeof aov === "number" ? aov : Number(aov) || 0),
      helper: "Avg order value",
      tone: "accent",
    },
    {
      label: "Orders",
      value: formatCount(c.order_count),
      helper: "Lifetime",
      tone: "neutral",
    },
    {
      label: "Last purchase",
      value: fmtRel(c.last_purchase_at),
      helper: c.last_purchase_at
        ? fmtDate(c.last_purchase_at)
        : "Never",
      tone: "neutral",
    },
  ];

  // Recommended actions are computed from segments + spend.
  const RECOMMENDED: Array<{
    icon: LucideIcon;
    label: string;
    sub: string;
    href: string;
    tone: "accent" | "brand" | "success" | "warning";
  }> = [];
  if (c.auto_tags.includes("at-risk")) {
    RECOMMENDED.push({
      icon: MessageCircle,
      label: "Send win-back",
      sub: "Personalised WhatsApp",
      href: c.phone_e164
        ? `https://wa.me/${c.phone_e164.replace(/[^\d]/g, "")}`
        : "#",
      tone: "warning",
    });
  }
  if (c.auto_tags.includes("vip") || totalSpend >= 1000) {
    RECOMMENDED.push({
      icon: Gift,
      label: "Send VIP perk",
      sub: "Reward loyalty",
      href: "/marketing/content/new",
      tone: "accent",
    });
  }
  if (c.auto_tags.includes("new")) {
    RECOMMENDED.push({
      icon: Sparkles,
      label: "Welcome offer",
      sub: "Boost first repeat",
      href: "/marketing/content/new",
      tone: "success",
    });
  }
  if (RECOMMENDED.length === 0) {
    RECOMMENDED.push({
      icon: Tag,
      label: "Tag this customer",
      sub: "Refine segmentation",
      href: "#edit",
      tone: "brand",
    });
  }
  // Always add a "schedule next visit" generic action.
  RECOMMENDED.push({
    icon: Edit3,
    label: "Add a note",
    sub: "Capture context",
    href: "#edit",
    tone: "brand",
  });

  const mayaInsight = c.auto_tags.includes("vip")
    ? `${c.name.split(" ")[0]} is one of your top spenders — ${formatMyr(totalSpend)} across ${c.order_count} orders. Schedule a personal follow-up and offer a VIP-only preview.`
    : c.auto_tags.includes("at-risk")
      ? `${c.name.split(" ")[0]} hasn't purchased recently. A small targeted offer (10–15% off) typically wins back ~28% of at-risk customers in this segment.`
      : c.auto_tags.includes("repeat")
        ? `${c.name.split(" ")[0]} buys consistently. Nurture into VIP with a loyalty perk — they're ${formatMyr(Math.max(0, 1000 - totalSpend))} away from VIP threshold.`
        : `Limited history for ${c.name.split(" ")[0]} so far. Send a welcome offer to convert into a repeat customer.`;

  const tabHref = (t: ActivityTab) =>
    `/marketing/customers/${id}${t === "activity" ? "" : `?tab=${t}`}`;

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/customers"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        All customers
      </Link>

      <PageHeader
        eyebrow="Marketing · Customers"
        title={c.name}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {c.phone_e164 ? (
              <a
                href={`https://wa.me/${c.phone_e164.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2} />
                WhatsApp
              </a>
            ) : null}
            <a
              href="#edit"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-600"
            >
              <Edit3 className="h-4 w-4" strokeWidth={2} />
              Edit profile
            </a>
          </div>
        }
      />

      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex h-18 w-18 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" style={{ height: "72px", width: "72px" }}>
              {initialsOf(c.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-ink dark:text-cream-100">
                {c.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {segments.map((seg) => (
                  <StatusPill key={seg.label} tone={seg.tone}>
                    {seg.label}
                  </StatusPill>
                ))}
                {c.phone_e164 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-muted dark:text-cream-400">
                    <Phone className="h-3 w-3" strokeWidth={2} />
                    {c.phone_e164}
                  </span>
                ) : null}
                {c.email ? (
                  <span className="text-xs text-ink-muted dark:text-cream-400">
                    · {c.email}
                  </span>
                ) : null}
                <span className="text-xs text-ink-muted dark:text-cream-400">
                  · Joined {fmtDate(c.created_at)}
                </span>
                {c.source ? (
                  <span className="text-xs text-ink-muted dark:text-cream-400">
                    · Source: {SOURCE_LABEL[c.source] ?? c.source}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <section
        aria-label="Customer stats"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        {STAT_TILES.map((s) => (
          <Card key={s.label}>
            <CardBody className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                {s.label}
              </p>
              <p
                className={`text-2xl font-bold ${
                  s.tone === "brand"
                    ? "text-brand-700 dark:text-brand-200"
                    : s.tone === "accent"
                      ? "text-accent-700 dark:text-accent-200"
                      : "text-ink dark:text-cream-100"
                }`}
              >
                {s.value}
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {s.helper}
              </p>
            </CardBody>
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start lg:gap-6">
        <SectionCard
          title="Activity"
          subtitle="Customer events, orders, and notes"
          className="lg:col-span-2"
          bodyClassName="space-y-3"
          action={
            <nav className="flex gap-1 rounded-lg bg-cream-100 p-0.5 text-[11px] font-semibold dark:bg-hairline-dark/40">
              {(["activity", "orders", "notes"] as const).map((t) => (
                <Link
                  key={t}
                  href={tabHref(t)}
                  className={`rounded-md px-3 py-1 capitalize ${
                    activeTab === t
                      ? "bg-white text-ink shadow-card dark:bg-panel-dark dark:text-cream-100"
                      : "text-ink-muted hover:text-ink dark:text-cream-400"
                  }`}
                >
                  {t}
                </Link>
              ))}
            </nav>
          }
        >
          {activeTab === "activity" ? (
            <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {events.map((ev) => {
                const meta = eventLabel(ev);
                return (
                  <div key={ev.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[meta.tone]}`}
                    >
                      <meta.icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                        {meta.title}
                      </p>
                      <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                        {meta.subtitle}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-ink-muted dark:text-cream-400">
                      {fmtRel(ev.emitted_at)}
                    </span>
                  </div>
                );
              })}
              {tagHistory.length > 0 ? (
                <div className="pt-3 text-xs text-ink-muted dark:text-cream-400">
                  <p className="mb-1.5 font-semibold uppercase tracking-wider">
                    Tag history
                  </p>
                  <ul className="space-y-1">
                    {tagHistory.map((h) => (
                      <li key={h.id} className="font-mono">
                        {fmtRel(h.computed_at)}: [
                        {h.prior_auto_tags.join(", ") || "—"}] → [
                        {h.new_auto_tags.join(", ") || "—"}]
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "orders" ? (
            c.order_count > 0 ? (
              <div className="rounded-lg bg-cream-100/40 p-4 text-sm text-ink dark:bg-hairline-dark/30 dark:text-cream-100">
                <p className="font-semibold">
                  {formatCount(c.order_count)} lifetime orders ·{" "}
                  {formatMyr(totalSpend)}
                </p>
                <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                  Per-order detail will appear here once Operations or POS
                  events sync. Today only customer-level aggregates are
                  available.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-cream-100/40 p-6 text-center dark:bg-hairline-dark/30">
                <ShoppingBag
                  className="mx-auto mb-2 h-6 w-6 text-ink-muted"
                  strokeWidth={1.5}
                />
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  No orders yet
                </p>
                <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                  Orders show here as soon as POS / Booking events flow.
                </p>
              </div>
            )
          ) : null}

          {activeTab === "notes" ? (
            c.notes && c.notes.trim().length > 0 ? (
              <div className="rounded-lg bg-cream-100/40 p-4 text-sm whitespace-pre-wrap text-ink dark:bg-hairline-dark/30 dark:text-cream-100">
                {c.notes}
              </div>
            ) : (
              <div className="rounded-lg bg-cream-100/40 p-6 text-center dark:bg-hairline-dark/30">
                <Edit3
                  className="mx-auto mb-2 h-6 w-6 text-ink-muted"
                  strokeWidth={1.5}
                />
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  No notes yet
                </p>
                <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                  Capture context, preferences, or follow-ups below.
                </p>
                <Link
                  href="#edit"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Edit3 className="h-3 w-3" strokeWidth={2} />
                  Add a note
                </Link>
              </div>
            )
          ) : null}
        </SectionCard>

        <div className="space-y-4 lg:space-y-6">
          <SectionCard title="Tags" subtitle="Auto + manual">
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                  Auto (Maya)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.auto_tags.length === 0 ? (
                    <span className="text-xs text-ink-subtle">None</span>
                  ) : (
                    c.auto_tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent-700 dark:bg-accent-700/20 dark:text-accent-200"
                      >
                        <Sparkles className="h-2.5 w-2.5" strokeWidth={2.25} />
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                  Manual
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.manual_tags.length === 0 ? (
                    <span className="text-xs text-ink-subtle">None yet</span>
                  ) : (
                    c.manual_tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full bg-cream-200 px-2.5 py-0.5 text-[11px] font-semibold text-ink dark:bg-hairline-dark dark:text-cream-100"
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="rounded-xl border border-accent-200 bg-accent-50 p-4 dark:border-accent-700/40 dark:bg-accent-700/15">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-200">
                  Maya AI · Insight
                </p>
                <p className="mt-1.5 text-sm text-ink dark:text-cream-100">
                  {mayaInsight}
                </p>
              </div>
            </div>
          </div>

          <SectionCard
            title="Recommended actions"
            subtitle="Suggested by Maya"
            bodyClassName="space-y-2"
          >
            {RECOMMENDED.map((act) => {
              const Tone =
                act.tone === "accent"
                  ? "bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200"
                  : act.tone === "warning"
                    ? "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]"
                    : act.tone === "success"
                      ? "bg-status-success/10 text-status-success"
                      : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200";
              const Component = act.href.startsWith("http") ? "a" : Link;
              return (
                <Component
                  key={act.label}
                  href={act.href}
                  {...(act.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="flex items-center gap-3 rounded-lg border border-cream-200 p-2.5 transition-colors hover:bg-cream-100/60 dark:border-hairline-dark dark:hover:bg-hairline-dark/30"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${Tone}`}
                  >
                    <act.icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                      {act.label}
                    </p>
                    <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                      {act.sub}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-3.5 w-3.5 text-ink-subtle"
                    strokeWidth={2}
                  />
                </Component>
              );
            })}
          </SectionCard>

          <SectionCard title="Details" subtitle="Profile metadata">
            <dl className="space-y-2.5 text-sm">
              {[
                ["Phone", c.phone_e164 ?? "—"],
                ["Email", c.email ?? "—"],
                ["Address", c.address ?? "—"],
                [
                  "Source",
                  c.source ? (SOURCE_LABEL[c.source] ?? c.source) : "—",
                ],
                ["Created", fmtDate(c.created_at)],
                ["Updated", fmtRel(c.updated_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3">
                  <dt className="text-ink-muted dark:text-cream-400">{k}</dt>
                  <dd className="break-words text-right font-medium text-ink dark:text-cream-100">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        </div>
      </div>

      <div id="edit" className="scroll-mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
          Edit details
        </h2>
        <CustomerForm
          mode="edit-full"
          initial={{
            id: c.id,
            name: c.name,
            phone_e164: c.phone_e164,
            email: c.email,
            address: c.address,
            manual_tags: c.manual_tags,
            notes: c.notes,
          }}
        />
      </div>
    </div>
  );
}
