import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contentMediaAttachSchema } from "@/lib/marketing/schemas";

/**
 * POST /api/marketing/content/[id]/media — attach a media file_id to a
 * content_plan entry. v1 just records the uuid without an FK to a
 * canonical `files` table (the Admin Storage `files` table arrives via
 * D6 — see plan §3.3 / §2.5). The UI renders a placeholder thumbnail
 * labelled with the file_id until Admin publishes a signed-URL endpoint.
 *
 * Idempotency: re-posting the same `(content_plan_id, file_id)` pair
 * updates the `position` instead of throwing a duplicate-key error.
 */

export const dynamic = "force-dynamic";

async function requireUser() {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", "content")) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "marketing.content access denied" },
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
          { error: "unauthorized", code: e.code },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = contentMediaAttachSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();

  // Confirm the parent entry exists in this tenant before we record the
  // attachment. RLS would block the insert anyway, but a pre-check
  // means a clean 404 instead of a postgres FK violation.
  const { data: entry, error: lookupErr } = await supabase
    .from("content_plan")
    .select("id")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json(
      { error: "load_failed", message: lookupErr.message },
      { status: 500 },
    );
  }
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("content_plan_media")
    .upsert(
      {
        content_plan_id: id,
        file_id: parsed.file_id,
        business_id: user.businessId,
        position: parsed.position ?? 0,
      },
      { onConflict: "content_plan_id,file_id" },
    )
    .select("content_plan_id, file_id, position")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "attach_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { action: "attached", media: data },
    { status: 201 },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  const url = new URL(request.url);
  const fileId = url.searchParams.get("file_id");
  if (!fileId) {
    return NextResponse.json(
      {
        error: "validation_failed",
        message: "?file_id=… is required",
      },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("content_plan_media")
    .delete()
    .eq("business_id", user.businessId)
    .eq("content_plan_id", id)
    .eq("file_id", fileId);

  if (error) {
    return NextResponse.json(
      { error: "detach_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { action: "detached", content_plan_id: id, file_id: fileId },
    { status: 200 },
  );
}
