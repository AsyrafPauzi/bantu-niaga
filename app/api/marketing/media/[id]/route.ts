import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";

/**
 * DELETE /api/marketing/media/[id] — soft-delete a marketing_files row
 * and remove the storage object (best-effort).
 *
 *   - 401 if no session
 *   - 403 if role can't access Marketing content
 *   - 404 if the row is in another business / already deleted
 *
 * The DB soft-deletes by setting `deleted_at`; we additionally call
 * `storage.remove([...])` against the marketing-media bucket so the
 * orphaned bytes don't sit forever. The storage cleanup is best-effort
 * and never fails the request — the DB tombstone is the source of truth.
 */

export const dynamic = "force-dynamic";

const log = logger.child({ module: "marketing.media.delete" });
const STORAGE_BUCKET = "marketing-media";

interface AuthResult {
  user: CurrentUser | null;
  response: NextResponse | null;
}

async function requireMediaUser(): Promise<AuthResult> {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", "content")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You don't have permission to delete marketing media.",
            },
          },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: { code: "unauthorized", message: "Authentication required." },
          },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await requireMediaUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  const supabase = await createSupabaseServerClient();

  // Look up the row first so we get the storage_path for cleanup and so
  // we can return a stable 404 rather than letting the UPDATE silently
  // affect zero rows.
  const { data: row, error: lookupErr } = await supabase
    .from("marketing_files")
    .select("id, business_id, storage_path, deleted_at")
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

  const { error: updErr } = await supabase
    .from("marketing_files")
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

  // Best-effort storage cleanup. The DB tombstone is what gates the
  // future SELECTs; if storage.remove fails (e.g. transient 5xx) we
  // still return success.
  const storagePath = (row as { storage_path?: string }).storage_path;
  if (storagePath) {
    try {
      const admin = createServiceRoleClient();
      await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    } catch (e) {
      log.warn("storage_remove_failed", { id, storagePath }, e);
    }
  }

  return NextResponse.json({ ok: true, data: { id } }, { status: 200 });
}
