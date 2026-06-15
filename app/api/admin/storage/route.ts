import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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

async function requireStorageUser(): Promise<AuthResult> {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "admin", "storage")) {
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
  const auth = await requireStorageUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

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

  // HR Officer is server-side forced to the hr_doc category, regardless
  // of what the client posted. The category they sent is silently ignored.
  if (isHrDocOnly(user.role)) {
    parsed.category = "hr_doc";
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

interface ListRowRaw {
  id: string;
  business_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  category: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function decodeCursor(raw: string): { createdAt: string; id: string } | null {
  const idx = raw.lastIndexOf("__");
  if (idx <= 0 || idx >= raw.length - 1) return null;
  const createdAt = raw.slice(0, idx);
  const id = raw.slice(idx + 2);
  if (Number.isNaN(Date.parse(createdAt))) return null;
  // very loose uuid sanity (just enough to refuse garbage)
  if (!/^[0-9a-f-]{8,}$/i.test(id)) return null;
  return { createdAt, id };
}

function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}__${id}`;
}

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

  // HR Officer scoping — pin category to hr_doc no matter what they asked.
  const effectiveCategory = isHrDocOnly(user.role)
    ? "hr_doc"
    : (parsed.category ?? null);

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("admin_files")
    .select(
      "id, business_id, uploaded_by, storage_path, file_name, mime_type, " +
        "file_size_bytes, category, description, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (effectiveCategory) {
    q = q.eq("category", effectiveCategory);
  }
  if (parsed.q) {
    // PostgREST treats `*` as a wildcard in ilike; strip the chars that
    // would break the .or= expression for safety.
    const safe = parsed.q.replace(/[\\*,()]/g, "");
    q = q.ilike("file_name", `%${safe}%`);
  }

  if (parsed.cursor) {
    const decoded = decodeCursor(parsed.cursor);
    if (decoded) {
      // Keyset paging on (created_at desc, id desc): the next page is
      // every row strictly less than the cursor row.
      q = q.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
      );
    }
  }

  // Fetch limit+1 so we can tell whether another page exists.
  q = q.limit(parsed.limit + 1);

  const { data, error } = await q;
  if (error) {
    log.error("list_failed", { businessId: user.businessId }, error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "list_failed", message: "Could not list files." },
      },
      { status: 500 },
    );
  }

  const allRows = (data ?? []) as unknown as ListRowRaw[];
  const hasNext = allRows.length > parsed.limit;
  const pageRows = hasNext ? allRows.slice(0, parsed.limit) : allRows;

  // Hydrate uploader display names in one round-trip.
  const uploaderIds = Array.from(new Set(pageRows.map((r) => r.uploaded_by)));
  const nameLookup = new Map<string, string | null>();
  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("users")
      .select("id, display_name")
      .in("id", uploaderIds);
    for (const p of (profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
    }>) {
      nameLookup.set(p.id, p.display_name);
    }
  }

  const enriched: AdminFileRow[] = pageRows.map((r) => ({
    ...r,
    uploaded_by_name: nameLookup.get(r.uploaded_by) ?? null,
  }));

  const last = pageRows[pageRows.length - 1];
  const body: AdminFileListResponse = {
    data: enriched,
    next_cursor: hasNext && last ? encodeCursor(last.created_at, last.id) : null,
  };

  return NextResponse.json({ ok: true, data: body }, { status: 200 });
}
