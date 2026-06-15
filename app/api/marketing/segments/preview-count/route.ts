import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  applyRulesToCustomersQuery,
  SegmentRulesSchema,
  type CustomersQueryLike,
} from "@/lib/marketing/segments-rules";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/segments/preview-count
 *
 * Body: { rules }. Returns the count of customers in the caller's
 * business that would match these rules — without persisting a
 * segment. Used by the rule builder's live "≈ N matches" preview.
 *
 * Light-weight: uses `select('id', { count:'exact', head:true })` so
 * no row payload crosses the wire.
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

  if (!canSurface(user.role, "marketing", "segments")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.segments access denied" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let rules;
  try {
    rules = SegmentRulesSchema.parse(
      typeof body === "object" && body !== null && "rules" in body
        ? (body as { rules: unknown }).rules
        : body,
    );
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
  const baseQuery = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .is("merged_into_id", null);
  // Cast through CustomersQueryLike to keep the PostgrestFilterBuilder
  // generic chain from compounding (TS2589 territory).
  const q = applyRulesToCustomersQuery(
    baseQuery as unknown as CustomersQueryLike,
    rules,
  ) as unknown as typeof baseQuery;

  const { count, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: "preview_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ count: count ?? 0 });
}
