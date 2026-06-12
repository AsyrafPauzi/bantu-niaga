/**
 * Bantu Niaga — Marketing M6 metric helpers.
 *
 * Tiny pure helpers shared by the /marketing landing KPI page, smoke
 * tests, and any future analytics surface. The heavy lifting (segment
 * counts) lives in `public.customer_analytics_v1` + the
 * `marketing_kpi_snapshot(business_id)` RPC; this module is just
 * formatting + a typed shape for the dashboard.
 *
 * @see supabase/migrations/00000000000007_marketing_m6.sql
 */

/**
 * Shape returned by the `marketing_kpi_snapshot` RPC. Mirrors the SQL
 * column types: counts come back as `bigint` (string in JS-land via
 * Supabase JS / postgrest-js), numerics as strings. We coerce both to
 * `number` at the boundary in `coerceKpiSnapshot`.
 */
export interface KpiSnapshotRaw {
  total_customers: number | string;
  new_this_month: number | string;
  vip_count: number | string;
  dormant_count: number | string;
  at_risk_count: number | string;
  repeat_count: number | string;
  new_count: number | string;
  total_spend_myr_sum: number | string;
  avg_aov_myr: number | string;
}

export interface KpiSnapshot {
  total_customers: number;
  new_this_month: number;
  vip_count: number;
  dormant_count: number;
  at_risk_count: number;
  repeat_count: number;
  new_count: number;
  total_spend_myr_sum: number;
  avg_aov_myr: number;
}

function toNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Normalize a raw RPC row into a typed snapshot. Returns the all-zero
 * snapshot when the input is `null`/`undefined` (the LEFT JOIN in the
 * RPC means every business gets a row, so this is mostly for
 * defensive typing on the caller side).
 */
export function coerceKpiSnapshot(
  raw: KpiSnapshotRaw | null | undefined,
): KpiSnapshot {
  if (!raw) {
    return {
      total_customers: 0,
      new_this_month: 0,
      vip_count: 0,
      dormant_count: 0,
      at_risk_count: 0,
      repeat_count: 0,
      new_count: 0,
      total_spend_myr_sum: 0,
      avg_aov_myr: 0,
    };
  }
  return {
    total_customers: toNum(raw.total_customers),
    new_this_month: toNum(raw.new_this_month),
    vip_count: toNum(raw.vip_count),
    dormant_count: toNum(raw.dormant_count),
    at_risk_count: toNum(raw.at_risk_count),
    repeat_count: toNum(raw.repeat_count),
    new_count: toNum(raw.new_count),
    total_spend_myr_sum: toNum(raw.total_spend_myr_sum),
    avg_aov_myr: toNum(raw.avg_aov_myr),
  };
}

/**
 * Compute Average Order Value from totals. Pure; mirrors the
 * `customers.aov_myr` generated column logic at the per-customer level
 * but applied to whatever totals the caller has.
 */
export function computeAovMyr(
  totalSpendMyr: number,
  orderCount: number,
): number {
  if (!Number.isFinite(totalSpendMyr) || !Number.isFinite(orderCount)) return 0;
  if (orderCount <= 0) return 0;
  return totalSpendMyr / orderCount;
}

/**
 * Format an integer count for KPI cards. Renders the M6 zeros honestly
 * ("0" rather than "—") because zeros are real signal once events
 * start flowing.
 */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const n = Math.max(0, Math.floor(value));
  return n.toLocaleString("en-MY");
}

/**
 * Format an MYR amount for KPI cards / detail panes.
 */
export function formatMyr(value: number): string {
  if (!Number.isFinite(value)) return "RM 0.00";
  return `RM ${value.toFixed(2)}`;
}
