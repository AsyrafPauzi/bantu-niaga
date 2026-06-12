import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchQuerySchema } from "@/lib/marketing/schemas";

/**
 * GET /api/marketing/customers/search — desktop CRM typeahead.
 *
 * Returns up to `limit` lightweight customer rows whose `name` or
 * `phone_e164` matches the prefix of `q`. Excludes soft-deleted +
 * merged-away rows (handled by RLS for `deleted_at` and an explicit
 * filter for `merged_into_id`).
 *
 * Cashier customer search lives at `GET /api/sales/pos/customer-search`
 * (decisions doc Q11) and is built by the Sales pillar. This endpoint
 * is for the desktop CRM users (Owner / Manager). Other surfaces still
 * land here via the `marketing.customers` permission check.
 */

export const dynamic = "force-dynamic";

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

  if (!canSurface(user.role, "marketing", "customers")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.customers access denied" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const rawParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    rawParams[k] = v;
  }

  let parsed;
  try {
    parsed = searchQuerySchema.parse(rawParams);
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
  const safe = parsed.q.replace(/[\\*,()]/g, "");

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, name, phone_e164, total_spend_myr, last_purchase_at, auto_tags",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .or(`name.ilike.*${safe}*,phone_e164.ilike.${safe}*`)
    .order("last_purchase_at", { ascending: false, nullsFirst: false })
    .limit(parsed.limit);

  if (error) {
    return NextResponse.json(
      { error: "search_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}
