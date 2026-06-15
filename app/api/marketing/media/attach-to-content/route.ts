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
import { marketingMediaAttachSchema } from "@/lib/marketing/media-schemas";

/**
 * POST /api/marketing/media/attach-to-content — link uploaded marketing
 * files to a content_plan row via `content_plan_media`.
 *
 * Called by the New Post form after it has both (a) created the
 * content_plan row via POST /api/marketing/content and (b) finished
 * uploading + confirming each marketing_files row.
 *
 *   - 401 if no session
 *   - 403 if role can't access Marketing content
 *   - 404 if the content_plan_id is in another business / not found
 *   - 422 if any file_id is not a marketing_files row in this business
 *
 * Idempotent on (content_plan_id, file_id): the content_plan_media PK
 * is the pair, so re-attaching the same file silently no-ops.
 */

export const dynamic = "force-dynamic";

const log = logger.child({ module: "marketing.media.attach" });

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
              message: "You don't have permission to attach marketing media.",
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

export async function POST(request: Request) {
  const auth = await requireMediaUser();
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
    parsed = marketingMediaAttachSchema.parse(body);
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

  // Verify the content_plan row exists in this tenant.
  const { data: plan, error: planErr } = await supabase
    .from("content_plan")
    .select("id, business_id")
    .eq("id", parsed.content_plan_id)
    .eq("business_id", user.businessId)
    .maybeSingle();
  if (planErr) {
    log.error(
      "plan_lookup_failed",
      { contentPlanId: parsed.content_plan_id },
      planErr,
    );
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "lookup_failed",
          message: "Could not load the content plan.",
        },
      },
      { status: 500 },
    );
  }
  if (!plan) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "Content plan not found." },
      },
      { status: 404 },
    );
  }

  // Verify every file_id belongs to this tenant and is not soft-deleted.
  // Doing this in a single round-trip rather than per-file keeps the
  // attach call cheap when carousels hit the 10-file cap.
  const { data: foundRaw, error: filesErr } = await supabase
    .from("marketing_files")
    .select("id")
    .in("id", parsed.file_ids)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);
  if (filesErr) {
    log.error(
      "files_lookup_failed",
      { contentPlanId: parsed.content_plan_id },
      filesErr,
    );
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "lookup_failed",
          message: "Could not load the marketing files.",
        },
      },
      { status: 500 },
    );
  }
  const foundIds = new Set(
    ((foundRaw ?? []) as Array<{ id: string }>).map((r) => r.id),
  );
  const missing = parsed.file_ids.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_file_ids",
          message: "One or more file_ids could not be found in this business.",
          details: { missing },
        },
      },
      { status: 422 },
    );
  }

  // Upsert by PK so re-attaching is idempotent. The position is the
  // index in the supplied file_ids array, offset by position_start so
  // callers can append to an existing media list without re-numbering.
  const rows = parsed.file_ids.map((file_id, i) => ({
    content_plan_id: parsed.content_plan_id,
    file_id,
    business_id: user.businessId,
    position: parsed.position_start + i,
  }));

  const { error: upsertErr } = await supabase
    .from("content_plan_media")
    .upsert(rows, {
      onConflict: "content_plan_id,file_id",
    });

  if (upsertErr) {
    log.error(
      "upsert_failed",
      { contentPlanId: parsed.content_plan_id, count: rows.length },
      upsertErr,
    );
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "attach_failed",
          message: upsertErr.message ?? "Could not attach the media.",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        content_plan_id: parsed.content_plan_id,
        attached: rows.length,
      },
    },
    { status: 200 },
  );
}
