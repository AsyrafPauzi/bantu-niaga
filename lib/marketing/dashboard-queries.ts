/**
 * Bantu Niaga — Marketing dashboard aggregation helpers.
 *
 * Server-side, RLS-scoped reads that power the /marketing landing
 * dashboard (KPI tiles, charts, top-N lists, activity feed). Each
 * helper takes the SSR Supabase client (so RLS scopes the read to the
 * caller's business automatically) and returns a clean shape ready
 * for the chart / list components.
 *
 * Design rules:
 *   - Never throws. On error return a sensible empty default + the
 *     caller renders an empty-state friendly card.
 *   - Always returns plain JS shapes (numbers, strings, dates as ISO
 *     strings) — no Supabase response wrappers.
 *   - Reads existing M1–M6 tables and views only; no new migrations.
 *
 * @see supabase/migrations/00000000000007_marketing_m6.sql
 *      for `customer_analytics_v1` and `marketing_kpi_snapshot`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  coerceKpiSnapshot,
  type KpiSnapshot,
  type KpiSnapshotRaw,
} from "@/lib/marketing/metrics";
import { SEGMENT_COLORS, type SegmentKey } from "@/lib/marketing/dashboard-colors";

type Supabase = SupabaseClient;

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function toNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/** Returns ISO yyyy-mm-dd in MYT for a Date. */
function isoDayMyt(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

// ─────────────────────────────────────────────────────────────────────
// 1. KPI snapshot — wraps the M6 RPC + view fallback.
// ─────────────────────────────────────────────────────────────────────

export interface KpiSnapshotResult extends KpiSnapshot {
  totalCustomers: number;
  newThisMonth: number;
  vipCount: number;
  dormantCount: number;
  atRiskCount: number;
  repeatCount: number;
  totalSpendMyr: number;
  avgAovMyr: number;
}

export async function getKpiSnapshot(
  supabase: Supabase,
  businessId: string,
): Promise<KpiSnapshotResult> {
  const { data, error } = await supabase.rpc("marketing_kpi_snapshot", {
    p_business_id: businessId,
  });

  let snapshot: KpiSnapshot;
  if (error) {
    snapshot = coerceKpiSnapshot(null);
  } else {
    const row: KpiSnapshotRaw | null = Array.isArray(data)
      ? ((data[0] as KpiSnapshotRaw | undefined) ?? null)
      : ((data as KpiSnapshotRaw | null | undefined) ?? null);
    snapshot = coerceKpiSnapshot(row);
  }

  return {
    ...snapshot,
    totalCustomers: snapshot.total_customers,
    newThisMonth: snapshot.new_this_month,
    vipCount: snapshot.vip_count,
    dormantCount: snapshot.dormant_count,
    atRiskCount: snapshot.at_risk_count,
    repeatCount: snapshot.repeat_count,
    totalSpendMyr: snapshot.total_spend_myr_sum,
    avgAovMyr: snapshot.avg_aov_myr,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 2. KPI deltas — change vs same period last month.
// ─────────────────────────────────────────────────────────────────────

export interface KpiDeltas {
  totalCustomersDelta: number;
  totalSpendDelta: number;
  orderCountDelta: number;
  aovDelta: number;
}

/**
 * Reads `customers` rows (RLS-scoped) and computes simple deltas:
 *   - totalCustomersDelta: customers created this month minus the
 *     previous month's count.
 *   - totalSpendDelta / orderCountDelta / aovDelta: same-shape deltas
 *     using `created_at` as a coarse "added this month" axis. (Real
 *     transactional deltas wait on Finance / Operations events; this
 *     proxy is intentionally lightweight and surfaces a directional
 *     signal until those land.)
 *
 * Returns zero deltas on any error.
 */
export async function getKpiDeltas(
  supabase: Supabase,
  _businessId: string,
): Promise<KpiDeltas> {
  void _businessId;
  const now = new Date();
  const startOfThisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const startOfPrevMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  const { data, error } = await supabase
    .from("customers")
    .select("created_at, total_spend_myr, order_count")
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .gte("created_at", startOfPrevMonth.toISOString());

  if (error || !data) {
    return {
      totalCustomersDelta: 0,
      totalSpendDelta: 0,
      orderCountDelta: 0,
      aovDelta: 0,
    };
  }

  const thisMonth = data.filter(
    (r) => new Date(String(r.created_at)) >= startOfThisMonth,
  );
  const prevMonth = data.filter(
    (r) => new Date(String(r.created_at)) < startOfThisMonth,
  );

  const sumSpend = (rows: typeof data) =>
    rows.reduce((s, r) => s + toNum(r.total_spend_myr), 0);
  const sumOrders = (rows: typeof data) =>
    rows.reduce((s, r) => s + toNum(r.order_count), 0);

  const thisSpend = sumSpend(thisMonth);
  const prevSpend = sumSpend(prevMonth);
  const thisOrders = sumOrders(thisMonth);
  const prevOrders = sumOrders(prevMonth);

  const thisAov = thisOrders > 0 ? thisSpend / thisOrders : 0;
  const prevAov = prevOrders > 0 ? prevSpend / prevOrders : 0;

  return {
    totalCustomersDelta: thisMonth.length - prevMonth.length,
    totalSpendDelta: thisSpend - prevSpend,
    orderCountDelta: thisOrders - prevOrders,
    aovDelta: thisAov - prevAov,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 3. Customer growth time series — last N months.
// ─────────────────────────────────────────────────────────────────────

export interface GrowthPoint {
  month: string;
  monthLabel: string;
  total: number;
  newAdditions: number;
}

export async function getCustomerGrowthSeries(
  supabase: Supabase,
  _businessId: string,
  months = 12,
): Promise<GrowthPoint[]> {
  void _businessId;
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1),
  );

  const { data, error } = await supabase
    .from("customers")
    .select("created_at")
    .is("merged_into_id", null);

  if (error || !data) {
    return seriesScaffold(now, months).map((p) => ({
      ...p,
      total: 0,
      newAdditions: 0,
    }));
  }

  const buckets = new Map<string, number>();
  let baselineBeforeWindow = 0;
  for (const row of data) {
    const created = new Date(String(row.created_at));
    if (Number.isNaN(created.valueOf())) continue;
    if (created < cutoff) {
      baselineBeforeWindow += 1;
      continue;
    }
    const key = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const scaffold = seriesScaffold(now, months);
  let running = baselineBeforeWindow;
  return scaffold.map((point) => {
    const newAdditions = buckets.get(point.month) ?? 0;
    running += newAdditions;
    return { ...point, total: running, newAdditions };
  });
}

function seriesScaffold(
  now: Date,
  months: number,
): { month: string; monthLabel: string }[] {
  const out: { month: string; monthLabel: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("en-MY", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
    out.push({ month, monthLabel });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// 4. Segment breakdown for the donut chart.
// ─────────────────────────────────────────────────────────────────────

export interface SegmentSlice {
  segment: SegmentKey;
  label: string;
  count: number;
  pct: number;
  color: string;
}

const SEGMENT_LABEL: Record<SegmentKey, string> = {
  vip: "VIP",
  repeat: "Repeat",
  new: "New",
  dormant: "Dormant",
  at_risk: "At-risk",
};

export async function getSegmentBreakdown(
  supabase: Supabase,
  _businessId: string,
): Promise<SegmentSlice[]> {
  void _businessId;
  const { data, error } = await supabase
    .from("customers")
    .select("auto_tags")
    .is("deleted_at", null)
    .is("merged_into_id", null);

  const counts: Record<SegmentKey, number> = {
    vip: 0,
    repeat: 0,
    new: 0,
    dormant: 0,
    at_risk: 0,
  };

  let totalTagged = 0;
  if (!error && data) {
    for (const row of data) {
      const tags = Array.isArray(row.auto_tags) ? (row.auto_tags as string[]) : [];
      let counted = false;
      if (tags.includes("vip")) {
        counts.vip += 1;
        counted = true;
      }
      if (tags.includes("repeat")) {
        counts.repeat += 1;
        counted = true;
      }
      if (tags.includes("new")) {
        counts.new += 1;
        counted = true;
      }
      if (tags.includes("dormant")) {
        counts.dormant += 1;
        counted = true;
      }
      if (tags.includes("at-risk")) {
        counts.at_risk += 1;
        counted = true;
      }
      if (counted) totalTagged += 1;
    }
  }

  const segments: SegmentKey[] = ["vip", "repeat", "new", "dormant", "at_risk"];
  return segments.map((s) => ({
    segment: s,
    label: SEGMENT_LABEL[s],
    count: counts[s],
    pct: pct(counts[s], totalTagged),
    color: SEGMENT_COLORS[s],
  }));
}

// ─────────────────────────────────────────────────────────────────────
// 5. Top customers by total spend.
// ─────────────────────────────────────────────────────────────────────

export interface TopCustomerRow {
  id: string;
  name: string;
  phone_e164: string | null;
  total_spend_myr: number;
  order_count: number;
  auto_tags: string[];
}

export async function getTopCustomers(
  supabase: Supabase,
  _businessId: string,
  limit = 5,
): Promise<TopCustomerRow[]> {
  void _businessId;
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone_e164, total_spend_myr, order_count, auto_tags")
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .order("total_spend_myr", { ascending: false })
    .order("order_count", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    phone_e164: r.phone_e164 ? String(r.phone_e164) : null,
    total_spend_myr: toNum(r.total_spend_myr),
    order_count: toNum(r.order_count),
    auto_tags: Array.isArray(r.auto_tags) ? (r.auto_tags as string[]) : [],
  }));
}

// ─────────────────────────────────────────────────────────────────────
// 6. Upcoming content — next N days of scheduled / drafted posts.
// ─────────────────────────────────────────────────────────────────────

export interface UpcomingContentRow {
  id: string;
  hook: string | null;
  channel: "tiktok" | "instagram" | "facebook";
  status: "idea" | "drafted" | "scheduled" | "posted";
  scheduled_at: string | null;
}

export async function getUpcomingContent(
  supabase: Supabase,
  _businessId: string,
  days = 7,
): Promise<UpcomingContentRow[]> {
  void _businessId;
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * MS_PER_DAY);

  const { data, error } = await supabase
    .from("content_plan")
    .select("id, hook, channel, status, scheduled_at")
    .in("status", ["scheduled", "drafted"])
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", cutoff.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (error || !data) return [];

  return data.map((r) => ({
    id: String(r.id),
    hook: r.hook ? String(r.hook) : null,
    channel: r.channel as UpcomingContentRow["channel"],
    status: r.status as UpcomingContentRow["status"],
    scheduled_at: r.scheduled_at ? String(r.scheduled_at) : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// 7. Recent activity — last N customer.* events.
// ─────────────────────────────────────────────────────────────────────

const ACTIVITY_EVENT_NAMES = [
  "customer.created",
  "customer.updated",
  "customer.merged",
  "customer.tag_changed",
  "customer.deleted",
] as const;

export interface ActivityRow {
  id: string;
  event_name: string;
  payload: Record<string, unknown>;
  created_at: string;
  summary: string;
}

export async function getRecentActivity(
  supabase: Supabase,
  _businessId: string,
  limit = 8,
): Promise<ActivityRow[]> {
  void _businessId;
  const { data, error } = await supabase
    .from("events_outbox")
    .select("id, name, payload, emitted_at")
    .in("name", ACTIVITY_EVENT_NAMES as unknown as string[])
    .order("emitted_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((r) => {
    const payload =
      r.payload && typeof r.payload === "object"
        ? (r.payload as Record<string, unknown>)
        : {};
    return {
      id: String(r.id),
      event_name: String(r.name),
      payload,
      created_at: String(r.emitted_at),
      summary: summarizeEvent(String(r.name), payload),
    };
  });
}

function summarizeEvent(
  name: string,
  payload: Record<string, unknown>,
): string {
  const customerName =
    typeof payload.customer_name === "string" ? payload.customer_name : null;
  const ref = customerName ? ` for ${customerName}` : "";

  switch (name) {
    case "customer.created":
      return customerName
        ? `Created customer ${customerName}`
        : "Created a customer";
    case "customer.updated":
      return `Updated customer${ref}`;
    case "customer.merged":
      return `Merged customers${ref}`;
    case "customer.tag_changed": {
      const added =
        Array.isArray(payload.added_tags) && payload.added_tags.length > 0
          ? (payload.added_tags as string[]).join(", ")
          : null;
      const removed =
        Array.isArray(payload.removed_tags) && payload.removed_tags.length > 0
          ? (payload.removed_tags as string[]).join(", ")
          : null;
      if (added && removed) {
        return `Tag changed${ref}: +${added} / −${removed}`;
      }
      if (added) return `Tag added${ref}: ${added}`;
      if (removed) return `Tag removed${ref}: ${removed}`;
      return `Tag changed${ref}`;
    }
    case "customer.deleted":
      return `Deleted a customer${ref}`;
    default:
      return name;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 8. Spend distribution buckets.
// ─────────────────────────────────────────────────────────────────────

export interface SpendBucket {
  bucket: string;
  count: number;
}

const SPEND_BUCKETS: ReadonlyArray<{
  label: string;
  test: (spend: number) => boolean;
}> = [
  { label: "RM 0", test: (s) => s <= 0 },
  { label: "RM 1–99", test: (s) => s > 0 && s < 100 },
  { label: "RM 100–499", test: (s) => s >= 100 && s < 500 },
  { label: "RM 500–999", test: (s) => s >= 500 && s < 1000 },
  { label: "RM 1k–4.9k", test: (s) => s >= 1000 && s < 5000 },
  { label: "RM 5k+", test: (s) => s >= 5000 },
];

export async function getSpendDistribution(
  supabase: Supabase,
  _businessId: string,
): Promise<SpendBucket[]> {
  void _businessId;
  const { data, error } = await supabase
    .from("customers")
    .select("total_spend_myr")
    .is("deleted_at", null)
    .is("merged_into_id", null);

  const counts = new Array<number>(SPEND_BUCKETS.length).fill(0);
  if (!error && data) {
    for (const row of data) {
      const spend = toNum(row.total_spend_myr);
      const idx = SPEND_BUCKETS.findIndex((b) => b.test(spend));
      if (idx !== -1) counts[idx] += 1;
    }
  }

  return SPEND_BUCKETS.map((b, i) => ({ bucket: b.label, count: counts[i] }));
}

// ─────────────────────────────────────────────────────────────────────
// 9. 7-day sparkline series — used by the big KPI tiles.
// ─────────────────────────────────────────────────────────────────────

export interface SparkPoint {
  day: string;
  value: number;
}

/**
 * Daily customer-creation count for the last 7 days. Used as a tiny
 * trend visual inside the KpiTileBig stripe.
 */
export async function getNewCustomersSparkline(
  supabase: Supabase,
  _businessId: string,
  days = 7,
): Promise<SparkPoint[]> {
  void _businessId;
  const now = new Date();
  const cutoff = new Date(now.getTime() - (days - 1) * MS_PER_DAY);

  const { data, error } = await supabase
    .from("customers")
    .select("created_at")
    .gte("created_at", cutoff.toISOString())
    .is("merged_into_id", null);

  const buckets = new Map<string, number>();
  if (!error && data) {
    for (const row of data) {
      const d = new Date(String(row.created_at));
      if (Number.isNaN(d.valueOf())) continue;
      const key = isoDayMyt(d);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  const out: SparkPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * MS_PER_DAY);
    const key = isoDayMyt(d);
    out.push({ day: key, value: buckets.get(key) ?? 0 });
  }
  return out;
}
