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
import type { AdminFileDownloadResponse } from "@/lib/admin/schemas";

/**
 * GET /api/admin/storage/[id]/download — issue a short-lived signed
 * download URL for the file's bytes.
 *
 * The signed URL is good for 5 minutes; the client typically navigates
 * window.location to it directly to trigger the browser download.
 *
 *   - 401 if no session
 *   - 403 if role can't access Admin storage
 *   - 404 if the row is in another business / soft-deleted / for
 *     hr_officer when category != 'hr_doc'
 */

export const dynamic = "force-dynamic";

const log = logger.child({ module: "admin.storage.download" });
const STORAGE_BUCKET = "admin-files";
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

function isHrDocOnly(role: CurrentUser["role"]): boolean {
  return role === "hr_officer";
}

export async function GET(
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
  const { data: row, error: lookupErr } = await supabase
    .from("admin_files")
    .select("id, storage_path, file_name, mime_type, category, deleted_at, business_id")
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

  const admin = createServiceRoleClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(row.storage_path, DOWNLOAD_URL_TTL_SECONDS, {
      download: row.file_name,
    });

  if (signErr || !signed) {
    log.error("sign_failed", { id, storagePath: row.storage_path }, signErr);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "signed_url_failed",
          message: "Could not prepare the download link.",
        },
      },
      { status: 500 },
    );
  }

  const body: AdminFileDownloadResponse = {
    download_url: signed.signedUrl,
    expires_at: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    file_name: row.file_name,
    mime_type: row.mime_type,
  };

  return NextResponse.json({ ok: true, data: body }, { status: 200 });
}
