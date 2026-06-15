import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/broadcasts/[id]/recipients/[rid]/mark-sent
 *
 * The click-to-chat tap-tracker. The operator taps the wa.me link,
 * WhatsApp opens prefilled, they tap send, then they tap "Mark sent"
 * in the app — this route logs that single hand-send.
 *
 * Behaviour:
 *   1. Authorize the caller (same RBAC as broadcasts surface).
 *   2. Look up the parent broadcast under RLS (proves tenant scope
 *      and provides the channel for the safety check below).
 *   3. Update the recipient row to status='sent', sent_at=now() via
 *      service-role (broadcast_recipients has no public UPDATE policy).
 *   4. Recount: if all queued recipients are now sent or failed,
 *      transition broadcasts.status to 'sent' or 'partially_sent'.
 */

const PARAM_SHAPE = z.object({
  id: z.string().uuid(),
  rid: z.string().uuid(),
});

interface RouteContext {
  params: Promise<{ id: string; rid: string }>;
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

export async function POST(_request: Request, ctx: RouteContext) {
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
  const { id: broadcastId, rid: recipientId } = parsedParams.data;

  const supabase = await createSupabaseServerClient();

  // RLS-scoped lookup of the parent broadcast proves tenant scope.
  const { data: broadcast, error: bcastErr } = await supabase
    .from("broadcasts")
    .select("id, business_id, channel, status, total_recipients")
    .eq("id", broadcastId)
    .maybeSingle();
  if (bcastErr) {
    return NextResponse.json(
      { error: "detail_failed", message: bcastErr.message },
      { status: 500 },
    );
  }
  if (!broadcast) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (broadcast.channel !== "whatsapp_ctc") {
    return NextResponse.json(
      {
        error: "wrong_channel",
        reason: "mark-sent is only meaningful for whatsapp_ctc broadcasts.",
      },
      { status: 409 },
    );
  }

  // RLS-scoped recipient lookup. Belongs-to check via broadcast_id +
  // the same-business policy on broadcast_recipients.
  const { data: recipient, error: rcptErr } = await supabase
    .from("broadcast_recipients")
    .select("id, broadcast_id, status")
    .eq("id", recipientId)
    .eq("broadcast_id", broadcastId)
    .maybeSingle();
  if (rcptErr) {
    return NextResponse.json(
      { error: "detail_failed", message: rcptErr.message },
      { status: 500 },
    );
  }
  if (!recipient) {
    return NextResponse.json({ error: "recipient_not_found" }, { status: 404 });
  }
  if (recipient.status === "sent") {
    return NextResponse.json(
      { ok: true, already_sent: true },
      { status: 200 },
    );
  }

  const service = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await service
    .from("broadcast_recipients")
    .update({ status: "sent", sent_at: nowIso, error: null })
    .eq("id", recipientId);
  if (updateErr) {
    return NextResponse.json(
      { error: "update_failed", message: updateErr.message },
      { status: 500 },
    );
  }

  // Recount aggregate counters. Cheap: 1 row each via count:'exact'.
  const { count: sentCount } = await service
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .eq("status", "sent");
  const { count: failedCount } = await service
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .eq("status", "failed");
  const { count: queuedCount } = await service
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .eq("status", "queued");

  const patch: Record<string, unknown> = {
    sent_count: sentCount ?? 0,
    failed_count: failedCount ?? 0,
  };
  // When every recipient is out of 'queued', flip the broadcast to
  // a terminal status. 'sent' if all sent; 'partially_sent' if mixed;
  // 'failed' if all failed.
  if ((queuedCount ?? 0) === 0) {
    if ((failedCount ?? 0) === 0) {
      patch.status = "sent";
    } else if ((sentCount ?? 0) === 0) {
      patch.status = "failed";
    } else {
      patch.status = "partially_sent";
    }
    patch.sent_at = nowIso;
  }

  const { error: bcastUpdateErr } = await service
    .from("broadcasts")
    .update(patch)
    .eq("id", broadcastId);
  if (bcastUpdateErr) {
    return NextResponse.json(
      { error: "broadcast_update_failed", message: bcastUpdateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    recipient_id: recipientId,
    broadcast_status: patch.status ?? broadcast.status,
    sent_count: patch.sent_count,
    failed_count: patch.failed_count,
  });
}
