import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COUPON_SELECT =
  "id, business_id, code, name, type, value, min_subtotal_myr, valid_from, " +
  "valid_until, total_limit, per_customer_limit, segment_id, status, " +
  "redeemed_count, created_by, created_at, updated_at";

const PARAM_SHAPE = z.object({ id: z.string().uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH input — note: code is intentionally absent (immutable per spec §4).
const CouponPatchInput = z
  .object({
    name: z.string().trim().min(1).max(120).nullable().optional(),
    type: z.enum(["PCT", "AMT"]).optional(),
    value: z.number().finite().positive().optional(),
    min_subtotal_myr: z.number().finite().nonnegative().optional(),
    valid_from: z.string().datetime().optional(),
    valid_until: z.string().datetime().nullable().optional(),
    total_limit: z.number().int().positive().nullable().optional(),
    per_customer_limit: z.number().int().nonnegative().optional(),
    segment_id: z.string().uuid().nullable().optional(),
    status: z.enum(["active", "paused", "expired"]).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.type === undefined ||
      v.value === undefined ||
      v.type !== "PCT" ||
      (v.value > 0 && v.value <= 100),
    {
      message: "PCT value must be in (0, 100]",
      path: ["value"],
    },
  );

function unauthorizedResponse(e: UnauthorizedError) {
  return NextResponse.json(
    { error: "unauthorized", code: e.code },
    { status: 401 },
  );
}

// ─────────────────────────────────────────────────────────────────────────
// GET — detail incl. recent redemption snapshot
// ─────────────────────────────────────────────────────────────────────────

export async function GET(_request: Request, ctx: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "coupons")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.coupons access denied" },
      { status: 403 },
    );
  }

  const params = await ctx.params;
  const parsedParams = PARAM_SHAPE.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedParams.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: coupon, error: couponErr } = await supabase
    .from("coupons")
    .select(COUPON_SELECT)
    .eq("id", parsedParams.data.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (couponErr) {
    return NextResponse.json(
      { error: "detail_failed", message: couponErr.message },
      { status: 500 },
    );
  }
  if (!coupon) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: redemptions, error: redErr } = await supabase
    .from("coupon_redemptions")
    .select(
      "id, coupon_id, customer_id, order_ref, discount_amount_myr, " +
        "redeemed_by, redeemed_at",
    )
    .eq("coupon_id", parsedParams.data.id)
    .order("redeemed_at", { ascending: false })
    .limit(50);
  if (redErr) {
    return NextResponse.json(
      { error: "detail_failed", message: redErr.message },
      { status: 500 },
    );
  }

  // Hydrate customer names for the redemption log. Cheap because we
  // cap the page at 50 rows above.
  const redemptionsRaw = (redemptions ?? []) as unknown as {
    id: string;
    coupon_id: string;
    customer_id: string | null;
    order_ref: string | null;
    discount_amount_myr: number | string;
    redeemed_by: string | null;
    redeemed_at: string;
  }[];
  const customerIds = Array.from(
    new Set(
      redemptionsRaw
        .map((r) => r.customer_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  let customers: { id: string; name: string }[] = [];
  if (customerIds.length > 0) {
    const { data: custData } = await supabase
      .from("customers")
      .select("id, name")
      .in("id", customerIds);
    customers = (custData ?? []) as unknown as { id: string; name: string }[];
  }
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  const redemptionsHydrated = redemptionsRaw.map((r) => ({
    ...r,
    customer_name:
      r.customer_id ? (nameById.get(r.customer_id) ?? null) : null,
  }));

  const couponObj = coupon as unknown as Record<string, unknown>;
  return NextResponse.json({
    data: { ...couponObj, redemptions: redemptionsHydrated },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// PATCH — edit (code immutable)
// ─────────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request, ctx: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "coupons")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.coupons access denied" },
      { status: 403 },
    );
  }

  const params = await ctx.params;
  const parsedParams = PARAM_SHAPE.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedParams.error.issues },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Reject the (immutable) `code` key BEFORE Zod parsing so we surface
  // a clean 409 instead of the schema's generic 400. Spec §4 calls
  // this out explicitly.
  if (
    body !== null &&
    typeof body === "object" &&
    "code" in (body as Record<string, unknown>)
  ) {
    return NextResponse.json(
      {
        error: "code_immutable",
        reason: "Coupon code cannot be changed after creation.",
      },
      { status: 409 },
    );
  }

  let parsed;
  try {
    parsed = CouponPatchInput.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: lookupErr } = await supabase
    .from("coupons")
    .select("id, type, value, deleted_at")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json(
      { error: "detail_failed", message: lookupErr.message },
      { status: 500 },
    );
  }
  if (!existing || (existing as { deleted_at: string | null }).deleted_at) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Cross-field validation: when type changes to PCT but value isn't,
  // we still need to enforce the (0, 100] range.
  const nextType = parsed.type ?? (existing as { type: "PCT" | "AMT" }).type;
  const nextValue = parsed.value ?? Number((existing as { value: number }).value);
  if (nextType === "PCT" && (nextValue <= 0 || nextValue > 100)) {
    return NextResponse.json(
      {
        error: "validation_failed",
        message: "PCT value must be in (0, 100].",
      },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.type !== undefined) patch.type = parsed.type;
  if (parsed.value !== undefined) patch.value = parsed.value;
  if (parsed.min_subtotal_myr !== undefined)
    patch.min_subtotal_myr = parsed.min_subtotal_myr;
  if (parsed.valid_from !== undefined) patch.valid_from = parsed.valid_from;
  if (parsed.valid_until !== undefined) patch.valid_until = parsed.valid_until;
  if (parsed.total_limit !== undefined) patch.total_limit = parsed.total_limit;
  if (parsed.per_customer_limit !== undefined)
    patch.per_customer_limit = parsed.per_customer_limit;
  if (parsed.segment_id !== undefined) patch.segment_id = parsed.segment_id;
  if (parsed.status !== undefined) patch.status = parsed.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "no_changes", message: "Provide at least one field to update." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("coupons")
    .update(patch)
    .eq("id", parsedParams.data.id)
    .select(COUPON_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}

// ─────────────────────────────────────────────────────────────────────────
// DELETE — soft-delete; 409 if redeemed_count > 0 (use status='paused' instead)
// ─────────────────────────────────────────────────────────────────────────

export async function DELETE(_request: Request, ctx: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "coupons")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.coupons access denied" },
      { status: 403 },
    );
  }

  const params = await ctx.params;
  const parsedParams = PARAM_SHAPE.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedParams.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: lookupErr } = await supabase
    .from("coupons")
    .select("id, redeemed_count, deleted_at")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json(
      { error: "detail_failed", message: lookupErr.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const row = existing as { redeemed_count: number; deleted_at: string | null };
  if (row.deleted_at) {
    return NextResponse.json({ ok: true, already_deleted: true });
  }
  if (row.redeemed_count > 0) {
    return NextResponse.json(
      {
        error: "redeemed_already",
        reason:
          "Coupon has been redeemed; pause it instead of deleting to preserve the audit trail.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("coupons")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsedParams.data.id);

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
