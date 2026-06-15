import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BroadcastRow } from "@/lib/marketing/broadcasts";

export const dynamic = "force-dynamic";

/**
 * GET    /api/marketing/broadcasts/[id] — detail (broadcast + recipients).
 * DELETE /api/marketing/broadcasts/[id] — hard-delete; only allowed
 *                                          when status='draft'.
 *
 * The DELETE policy on `broadcasts` enforces both the actor role
 * (owner) and the status (draft); the API also enforces the status
 * check up-front so the operator gets a 409 instead of a silent
 * zero-rows-deleted response.
 */

const PARAM_SHAPE = z.object({ id: z.string().uuid() });

const BROADCAST_COLS =
  "id, business_id, name, channel, segment_id, subject, message_template, " +
  "coupon_id, status, total_recipients, sent_count, failed_count, " +
  "scheduled_at, sent_at, created_by, created_at, updated_at";

const RECIPIENT_COLS =
  "id, broadcast_id, customer_id, channel_address, rendered_message, " +
  "rendered_subject, status, error, sent_at, opened_at";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function unauthorized(e: UnauthorizedError) {
  return NextResponse.json(
    { error: "unauthorized", code: e.code },
    { status: 401 },
  );
}

function forbidden() {
  return NextResponse.json(
    { error: "forbidden", reason: "marketing.broadcasts access denied" },
    { status: 403 },
  );
}

export async function GET(_request: Request, ctx: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "broadcasts")) return forbidden();

  const params = await ctx.params;
  const parsedParams = PARAM_SHAPE.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedParams.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: broadcast, error } = await supabase
    .from("broadcasts")
    .select(BROADCAST_COLS)
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: "detail_failed", message: error.message },
      { status: 500 },
    );
  }
  if (!broadcast) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Pull recipients separately so the operator sees the per-customer
  // status table. Capped at 1000 in v1.1; the spec doesn't model
  // pagination here yet.
  const { data: recipients, error: rcptErr } = await supabase
    .from("broadcast_recipients")
    .select(RECIPIENT_COLS)
    .eq("broadcast_id", parsedParams.data.id)
    .order("status", { ascending: true })
    .order("sent_at", { ascending: false, nullsFirst: true })
    .limit(1000);
  if (rcptErr) {
    return NextResponse.json(
      { error: "detail_failed", message: rcptErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: broadcast as unknown as BroadcastRow,
    recipients: recipients ?? [],
  });
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "broadcasts")) return forbidden();

  const params = await ctx.params;
  const parsedParams = PARAM_SHAPE.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedParams.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: lookupErr } = await supabase
    .from("broadcasts")
    .select("id, status")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json(
      { error: "detail_failed", message: lookupErr.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.status !== "draft") {
    return NextResponse.json(
      {
        error: "not_deletable",
        reason: "Only draft broadcasts can be deleted; sent broadcasts are immutable history.",
        status: existing.status,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("broadcasts")
    .delete()
    .eq("id", parsedParams.data.id);

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
