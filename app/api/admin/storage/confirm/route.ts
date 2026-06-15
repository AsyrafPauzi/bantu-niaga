import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";
import {
  ADMIN_FILE_MAX_BYTES,
  adminFileConfirmSchema,
  type AdminFileRow,
} from "@/lib/admin/schemas";

/**
 * POST /api/admin/storage/confirm — finalise an upload.
 *
 * Called by the client after it has successfully PUT the file bytes to
 * the signed URL returned by POST /api/admin/storage. We:
 *
 *   1. Re-authorise (auth + RBAC + 100 MB cap).
 *   2. Verify the storage_path is one we issued (first segment must be
 *      the caller's business_id) — this stops a malicious client from
 *      pointing the metadata row at some other tenant's bucket folder.
 *   3. Verify the object actually exists in Storage at file_size_bytes,
 *      so a client lying about a successful upload can't seed metadata
 *      rows that point at empty storage paths.
 *   4. Insert the admin_files row through the regular server client so
 *      RLS double-checks the business_id and role gate.
 */

export const dynamic = "force-dynamic";

const log = logger.child({ module: "admin.storage.confirm" });
const STORAGE_BUCKET = "admin-files";

function isHrDocOnly(role: CurrentUser["role"]): boolean {
  return role === "hr_officer";
}

export async function POST(request: Request) {
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
    parsed = adminFileConfirmSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const sizeIssue = e.issues.find(
        (issue) =>
          issue.path.length === 1 &&
          issue.path[0] === "file_size_bytes" &&
          (issue.code === "too_big" || issue.code === "too_small"),
      );
      if (sizeIssue && sizeIssue.code === "too_big") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "file_too_large",
              message: "File too large. Maximum upload size is 100 MB.",
            },
          },
          { status: 413 },
        );
      }
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

  // Defence-in-depth size cap.
  if (
    parsed.file_size_bytes <= 0 ||
    parsed.file_size_bytes > ADMIN_FILE_MAX_BYTES
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: parsed.file_size_bytes > ADMIN_FILE_MAX_BYTES
            ? "file_too_large"
            : "file_too_small",
          message:
            parsed.file_size_bytes > ADMIN_FILE_MAX_BYTES
              ? "File too large. Maximum upload size is 100 MB."
              : "File size must be greater than 0.",
        },
      },
      { status: parsed.file_size_bytes > ADMIN_FILE_MAX_BYTES ? 413 : 400 },
    );
  }

  // Path must live under this caller's tenant prefix.
  const expectedPrefix = `${user.businessId}/`;
  if (!parsed.storage_path.startsWith(expectedPrefix)) {
    log.warn("cross_tenant_confirm_attempt", {
      businessId: user.businessId,
      storagePath: parsed.storage_path,
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_storage_path",
          message: "storage_path does not match this business.",
        },
      },
      { status: 400 },
    );
  }

  // Verify the object exists + matches the declared size.
  // storage.list() doesn't accept a full path, so we list the parent
  // folder and filter by the basename. The path layout is
  // <business_id>/<random>/<sanitised_name>, so the parent is the
  // <business_id>/<random> directory and the basename is the file name.
  const segments = parsed.storage_path.split("/");
  if (segments.length < 3) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_storage_path",
          message: "storage_path has an unexpected layout.",
        },
      },
      { status: 400 },
    );
  }
  const parentDir = segments.slice(0, -1).join("/");
  const baseName = segments[segments.length - 1];

  const admin = createServiceRoleClient();
  const { data: list, error: listErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(parentDir, { limit: 50, search: baseName });

  if (listErr) {
    log.error("storage_list_failed", { parentDir }, listErr);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "storage_check_failed",
          message: "Could not verify the upload. Please retry.",
        },
      },
      { status: 500 },
    );
  }

  const objectEntry = (list ?? []).find((entry) => entry.name === baseName);
  if (!objectEntry) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "upload_not_found",
          message:
            "We couldn't find the uploaded file in storage. Please try again.",
        },
      },
      { status: 400 },
    );
  }

  const actualSize =
    (objectEntry.metadata as { size?: number } | null | undefined)?.size ?? 0;
  // Allow exact-match only; the client must declare the true size.
  if (actualSize !== parsed.file_size_bytes) {
    log.warn("size_mismatch", {
      declared: parsed.file_size_bytes,
      actual: actualSize,
      storagePath: parsed.storage_path,
    });
    // Cleanup the orphaned upload so it doesn't sit in storage forever.
    void admin.storage.from(STORAGE_BUCKET).remove([parsed.storage_path]);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "size_mismatch",
          message: "Uploaded file size does not match the declared size.",
        },
      },
      { status: 400 },
    );
  }
  if (actualSize > ADMIN_FILE_MAX_BYTES) {
    void admin.storage.from(STORAGE_BUCKET).remove([parsed.storage_path]);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "file_too_large",
          message: "File too large. Maximum upload size is 100 MB.",
        },
      },
      { status: 413 },
    );
  }

  // HR Officer scoping — force category=hr_doc regardless of client.
  const finalCategory = isHrDocOnly(user.role)
    ? "hr_doc"
    : (parsed.category ?? null);

  const description = parsed.description?.trim()
    ? parsed.description.trim()
    : null;

  // Insert via the regular RLS-respecting client.
  const supabase = await createSupabaseServerClient();
  const { data: inserted, error: insertErr } = await supabase
    .from("admin_files")
    .insert({
      business_id: user.businessId,
      uploaded_by: user.id,
      storage_path: parsed.storage_path,
      file_name: parsed.file_name,
      mime_type: parsed.mime_type,
      file_size_bytes: parsed.file_size_bytes,
      category: finalCategory,
      description,
    })
    .select(
      "id, business_id, uploaded_by, storage_path, file_name, mime_type, " +
        "file_size_bytes, category, description, created_at, updated_at",
    )
    .single();

  if (insertErr || !inserted) {
    log.error(
      "insert_failed",
      { businessId: user.businessId, storagePath: parsed.storage_path },
      insertErr,
    );
    // Best-effort cleanup of the orphaned storage object.
    void admin.storage.from(STORAGE_BUCKET).remove([parsed.storage_path]);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "insert_failed",
          message: insertErr?.message ?? "Could not save the upload.",
        },
      },
      { status: 500 },
    );
  }

  // Hydrate uploader display name so the UI doesn't need a second hop.
  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const row: AdminFileRow = {
    ...(inserted as unknown as Omit<AdminFileRow, "uploaded_by_name">),
    uploaded_by_name:
      (profile as { display_name?: string | null } | null)?.display_name ?? null,
  };

  return NextResponse.json({ ok: true, data: row }, { status: 201 });
}
