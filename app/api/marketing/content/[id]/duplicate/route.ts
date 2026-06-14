import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/marketing/content/[id]/duplicate
 *
 * Clones a content_plan entry. The clone always lands as a fresh idea
 * (status='idea', scheduled_at=null, posted_at=null, engagement zeroed),
 * keeping the channel + hook + caption + hashtags. Media attachments
 * are copied (same file_ids).
 */

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!canSurface(user.role, "marketing", "content")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.content access denied" },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: source, error: loadErr } = await supabase
    .from("content_plan")
    .select(
      "channel, hook, caption, hashtags, forecast_reach_min, forecast_reach_max",
    )
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json(
      { error: "load_failed", message: loadErr.message },
      { status: 500 },
    );
  }
  if (!source) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const sourceRow = source as unknown as {
    channel: string;
    hook: string | null;
    caption: string | null;
    hashtags: string[];
    forecast_reach_min: number | null;
    forecast_reach_max: number | null;
  };

  const { data: cloneRow, error: cloneErr } = await supabase
    .from("content_plan")
    .insert({
      business_id: user.businessId,
      channel: sourceRow.channel,
      status: "idea",
      scheduled_at: null,
      hook: sourceRow.hook,
      caption: sourceRow.caption,
      hashtags: sourceRow.hashtags ?? [],
      forecast_reach_min: sourceRow.forecast_reach_min,
      forecast_reach_max: sourceRow.forecast_reach_max,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (cloneErr || !cloneRow) {
    return NextResponse.json(
      {
        error: "duplicate_failed",
        message: cloneErr?.message ?? "no row returned",
      },
      { status: 500 },
    );
  }

  const newId = (cloneRow as unknown as { id: string }).id;

  const { data: sourceMedia } = await supabase
    .from("content_plan_media")
    .select("file_id, position")
    .eq("business_id", user.businessId)
    .eq("content_plan_id", id);

  const sourceMediaRows = (sourceMedia ?? []) as unknown as Array<{
    file_id: string;
    position: number;
  }>;

  if (sourceMediaRows.length > 0) {
    await supabase.from("content_plan_media").insert(
      sourceMediaRows.map((m) => ({
        content_plan_id: newId,
        file_id: m.file_id,
        business_id: user.businessId,
        position: m.position,
      })),
    );
  }

  return NextResponse.json(
    { action: "duplicated", entry_id: newId },
    { status: 201 },
  );
}
