/**
 * Bantu Niaga — Marketing v1.1 coupons server-side helpers.
 *
 * Server-only: do NOT import from client components. (The client-side
 * "Generate" button gets its own pure code generator below; the rest
 * of this file expects a Supabase client.)
 *
 * Exports:
 *   - validateCoupon  — read-only check; returns the discount + coupon row
 *                       on success, or a typed failure reason.
 *   - redeemCoupon    — writes a coupon_redemptions row + atomically bumps
 *                       coupons.redeemed_count. Idempotent on
 *                       (coupon_id, order_ref) when order_ref is provided.
 *   - generateCouponCode — readable alphanumeric codes (no I/O/0/1).
 *
 * Failure-reason vocabulary (spec §4):
 *   not_found | paused | expired | not_yet_active | min_subtotal |
 *   total_limit_reached | per_customer_limit_reached | segment_mismatch
 *
 * The validate path uses the caller's authenticated supabase client so
 * RLS scopes the lookup to the caller's business. The redeem path
 * accepts a service-role client so the cross-tenant counter bump is
 * safe even when called from an unauthenticated edge worker; the API
 * routes pass the caller's authenticated client because the RLS
 * policies already permit owner/manager/cashier writes.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyRulesToCustomersQuery,
  type CustomersQueryLike,
} from "@/lib/marketing/segments-rules";
import { rulesForSegment, type SegmentRow } from "@/lib/marketing/segments";
import { generateCouponCode } from "@/lib/marketing/coupon-code";

export { generateCouponCode };

// ─────────────────────────────────────────────────────────────────────────
// Row shapes
// ─────────────────────────────────────────────────────────────────────────

export type CouponType = "PCT" | "AMT";
export type CouponStatus = "active" | "paused" | "expired";

export interface CouponRow {
  id: string;
  business_id: string;
  code: string;
  name: string | null;
  type: CouponType;
  value: number;
  min_subtotal_myr: number;
  valid_from: string;
  valid_until: string | null;
  total_limit: number | null;
  per_customer_limit: number;
  segment_id: string | null;
  status: CouponStatus;
  redeemed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CouponRedemptionRow {
  id: string;
  coupon_id: string;
  customer_id: string | null;
  order_ref: string | null;
  discount_amount_myr: number;
  redeemed_by: string | null;
  redeemed_at: string;
}

export type CouponFailureReason =
  | "not_found"
  | "paused"
  | "expired"
  | "not_yet_active"
  | "min_subtotal"
  | "total_limit_reached"
  | "per_customer_limit_reached"
  | "segment_mismatch";

export type CouponValidateResult =
  | { ok: true; coupon: CouponRow; discount_myr: number }
  | { ok: false; reason: CouponFailureReason; coupon?: CouponRow };

const COUPON_SELECT =
  "id, business_id, code, name, type, value, min_subtotal_myr, valid_from, " +
  "valid_until, total_limit, per_customer_limit, segment_id, status, " +
  "redeemed_count, created_by, created_at, updated_at, deleted_at";

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute the discount amount in MYR for a given coupon + subtotal.
 *
 * - PCT: subtotal × (value / 100), rounded to 2dp.
 * - AMT: min(value, subtotal) — never exceed the subtotal so we don't
 *   produce a negative-total cart.
 *
 * Returns 0 when subtotal is non-positive (defensive — the caller
 * already short-circuits on `min_subtotal` before reaching here).
 */
export function computeDiscountMyr(
  coupon: Pick<CouponRow, "type" | "value">,
  subtotalMyr: number,
): number {
  if (!Number.isFinite(subtotalMyr) || subtotalMyr <= 0) return 0;
  if (coupon.type === "PCT") {
    const raw = subtotalMyr * (coupon.value / 100);
    return Math.round(raw * 100) / 100;
  }
  return Math.min(coupon.value, subtotalMyr);
}

/**
 * Coerce the supabase-js result row (which may be typed as
 * GenericStringError when the schema can't be inferred — e.g. from
 * dynamic select strings) into a CouponRedemptionRow with the numeric
 * discount value as a JS number.
 */
function coerceRedemption(raw: unknown): CouponRedemptionRow {
  const row = raw as Record<string, unknown>;
  return {
    id: row.id as string,
    coupon_id: row.coupon_id as string,
    customer_id: (row.customer_id ?? null) as string | null,
    order_ref: (row.order_ref ?? null) as string | null,
    discount_amount_myr: Number(row.discount_amount_myr ?? 0),
    redeemed_by: (row.redeemed_by ?? null) as string | null,
    redeemed_at: row.redeemed_at as string,
  };
}

/**
 * Coerce the numeric / timestamp columns supabase-js returns as strings
 * (numeric) or strings (timestamptz, ISO) into the shapes the rest of
 * the helper expects. Pass-through for already-coerced rows.
 */
function coerceCoupon(raw: Record<string, unknown> | null): CouponRow | null {
  if (!raw) return null;
  return {
    id: raw.id as string,
    business_id: raw.business_id as string,
    code: raw.code as string,
    name: (raw.name ?? null) as string | null,
    type: raw.type as CouponType,
    value: Number(raw.value),
    min_subtotal_myr: Number(raw.min_subtotal_myr ?? 0),
    valid_from: raw.valid_from as string,
    valid_until: (raw.valid_until ?? null) as string | null,
    total_limit:
      raw.total_limit === null || raw.total_limit === undefined
        ? null
        : Number(raw.total_limit),
    per_customer_limit: Number(raw.per_customer_limit ?? 1),
    segment_id: (raw.segment_id ?? null) as string | null,
    status: raw.status as CouponStatus,
    redeemed_count: Number(raw.redeemed_count ?? 0),
    created_by: (raw.created_by ?? null) as string | null,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    deleted_at: (raw.deleted_at ?? null) as string | null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// validateCoupon
// ─────────────────────────────────────────────────────────────────────────

export interface ValidateCouponInput {
  supabase: SupabaseClient;
  businessId: string;
  code: string;
  customerId?: string | null;
  subtotalMyr: number;
  /** Override the clock for tests + deterministic UTC math. */
  now?: Date;
}

/**
 * Read-only coupon validation. Loads the coupon by case-insensitive
 * code lookup, then runs every spec §4 failure check in priority
 * order. Returns the discount on success; a typed failure reason
 * otherwise.
 *
 * Reason priority (matches the order an SME would expect to see the
 * error in the UI):
 *   not_found → paused → expired → not_yet_active → min_subtotal →
 *   total_limit_reached → per_customer_limit_reached → segment_mismatch
 */
export async function validateCoupon(
  input: ValidateCouponInput,
): Promise<CouponValidateResult> {
  const { supabase, businessId, code, customerId, subtotalMyr } = input;
  const now = input.now ?? new Date();

  // Lookup by lowercased code. We can't rely on the unique index alone
  // because supabase-js doesn't expose .ilike for exact-match in a
  // way that hits the functional index reliably; do the lower() in the
  // app and use .eq on the raw column with a case-insensitive filter.
  // PostgREST `.ilike` on the equality form does the right thing here.
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, reason: "not_found" };
  }

  const { data: rawData, error } = await supabase
    .from("coupons")
    .select(COUPON_SELECT)
    .eq("business_id", businessId)
    .ilike("code", trimmed)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`coupon lookup failed: ${error.message}`);
  }
  const coupon = coerceCoupon(rawData as Record<string, unknown> | null);
  if (!coupon) {
    return { ok: false, reason: "not_found" };
  }

  if (coupon.status === "paused") {
    return { ok: false, reason: "paused", coupon };
  }

  // Expired by status OR by valid_until in the past. We trust the DB
  // type for valid_until (timestamptz, ISO string from PostgREST).
  const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;
  if (
    coupon.status === "expired" ||
    (validUntil !== null && validUntil.getTime() <= now.getTime())
  ) {
    return { ok: false, reason: "expired", coupon };
  }

  const validFrom = new Date(coupon.valid_from);
  if (validFrom.getTime() > now.getTime()) {
    return { ok: false, reason: "not_yet_active", coupon };
  }

  if (subtotalMyr < coupon.min_subtotal_myr) {
    return { ok: false, reason: "min_subtotal", coupon };
  }

  if (
    coupon.total_limit !== null &&
    coupon.redeemed_count >= coupon.total_limit
  ) {
    return { ok: false, reason: "total_limit_reached", coupon };
  }

  if (coupon.per_customer_limit > 0 && customerId) {
    const { count, error: limitErr } = await supabase
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("customer_id", customerId);
    if (limitErr) {
      throw new Error(
        `per-customer-limit check failed: ${limitErr.message}`,
      );
    }
    if ((count ?? 0) >= coupon.per_customer_limit) {
      return { ok: false, reason: "per_customer_limit_reached", coupon };
    }
  }

  if (coupon.segment_id && customerId) {
    const isMember = await isCustomerInSegment(
      supabase,
      coupon.segment_id,
      customerId,
    );
    if (!isMember) {
      return { ok: false, reason: "segment_mismatch", coupon };
    }
  }

  const discount_myr = computeDiscountMyr(coupon, subtotalMyr);
  return { ok: true, coupon, discount_myr };
}

/**
 * Probe whether `customerId` matches the rules of `segmentId`.
 *
 * Loads the segment under the caller's RLS scope (so cross-tenant
 * lookups silently miss), compiles its rules into a customers query,
 * and asks Postgres for `count('*')` filtered by id. A non-zero count
 * means the customer matches the segment's rules right now.
 */
export async function isCustomerInSegment(
  supabase: SupabaseClient,
  segmentId: string,
  customerId: string,
): Promise<boolean> {
  const { data: rawSegment, error: segErr } = await supabase
    .from("customer_segments")
    .select(
      "id, business_id, name, kind, auto_key, rules, member_count, " +
        "member_count_at, created_by, created_at, updated_at, deleted_at",
    )
    .eq("id", segmentId)
    .maybeSingle();
  if (segErr) {
    throw new Error(`segment lookup failed: ${segErr.message}`);
  }
  if (!rawSegment) return false;
  const segment = rawSegment as unknown as SegmentRow;
  const rules = rulesForSegment(segment);

  const baseQuery = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", segment.business_id)
    .eq("id", customerId)
    .is("deleted_at", null)
    .is("merged_into_id", null);
  const filtered = applyRulesToCustomersQuery(
    baseQuery as unknown as CustomersQueryLike,
    rules,
  ) as unknown as typeof baseQuery;

  const { count, error: countErr } = await filtered;
  if (countErr) {
    throw new Error(`segment-membership check failed: ${countErr.message}`);
  }
  return (count ?? 0) > 0;
}

// ─────────────────────────────────────────────────────────────────────────
// redeemCoupon
// ─────────────────────────────────────────────────────────────────────────

export interface RedeemCouponInput {
  /**
   * The supabase client to use for the actual writes. The caller can
   * pass either:
   *   - a session-scoped client (RLS gates the writes — owner / manager /
   *     cashier can INSERT into coupon_redemptions), or
   *   - a service-role client (no RLS — used only by tests + the migration
   *     seed script).
   * The signature uses `serviceClient` to make the intent explicit at
   * call sites, but either works.
   */
  serviceClient: SupabaseClient;
  businessId: string;
  code: string;
  customerId?: string | null;
  subtotalMyr: number;
  orderRef?: string | null;
  redeemedBy?: string | null;
  now?: Date;
}

export type CouponRedeemResult =
  | {
      ok: true;
      redemption: CouponRedemptionRow;
      coupon: CouponRow;
      idempotent: boolean;
    }
  | { ok: false; reason: CouponFailureReason; coupon?: CouponRow };

/**
 * Apply a coupon code to an order: validate first, then write a
 * coupon_redemptions row and atomically bump coupons.redeemed_count.
 *
 * Idempotency contract: when `orderRef` is provided AND a redemption
 * already exists for `(coupon_id, order_ref)`, the existing row is
 * returned with `idempotent: true` and the counter is NOT bumped a
 * second time. When `orderRef` is null (the bare "tap apply" path),
 * each call writes a new row.
 */
export async function redeemCoupon(
  input: RedeemCouponInput,
): Promise<CouponRedeemResult> {
  const {
    serviceClient,
    businessId,
    code,
    customerId,
    subtotalMyr,
    orderRef,
    redeemedBy,
  } = input;
  const now = input.now ?? new Date();

  const validation = await validateCoupon({
    supabase: serviceClient,
    businessId,
    code,
    customerId: customerId ?? null,
    subtotalMyr,
    now,
  });
  if (!validation.ok) {
    return validation;
  }
  const { coupon, discount_myr } = validation;

  // Idempotency short-circuit. The unique index on (coupon_id,
  // order_ref) WHERE order_ref IS NOT NULL means a duplicate INSERT
  // would error with 23505 — but we'd rather return the existing row
  // than surface an opaque DB error to the caller.
  if (orderRef) {
    const { data: existing, error: existingErr } = await serviceClient
      .from("coupon_redemptions")
      .select(
        "id, coupon_id, customer_id, order_ref, discount_amount_myr, " +
          "redeemed_by, redeemed_at",
      )
      .eq("coupon_id", coupon.id)
      .eq("order_ref", orderRef)
      .maybeSingle();
    if (existingErr) {
      throw new Error(
        `coupon idempotency check failed: ${existingErr.message}`,
      );
    }
    if (existing) {
      return {
        ok: true,
        redemption: coerceRedemption(existing),
        coupon,
        idempotent: true,
      };
    }
  }

  const { data: insertData, error: insertErr } = await serviceClient
    .from("coupon_redemptions")
    .insert({
      coupon_id: coupon.id,
      customer_id: customerId ?? null,
      order_ref: orderRef ?? null,
      discount_amount_myr: discount_myr,
      redeemed_by: redeemedBy ?? null,
    })
    .select(
      "id, coupon_id, customer_id, order_ref, discount_amount_myr, " +
        "redeemed_by, redeemed_at",
    )
    .single();
  if (insertErr) {
    // If two concurrent redeem calls raced on the same orderRef, the
    // partial unique index will reject the second one with 23505.
    // Re-read and return the winner; this preserves the idempotency
    // guarantee even under race conditions.
    if (orderRef && insertErr.code === "23505") {
      const { data: winner } = await serviceClient
        .from("coupon_redemptions")
        .select(
          "id, coupon_id, customer_id, order_ref, discount_amount_myr, " +
            "redeemed_by, redeemed_at",
        )
        .eq("coupon_id", coupon.id)
        .eq("order_ref", orderRef)
        .maybeSingle();
      if (winner) {
        return {
          ok: true,
          redemption: coerceRedemption(winner),
          coupon,
          idempotent: true,
        };
      }
    }
    throw new Error(`coupon redemption insert failed: ${insertErr.message}`);
  }

  // Atomic counter bump via the security-definer SQL function. The
  // function refuses to bump cross-tenant or for soft-deleted coupons
  // and returns the new count so we can echo it back to the caller.
  const { data: bumpedRaw, error: bumpErr } = await serviceClient.rpc(
    "increment_coupon_redeemed_count",
    { p_coupon_id: coupon.id },
  );
  if (bumpErr) {
    throw new Error(`coupon counter bump failed: ${bumpErr.message}`);
  }
  const bumped =
    typeof bumpedRaw === "number"
      ? bumpedRaw
      : Number(bumpedRaw ?? coupon.redeemed_count + 1);

  const redemption = coerceRedemption(insertData);

  return {
    ok: true,
    redemption,
    coupon: { ...coupon, redeemed_count: bumped },
    idempotent: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Re-exports useful for the API layer.
// ─────────────────────────────────────────────────────────────────────────

export const COUPON_FAILURE_REASONS: readonly CouponFailureReason[] = [
  "not_found",
  "paused",
  "expired",
  "not_yet_active",
  "min_subtotal",
  "total_limit_reached",
  "per_customer_limit_reached",
  "segment_mismatch",
];
