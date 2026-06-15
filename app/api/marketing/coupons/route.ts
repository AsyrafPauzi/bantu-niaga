import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateCouponCode } from "@/lib/marketing/coupons";

export const dynamic = "force-dynamic";

const COUPON_SELECT =
  "id, business_id, code, name, type, value, min_subtotal_myr, valid_from, " +
  "valid_until, total_limit, per_customer_limit, segment_id, status, " +
  "redeemed_count, created_by, created_at, updated_at";

// ─────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────

const ListQuery = z
  .object({
    status: z.enum(["active", "paused", "expired"]).optional(),
  })
  .strict();

const CouponCreateInput = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, {
        message: "code may contain only letters, numbers, '-' or '_'",
      })
      .optional(),
    name: z.string().trim().min(1).max(120).optional(),
    type: z.enum(["PCT", "AMT"]),
    value: z.number().finite().positive(),
    min_subtotal_myr: z.number().finite().nonnegative().optional(),
    valid_from: z.string().datetime().optional(),
    valid_until: z.string().datetime().nullable().optional(),
    total_limit: z.number().int().positive().nullable().optional(),
    per_customer_limit: z.number().int().nonnegative().optional(),
    segment_id: z.string().uuid().nullable().optional(),
    status: z.enum(["active", "paused"]).optional(),
  })
  .strict()
  .refine(
    (v) => v.type !== "PCT" || (v.value > 0 && v.value <= 100),
    {
      message: "PCT value must be in (0, 100]",
      path: ["value"],
    },
  )
  .refine(
    (v) =>
      !v.valid_from ||
      !v.valid_until ||
      new Date(v.valid_from).getTime() < new Date(v.valid_until).getTime(),
    {
      message: "valid_from must be before valid_until",
      path: ["valid_until"],
    },
  );

// ─────────────────────────────────────────────────────────────────────────
// GET /api/marketing/coupons — list active (non-soft-deleted) coupons
// ─────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
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

  if (!canSurface(user.role, "marketing", "coupons")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.coupons access denied" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const rawParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) rawParams[k] = v;
  let parsed;
  try {
    parsed = ListQuery.parse(rawParams);
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
  let q = supabase
    .from("coupons")
    .select(COUPON_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (parsed.status) q = q.eq("status", parsed.status);

  q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: "list_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/marketing/coupons — create
// ─────────────────────────────────────────────────────────────────────────

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

  if (!canSurface(user.role, "marketing", "coupons")) {
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
    parsed = CouponCreateInput.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  // Auto-generate a code if the operator didn't supply one. Retry up to
  // five times on collision (extremely unlikely with 32-char alphabet
  // and 8-char default length, but cheap).
  const codeProvided = parsed.code !== undefined;
  let code = parsed.code ?? generateCouponCode(8);

  const supabase = await createSupabaseServerClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("coupons")
      .insert({
        business_id: user.businessId,
        code,
        name: parsed.name ?? null,
        type: parsed.type,
        value: parsed.value,
        min_subtotal_myr: parsed.min_subtotal_myr ?? 0,
        valid_from: parsed.valid_from ?? new Date().toISOString(),
        valid_until: parsed.valid_until ?? null,
        total_limit: parsed.total_limit ?? null,
        per_customer_limit: parsed.per_customer_limit ?? 1,
        segment_id: parsed.segment_id ?? null,
        status: parsed.status ?? "active",
        created_by: user.id,
      })
      .select(COUPON_SELECT)
      .single();

    if (!error) {
      return NextResponse.json({ data }, { status: 201 });
    }

    // 23505 = unique-violation. If the operator typed the code,
    // surface a 409. If we generated one, regenerate and try again.
    if (error.code === "23505") {
      if (codeProvided) {
        return NextResponse.json(
          { error: "code_taken", message: "Coupon code already in use." },
          { status: 409 },
        );
      }
      code = generateCouponCode(8);
      continue;
    }

    return NextResponse.json(
      { error: "insert_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      error: "code_generation_failed",
      message:
        "Could not generate a unique coupon code after 5 attempts; supply one manually.",
    },
    { status: 500 },
  );
}
