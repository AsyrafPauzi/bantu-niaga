import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/operations/orders/:id/archive
 *
 * Soft-archives a "done" order so it is hidden from the live board
 * but remains readable in reports and history. Only orders with
 * status = "done" may be archived.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "Sign in required." } },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!can(user.role, "operations")) {
    return NextResponse.json(
      { ok: false, error: { code: "forbidden", message: "Access denied." } },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("operations_orders")
    .select("id, status, archived_at")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Order not found." } },
      { status: 404 },
    );
  }

  if (existing.status !== "done") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_status",
          message: "Only completed (Done) orders can be archived.",
        },
      },
      { status: 422 },
    );
  }

  const { error } = await supabase
    .from("operations_orders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", user.businessId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "db_error", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
