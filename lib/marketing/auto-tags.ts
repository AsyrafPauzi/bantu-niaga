/**
 * Bantu Niaga — Marketing M4 auto-segmentation: pure threshold rules.
 *
 * Mirrors `public.marketing_compute_auto_tags(...)` in SQL exactly. Used
 * by the apply-tags Edge Function for in-TS reasoning (e.g. test mirrors,
 * future client-side preview chips), and by the test suite to validate
 * the SQL implementation matches.
 *
 * Decisions doc Q1: thresholds are hard-coded in v1; per-business
 * overrides are explicitly v2. Do NOT introduce a settings table here.
 *
 * Plan §6.4 — canonical rules (the five tags):
 *
 *   new      ← last_purchase_at within last 30 days AND order_count <= 1
 *   repeat   ← order_count >= 2
 *   vip      ← total_spend_myr >= 1000 OR order_count >= 10
 *   dormant  ← last_purchase_at IS NOT NULL AND last_purchase_at older
 *              than 90 days
 *   at-risk  ← currently or previously engaged (order_count >= 2 OR
 *              total_spend_myr >= 1000 OR order_count >= 10) AND
 *              last_purchase_at older than 60 days but newer-or-equal
 *              to 90 days.
 *
 * Deviation from plan pseudocode §6.5: the `at-risk` rule in the plan
 * keys off the *prior* tag set ("was 'repeat' or 'vip'"). The SQL
 * compute function is pure (no reads), so we substitute the engagement
 * condition that would have made the customer repeat / vip at any
 * point — `order_count`, `total_spend_myr`, are monotonically
 * non-decreasing in v1 (no refunds yet), so checking the *current*
 * thresholds is equivalent to "was repeat or vip" and avoids reading
 * `customer_tag_history`.
 *
 * Returns a sorted unique text[] so equality checks vs the stored
 * `customers.auto_tags` (also stored sorted) are stable.
 */

export const AUTO_TAGS = ["new", "repeat", "vip", "dormant", "at-risk"] as const;
export type AutoTag = (typeof AUTO_TAGS)[number];

/**
 * Threshold constants exported so TagBadge styling, plan docs, and the
 * smoke / backfill scripts can reference one source of truth.
 *
 * Whenever these change, mirror them in the SQL function in
 * `supabase/migrations/00000000000006_marketing_m4.sql`.
 */
export const AUTO_TAG_THRESHOLDS = {
  NEW_DAYS: 30,
  REPEAT_ORDER_COUNT: 2,
  VIP_TOTAL_SPEND_MYR: 1000,
  VIP_ORDER_COUNT: 10,
  DORMANT_DAYS: 90,
  AT_RISK_MIN_DAYS: 60,
  AT_RISK_MAX_DAYS: 90,
} as const;

export interface AutoTagInput {
  /** Customer creation time (ISO string, Date, or null). */
  created_at: string | Date | null;
  /** Customer order count. */
  order_count: number;
  /** Customer total spend in MYR. */
  total_spend_myr: number;
  /** Last purchase time, or null when no purchase has happened yet. */
  last_purchase_at: string | Date | null;
}

const MS_PER_DAY = 86_400_000;

function toDate(value: string | Date | null): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Pure compute. Deterministic for a given (input, now) pair. Callers
 * pass `now = new Date()` in production; tests freeze it.
 *
 * Returns a sorted, deduplicated string[] of auto-tag labels. Empty
 * array is a valid result (e.g. a never-purchased customer created
 * more than 30 days ago has no auto-tags).
 */
export function computeAutoTags(
  input: AutoTagInput,
  now: Date = new Date(),
): string[] {
  const lastPurchase = toDate(input.last_purchase_at);
  const orderCount = Math.max(0, Math.floor(input.order_count));
  const totalSpend = Number.isFinite(input.total_spend_myr)
    ? input.total_spend_myr
    : 0;
  const daysSinceLast =
    lastPurchase !== null
      ? (now.getTime() - lastPurchase.getTime()) / MS_PER_DAY
      : Number.POSITIVE_INFINITY;

  const out = new Set<string>();

  if (orderCount >= AUTO_TAG_THRESHOLDS.REPEAT_ORDER_COUNT) {
    out.add("repeat");
  }

  if (
    totalSpend >= AUTO_TAG_THRESHOLDS.VIP_TOTAL_SPEND_MYR ||
    orderCount >= AUTO_TAG_THRESHOLDS.VIP_ORDER_COUNT
  ) {
    out.add("vip");
  }

  if (lastPurchase !== null && daysSinceLast > AUTO_TAG_THRESHOLDS.DORMANT_DAYS) {
    out.add("dormant");
  }

  const wasEngaged =
    orderCount >= AUTO_TAG_THRESHOLDS.REPEAT_ORDER_COUNT ||
    totalSpend >= AUTO_TAG_THRESHOLDS.VIP_TOTAL_SPEND_MYR ||
    orderCount >= AUTO_TAG_THRESHOLDS.VIP_ORDER_COUNT;

  if (
    wasEngaged &&
    lastPurchase !== null &&
    daysSinceLast > AUTO_TAG_THRESHOLDS.AT_RISK_MIN_DAYS &&
    daysSinceLast <= AUTO_TAG_THRESHOLDS.AT_RISK_MAX_DAYS
  ) {
    out.add("at-risk");
  }

  if (
    lastPurchase !== null &&
    daysSinceLast < AUTO_TAG_THRESHOLDS.NEW_DAYS &&
    orderCount <= 1
  ) {
    out.add("new");
  }

  return Array.from(out).sort();
}

/**
 * Array equality helper used by the apply / backfill paths to decide
 * whether to write a history row + emit `customer.tag_changed`.
 *
 * Inputs are assumed sorted (both `computeAutoTags` and the SQL
 * `marketing_compute_auto_tags` return sorted arrays).
 */
export function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Diff helper for emitting `customer.tag_changed`. Inputs sorted.
 */
export function tagSetDiff(
  prior: readonly string[],
  next: readonly string[],
): { added: string[]; removed: string[] } {
  const priorSet = new Set(prior);
  const nextSet = new Set(next);
  const added: string[] = [];
  const removed: string[] = [];
  for (const t of next) {
    if (!priorSet.has(t)) added.push(t);
  }
  for (const t of prior) {
    if (!nextSet.has(t)) removed.push(t);
  }
  return { added, removed };
}
