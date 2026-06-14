import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/security/audit — recent audit log entries for the
 * business.
 *
 * Query:
 *   - limit (default 20, max 100)
 *   - actor_user_id (optional) — filter to a single actor
 */
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

  const url = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
  );
  const actor = url.searchParams.get("actor_user_id");

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("audit_log")
    .select("id, actor_user_id, action, entity_type, entity_id, diff, created_at")
    .eq("business_id", user.businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (actor) q = q.eq("actor_user_id", actor);

  const { data, error } = await q;

  if (error) {
    return NextResponse.json(
      { error: "list_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}
