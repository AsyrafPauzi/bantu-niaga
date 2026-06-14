import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  contentEntryUpdateSchema,
  isValidContentStatusTransition,
  type ContentStatus,
} from "@/lib/marketing/schemas";

/**
 * /api/marketing/content/[id] — single-entry CRUD for Marketing M5.
 *
 *   GET    → full entry + attached media (file_id rows only, no
 *            thumbnails — those come from Admin Storage once D6 lands).
 *   PATCH  → partial update, validates the idea→drafted→scheduled→posted
 *            lifecycle (backward transitions allowed; `posted` terminal).
 *   DELETE → hard delete (plan §4.1 says no soft-delete for content_plan;
 *            cascade removes content_plan_media rows).
 */

export const dynamic = "force-dynamic";

const CONTENT_SELECT =
  "id, business_id, channel, status, scheduled_at, hook, caption, " +
  "hashtags, views, likes, comments_count, shares, saves, " +
  "forecast_reach_min, forecast_reach_max, " +
  "created_by, posted_at, created_at, updated_at";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  const supabase = await createSupabaseServerClient();

  const { data: entry, error } = await supabase
    .from("content_plan")
    .select(CONTENT_SELECT)
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "load_failed", message: error.message },
      { status: 500 },
    );
  }
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: media, error: mediaErr } = await supabase
    .from("content_plan_media")
    .select("content_plan_id, file_id, position")
    .eq("business_id", user.businessId)
    .eq("content_plan_id", id)
    .order("position", { ascending: true });

  if (mediaErr) {
    return NextResponse.json(
      { error: "load_failed", message: mediaErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { entry, media: media ?? [] },
    { status: 200 },
  );
}

export async function PATCH(
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
    parsed = contentEntryUpdateSchema.parse(body);
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

  // Load the current row so we can validate the status transition and
  // know whether we need to stamp `posted_at`.
  const { data: current, error: currentErr } = await supabase
    .from("content_plan")
    .select("id, status, posted_at, scheduled_at")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();

  if (currentErr) {
    return NextResponse.json(
      { error: "load_failed", message: currentErr.message },
      { status: 500 },
    );
  }
  if (!current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};

  if (parsed.channel !== undefined) update.channel = parsed.channel;
  if (parsed.hook !== undefined) update.hook = parsed.hook;
  if (parsed.caption !== undefined) update.caption = parsed.caption;
  if (parsed.scheduled_at !== undefined) update.scheduled_at = parsed.scheduled_at;
  if (parsed.hashtags !== undefined) update.hashtags = parsed.hashtags;
  if (parsed.views !== undefined) update.views = parsed.views;
  if (parsed.likes !== undefined) update.likes = parsed.likes;
  if (parsed.comments_count !== undefined)
    update.comments_count = parsed.comments_count;
  if (parsed.shares !== undefined) update.shares = parsed.shares;
  if (parsed.saves !== undefined) update.saves = parsed.saves;
  if (parsed.forecast_reach_min !== undefined)
    update.forecast_reach_min = parsed.forecast_reach_min;
  if (parsed.forecast_reach_max !== undefined)
    update.forecast_reach_max = parsed.forecast_reach_max;

  if (parsed.status !== undefined) {
    const next = parsed.status as ContentStatus;
    const curr = current.status as ContentStatus;
    if (!isValidContentStatusTransition(curr, next)) {
      return NextResponse.json(
        {
          error: "invalid_status_transition",
          message: `Cannot move content_plan status from '${curr}' to '${next}'. ` +
            `'posted' is terminal in v1 — create a new entry instead.`,
          current_status: curr,
          requested_status: next,
        },
        { status: 422 },
      );
    }
    update.status = next;
    // Auto-stamp posted_at the first time the entry moves to 'posted'.
    if (next === "posted" && !current.posted_at) {
      update.posted_at = new Date().toISOString();
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { action: "noop", entry_id: id },
      { status: 200 },
    );
  }

  const { data: updated, error: upErr } = await supabase
    .from("content_plan")
    .update(update)
    .eq("business_id", user.businessId)
    .eq("id", id)
    .select(CONTENT_SELECT)
    .single();

  if (upErr) {
    return NextResponse.json(
      { error: "update_failed", message: upErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { action: "updated", entry: updated },
    { status: 200 },
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  const supabase = await createSupabaseServerClient();

  // Verify the row exists in this tenant before deleting so we return
  // 404 (instead of "0 rows affected" silently).
  const { data: existing, error: loadErr } = await supabase
    .from("content_plan")
    .select("id")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json(
      { error: "load_failed", message: loadErr.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("content_plan")
    .delete()
    .eq("business_id", user.businessId)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { action: "deleted", entry_id: id },
    { status: 200 },
  );
}
