import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateCoupon } from "@/lib/marketing/coupons";

export const dynamic = "force-dynamic";

const ValidateInput = z
  .object({
    code: z.string().trim().min(1).max(64),
    customer_id: z.string().uuid().nullable().optional(),
    subtotal_myr: z.number().finite().nonnegative(),
  })
  .strict();

/**
 * POST /api/marketing/coupons/validate
 *
 * Body: { code, customer_id?, subtotal_myr }
 * Response: { ok: true, discount_myr, coupon: {...} }
 *        or { ok: false, reason: "<failure reason>" }
 *
 * No state mutation — pure read. Permitted for owner / manager
 * (marketing.coupons) AND cashier (forward-compat for the future POS
 * — see spec §7 cross-pillar exception).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  // Marketing role gate OR explicit cashier carve-out per spec §7.
  // We don't model cashier in MARKETING_SURFACE_GRANTS because the
  // grant is route-specific (validate / redeem only); modeling it as a
  // direct role check keeps the matrix file honest.
  const allowed =
    canSurface(user.role, "marketing", "coupons") || user.role === "cashier";
  if (!allowed) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.coupons access denied" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = ValidateInput.parse(body);
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

  try {
    const result = await validateCoupon({
      supabase,
      businessId: user.businessId,
      code: parsed.code,
      customerId: parsed.customer_id ?? null,
      subtotalMyr: parsed.subtotal_myr,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          coupon: result.coupon
            ? {
                id: result.coupon.id,
                code: result.coupon.code,
                type: result.coupon.type,
                value: result.coupon.value,
              }
            : undefined,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        discount_myr: result.discount_myr,
        coupon: {
          id: result.coupon.id,
          code: result.coupon.code,
          name: result.coupon.name,
          type: result.coupon.type,
          value: result.coupon.value,
          min_subtotal_myr: result.coupon.min_subtotal_myr,
          per_customer_limit: result.coupon.per_customer_limit,
          total_limit: result.coupon.total_limit,
          redeemed_count: result.coupon.redeemed_count,
        },
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: "validate_failed",
        message: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 },
    );
  }
}
