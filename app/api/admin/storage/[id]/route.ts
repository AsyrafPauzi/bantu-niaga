import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * DELETE /api/admin/storage/[id] — soft-delete an admin_files row.
 *
 *   - 401 if no session
 *   - 403 if role can't access Admin storage
 *   - 404 if the row is in another business / already deleted / for
 *     hr_officer when category != 'hr_doc'
 *
 * The bytes are NOT removed from Storage in v1. A future background job
 * can hard-delete tombstoned rows after a grace period; see TODO below.
 */

export const dynamic = "force-dynamic";

const log = logger.child({ module: "admin.storage.delete" });

function isHrDocOnly(role: CurrentUser["role"]): boolean {
  return role === "hr_officer";
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let user: CurrentUser;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "unauthorized", message: "Authentication required." },
        },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!canSurface(user.role, "admin", "storage")) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "forbidden",
          message: "You don't have permission to access Admin storage.",
        },
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();

  // Look up the row first so we can apply the HR-Officer category gate
  // and return a stable 404 (rather than letting the UPDATE silently
  // affect zero rows).
  const { data: row, error: lookupErr } = await supabase
    .from("admin_files")
    .select("id, business_id, category, deleted_at")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupErr) {
    log.error("lookup_failed", { id, businessId: user.businessId }, lookupErr);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "lookup_failed", message: "Could not load the file." },
      },
      { status: 500 },
    );
  }
  if (!row) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "File not found." },
      },
      { status: 404 },
    );
  }
  if (isHrDocOnly(user.role) && row.category !== "hr_doc") {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "File not found." },
      },
      { status: 404 },
    );
  }

  const { error: updErr } = await supabase
    .from("admin_files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (updErr) {
    log.error("soft_delete_failed", { id, businessId: user.businessId }, updErr);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "delete_failed", message: "Could not delete the file." },
      },
      { status: 500 },
    );
  }

  // TODO: hard-delete the Storage object after a grace period (e.g. a
  // nightly background job that scans admin_files where deleted_at <
  // now() - interval '30 days' and calls storage.remove() + a row
  // delete).

  return NextResponse.json({ ok: true, data: { id } }, { status: 200 });
}
