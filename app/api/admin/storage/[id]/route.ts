import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  adminFileUpdateSchema,
  sanitiseAdminFileName,
  type AdminFileRow,
} from "@/lib/admin/schemas";

/**
 * PATCH /api/admin/storage/[id] — update file metadata (rename, category, etc.)
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

async function loadOwnedFile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  id: string,
  user: CurrentUser,
) {
  const { data: row, error: lookupErr } = await supabase
    .from("admin_files")
    .select("id, business_id, category, deleted_at")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupErr) {
    log.error("lookup_failed", { id, businessId: user.businessId }, lookupErr);
    return {
      row: null,
      response: NextResponse.json(
        {
          ok: false,
          error: { code: "lookup_failed", message: "Could not load the file." },
        },
        { status: 500 },
      ),
    };
  }
  if (!row) {
    return {
      row: null,
      response: NextResponse.json(
        {
          ok: false,
          error: { code: "not_found", message: "File not found." },
        },
        { status: 404 },
      ),
    };
  }
  if (isHrDocOnly(user.role) && row.category !== "hr_doc") {
    return {
      row: null,
      response: NextResponse.json(
        {
          ok: false,
          error: { code: "not_found", message: "File not found." },
        },
        { status: 404 },
      ),
    };
  }
  return { row, response: null };
}

export async function PATCH(
  request: Request,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "bad_request", message: "Request body must be valid JSON." },
      },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = adminFileUpdateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "validation_failed",
            message: "Validation failed.",
            details: e.issues,
          },
        },
        { status: 422 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const owned = await loadOwnedFile(supabase, id, user);
  if (owned.response) return owned.response;

  const patch: Record<string, unknown> = {};
  if (parsed.file_name !== undefined) {
    patch.file_name = sanitiseAdminFileName(parsed.file_name);
  }
  if (parsed.category !== undefined) {
    patch.category = isHrDocOnly(user.role) ? "hr_doc" : parsed.category;
  }
  if (parsed.description !== undefined) {
    patch.description = parsed.description?.trim() ? parsed.description.trim() : null;
  }
  if (parsed.tags !== undefined) {
    patch.tags = parsed.tags;
  }

  const { data: updated, error: updErr } = await supabase
    .from("admin_files")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(
      "id, business_id, uploaded_by, storage_path, file_name, mime_type, " +
        "file_size_bytes, category, description, tags, created_at, updated_at",
    )
    .maybeSingle();

  if (updErr || !updated) {
    log.error("update_failed", { id, businessId: user.businessId }, updErr);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "update_failed", message: "Could not update the file." },
      },
      { status: 500 },
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, email")
    .eq("id", (updated as unknown as { uploaded_by: string }).uploaded_by)
    .maybeSingle();

  const updatedRow = updated as unknown as Omit<AdminFileRow, "uploaded_by_name" | "tags"> & {
    tags?: string[];
    uploaded_by: string;
  };

  const row: AdminFileRow = {
    ...updatedRow,
    tags: Array.isArray(updatedRow.tags) ? updatedRow.tags : [],
    uploaded_by_name:
      (profile as { display_name?: string | null; email?: string | null } | null)
        ?.display_name ||
      (profile as { email?: string | null } | null)?.email ||
      null,
  };

  return NextResponse.json({ ok: true, data: row }, { status: 200 });
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

  const owned = await loadOwnedFile(supabase, id, user);
  if (owned.response) return owned.response;

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
