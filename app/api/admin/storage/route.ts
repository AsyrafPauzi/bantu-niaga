import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import {
  canUploadAdminStorageCategory,
  hasFullAdminStorageAccess,
} from "@/lib/admin/storage-cross-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";
import {
  ADMIN_FILE_MAX_BYTES,
  adminFileUploadInitSchema,
  adminFileListQuerySchema,
  sanitiseAdminFileName,
  type AdminFileListResponse,
  type AdminFileRow,
  type AdminFileUploadInitResponse,
} from "@/lib/admin/schemas";

/**
 * Admin Digital Storage — top-level route handlers.
 *
 *   POST /api/admin/storage  → issue a signed upload URL (5 min). The
 *                              client PUTs the bytes directly to Supabase
 *                              Storage so the Next.js server never sees
 *                              the 100 MB body.
 *
 *   GET  /api/admin/storage  → list the caller's business's files,
 *                              newest first, with keyset pagination on
 *                              (created_at, id).
 *
 * Auth: getCurrentUser() → 401 if no session.
 * RBAC: canSurface(role, 'admin', 'storage') → 403 if false.
 *
 * HR Officer scoping (see lib/permissions.ts —
 * `getSurfaceScope('hr_officer','admin','storage') === 'rw_hr_docs_only'`):
 *   - Upload: server forces category='hr_doc' regardless of client input.
 *   - List:   server filters to category='hr_doc'.
 */

export const dynamic = "force-dynamic";

const log = logger.child({ module: "admin.storage" });
const STORAGE_BUCKET = "admin-files";
const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes

interface AuthResult {
  user: CurrentUser | null;
  response: NextResponse | null;
}

async function requireStorageUser(
  category?: import("@/lib/admin/schemas").AdminFileCategory | null,
): Promise<AuthResult> {
  try {
    const user = await getCurrentUser();
    const fullAccess = hasFullAdminStorageAccess(user.role);
    const hrDocAccess =
      user.role === "hr_officer" && canSurface(user.role, "admin", "storage");
    const moduleUpload =
      category != null && canUploadAdminStorageCategory(user.role, category);

    if (!fullAccess && !hrDocAccess && !moduleUpload) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You don't have permission to access Admin storage.",
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

/** True when this role may only touch HR doc files. */
function isHrDocOnly(role: CurrentUser["role"]): boolean {
  return role === "hr_officer";
}

// ─────────────────────────────────────────────────────────────────────────
// POST — issue signed upload URL
// ─────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
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
    parsed = adminFileUploadInitSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      // 100 MB cap rejection deserves an HTTP 413; everything else is 422.
      const sizeIssue = e.issues.find(
        (issue) =>
          issue.path.length === 1 &&
          issue.path[0] === "file_size_bytes" &&
          (issue.code === "too_big" || issue.code === "too_small"),
      );
      if (sizeIssue) {
        const tooLarge =
          sizeIssue.code === "too_big" ||
          (sizeIssue as { maximum?: number }).maximum != null;
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: tooLarge ? "file_too_large" : "file_too_small",
              message: tooLarge
                ? "File too large. Maximum upload size is 100 MB."
                : "File size must be greater than 0.",
            },
          },
          { status: tooLarge ? 413 : 400 },
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

  // Defensive: schema already caps at 100 MB, but enforce again so the
  // chain of size guards stays obvious in code review.
  if (parsed.file_size_bytes > ADMIN_FILE_MAX_BYTES) {
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
  if (parsed.file_size_bytes <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "file_too_small",
          message: "File size must be greater than 0.",
        },
      },
      { status: 400 },
    );
  }

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

  // HR Officer is server-side forced to the hr_doc category, regardless
  // of what the client posted. The category they sent is silently ignored.
  if (isHrDocOnly(user.role)) {
    parsed.category = "hr_doc";
  }

  const fullAccess = hasFullAdminStorageAccess(user.role);
  const moduleUpload =
    parsed.category != null &&
    canUploadAdminStorageCategory(user.role, parsed.category);

  if (!fullAccess && !moduleUpload) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "forbidden",
          message: "You don't have permission to upload to Admin storage.",
        },
      },
      { status: 403 },
    );
  }

  if (!fullAccess && !parsed.category) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "category_required",
          message: "A storage category is required for this upload.",
        },
      },
      { status: 422 },
    );
  }

  const sanitisedName = sanitiseAdminFileName(parsed.file_name);
  // <business_id>/<random>/<sanitised_name> — the bucket RLS pins the
  // first segment to the caller's business and the random UUID stops
  // two users colliding on the same filename.
  const storagePath = `${user.businessId}/${randomUUID()}/${sanitisedName}`;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    log.error("signed_upload_url_failed", { storagePath }, error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "storage_signed_url_failed",
          message: "Could not prepare the upload. Please try again.",
        },
      },
      { status: 500 },
    );
  }

  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString();
  const responseBody: AdminFileUploadInitResponse = {
    upload_url: data.signedUrl,
    storage_path: storagePath,
    token: data.token,
    expires_at: expiresAt,
  };

  return NextResponse.json({ ok: true, data: responseBody }, { status: 200 });
}

// ─────────────────────────────────────────────────────────────────────────
// GET — list files
// ─────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await requireStorageUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) raw[k] = v;

  let parsed;
  try {
    parsed = adminFileListQuerySchema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "validation_failed",
            message: "Invalid query parameters.",
            details: e.issues,
          },
        },
        { status: 422 },
      );
    }
    throw e;
  }

  const effectiveCategory = isHrDocOnly(user.role)
    ? "hr_doc"
    : (parsed.category ?? null);

  const supabase = await createSupabaseServerClient();

  try {
    const { listAdminFiles, hydrateUploaderNames } = await import(
      "@/lib/admin/storage-server"
    );
    const { rows: pageRows, nextCursor } = await listAdminFiles(supabase, {
      businessId: user.businessId,
      category: effectiveCategory,
      q: parsed.q,
      sort: parsed.sort,
      limit: parsed.limit,
      cursor: parsed.cursor,
    });

    const nameLookup = await hydrateUploaderNames(supabase, pageRows);

    const enriched: AdminFileRow[] = pageRows.map((r) => ({
      ...r,
      uploaded_by_name: nameLookup.get(r.uploaded_by) ?? null,
    }));

    const { loadFileUsageLinks } = await import("@/lib/admin/storage-usage");
    const usageByFileId = await loadFileUsageLinks(
      supabase,
      user.businessId,
      pageRows.map((r) => r.id),
    );

    const body: AdminFileListResponse = {
      data: enriched,
      next_cursor: nextCursor,
      usage_by_file_id: usageByFileId,
    };

    return NextResponse.json({ ok: true, data: body }, { status: 200 });
  } catch (error) {
    log.error("list_failed", { businessId: user.businessId }, error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "list_failed", message: "Could not list files." },
      },
      { status: 500 },
    );
  }
}
