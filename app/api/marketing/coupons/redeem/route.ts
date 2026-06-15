import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redeemCoupon } from "@/lib/marketing/coupons";

export const dynamic = "force-dynamic";

const RedeemInput = z
  .object({
    code: z.string().trim().min(1).max(64),
    customer_id: z.string().uuid().nullable().optional(),
    order_ref: z.string().trim().min(1).max(120).nullable().optional(),
    subtotal_myr: z.number().finite().nonnegative(),
  })
  .strict();

/**
 * POST /api/marketing/coupons/redeem
 *
 * Body: { code, customer_id?, order_ref?, subtotal_myr }
 * Response on success: { id, discount_myr, coupon, idempotent }
 * Response on failure (200): { ok:false, reason }
 *
 * Records a coupon_redemptions row and atomically bumps the
 * coupons.redeemed_count via the increment_coupon_redeemed_count
 * security-definer function.
 *
 * Idempotency: when `order_ref` is provided AND a redemption already
 * exists for `(coupon_id, order_ref)`, the existing row is returned
 * with `idempotent: true` and the counter is NOT bumped a second time.
 *
 * Permissions mirror /validate: owner / manager (marketing.coupons) OR
 * cashier (forward-compat for POS — spec §7).
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
    parsed = RedeemInput.parse(body);
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
    const result = await redeemCoupon({
      serviceClient: supabase,
      businessId: user.businessId,
      code: parsed.code,
      customerId: parsed.customer_id ?? null,
      orderRef: parsed.order_ref ?? null,
      subtotalMyr: parsed.subtotal_myr,
      redeemedBy: user.id,
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
        id: result.redemption.id,
        idempotent: result.idempotent,
        discount_myr: result.redemption.discount_amount_myr,
        coupon: {
          id: result.coupon.id,
          code: result.coupon.code,
          name: result.coupon.name,
          type: result.coupon.type,
          value: result.coupon.value,
          redeemed_count: result.coupon.redeemed_count,
        },
        redemption: result.redemption,
      },
      { status: result.idempotent ? 200 : 201 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: "redeem_failed",
        message: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 },
    );
  }
}
