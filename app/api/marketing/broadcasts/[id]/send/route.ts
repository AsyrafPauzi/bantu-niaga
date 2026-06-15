import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildCtcUrl,
  renderTemplate,
  resolveRecipients,
  sendEmailBatch,
  type BroadcastRow,
  type ResolvedRecipient,
} from "@/lib/marketing/broadcasts";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/broadcasts/[id]/send
 *
 * Sends a draft broadcast.
 *
 * Flow:
 *   1. Verify status='draft', lock it by setting status='sending'.
 *   2. Resolve recipients from the segment + channel; filter out
 *      customers without a usable channel address.
 *   3. Insert all resolved customers into broadcast_recipients with
 *      status='queued' via the service-role client (the public RLS
 *      contract denies INSERTs on this table).
 *   4. For whatsapp_ctc: render the wa_url per recipient and return
 *      the list. The actual send happens client-side when the
 *      operator taps the link; the mark-sent route updates each
 *      recipient.
 *   5. For email: batch-send via Resend, update each recipient row
 *      with success or failure, then update aggregate counts +
 *      status (sent / partially_sent / failed).
 */

const PARAM_SHAPE = z.object({ id: z.string().uuid() });

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
  const broadcastId = parsedParams.data.id;

  const supabase = await createSupabaseServerClient();

  // 1. Lookup + status check.
  const { data: broadcastRaw, error: lookupErr } = await supabase
    .from("broadcasts")
    .select(
      "id, business_id, name, channel, segment_id, subject, message_template, coupon_id, status",
    )
    .eq("id", broadcastId)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json(
      { error: "detail_failed", message: lookupErr.message },
      { status: 500 },
    );
  }
  if (!broadcastRaw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const broadcast = broadcastRaw as Pick<
    BroadcastRow,
    "id" | "business_id" | "name" | "channel" | "segment_id" | "subject" | "message_template" | "coupon_id" | "status"
  >;
  if (broadcast.status !== "draft") {
    return NextResponse.json(
      {
        error: "not_sendable",
        reason: `Broadcast is in status '${broadcast.status}'. Only drafts can be sent.`,
        status: broadcast.status,
      },
      { status: 409 },
    );
  }

  // Early email-config check so we don't lock the broadcast to
  // 'sending' just to discover Resend isn't configured.
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const fromEmail = process.env.MARKETING_FROM_EMAIL ?? "";
  if (broadcast.channel === "email") {
    const missing = [
      apiKey ? null : "RESEND_API_KEY",
      fromEmail ? null : "MARKETING_FROM_EMAIL",
    ].filter((v): v is string => v !== null);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "email_channel_not_configured", missing },
        { status: 412 },
      );
    }
  }

  // Resolve the coupon (if any) for placeholder rendering. The
  // coupons table may not exist yet in environments where the
  // sibling worker hasn't merged — gracefully treat a missing table
  // as "no coupon".
  let couponCode: string | null = null;
  if (broadcast.coupon_id) {
    try {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("code")
        .eq("id", broadcast.coupon_id)
        .maybeSingle();
      if (coupon && typeof coupon.code === "string") {
        couponCode = coupon.code;
      }
    } catch {
      // Coupons table not yet shipped — fall through with null code.
    }
  }

  // 2. Lock by transitioning to 'sending'. We re-check status in the
  // WHERE clause to keep a parallel POST from racing us.
  const lockSupabase = createServiceRoleClient();
  const { data: locked, error: lockErr } = await lockSupabase
    .from("broadcasts")
    .update({ status: "sending" })
    .eq("id", broadcastId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (lockErr) {
    return NextResponse.json(
      { error: "lock_failed", message: lockErr.message },
      { status: 500 },
    );
  }
  if (!locked) {
    return NextResponse.json(
      { error: "race_lost", reason: "Another sender already moved this broadcast off draft." },
      { status: 409 },
    );
  }

  // 3. Resolve recipients.
  let resolved: ResolvedRecipient[];
  try {
    resolved = await resolveRecipients({
      supabase,
      businessId: broadcast.business_id,
      segmentId: broadcast.segment_id,
      channel: broadcast.channel,
    });
  } catch (e) {
    // Roll back to draft so the operator can retry after fixing
    // segment data.
    await lockSupabase
      .from("broadcasts")
      .update({ status: "draft" })
      .eq("id", broadcastId);
    return NextResponse.json(
      {
        error: "resolve_failed",
        message: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 },
    );
  }

  // 4. Prepare recipient rows + render messages.
  const rows = resolved.map((r) => {
    const renderedMessage = renderTemplate(
      broadcast.message_template,
      { name: r.name },
      couponCode ? { code: couponCode } : null,
    );
    const renderedSubject =
      broadcast.channel === "email" && broadcast.subject
        ? renderTemplate(
            broadcast.subject,
            { name: r.name },
            couponCode ? { code: couponCode } : null,
          )
        : null;
    return {
      broadcast_id: broadcastId,
      customer_id: r.customer_id,
      channel_address: r.channel_address,
      rendered_message: renderedMessage,
      rendered_subject: renderedSubject,
      status: "queued" as const,
    };
  });

  // If there are no eligible recipients we mark the broadcast as
  // 'failed' so the operator gets a clear signal — the segment was
  // empty or no one had a usable channel address.
  if (rows.length === 0) {
    await lockSupabase
      .from("broadcasts")
      .update({
        status: "failed",
        total_recipients: 0,
        sent_count: 0,
        failed_count: 0,
        sent_at: new Date().toISOString(),
      })
      .eq("id", broadcastId);
    return NextResponse.json(
      {
        broadcast_id: broadcastId,
        channel: broadcast.channel,
        recipients: [],
        warning: "no_eligible_recipients",
      },
      { status: 200 },
    );
  }

  const { data: insertedRaw, error: insertErr } = await lockSupabase
    .from("broadcast_recipients")
    .insert(rows)
    .select("id, customer_id, channel_address, rendered_message, rendered_subject, status");
  if (insertErr) {
    // Best-effort rollback so the broadcast doesn't get stuck in
    // 'sending' forever.
    await lockSupabase
      .from("broadcasts")
      .update({ status: "draft" })
      .eq("id", broadcastId);
    return NextResponse.json(
      { error: "recipients_insert_failed", message: insertErr.message },
      { status: 500 },
    );
  }
  const inserted = (insertedRaw ?? []) as {
    id: string;
    customer_id: string;
    channel_address: string;
    rendered_message: string;
    rendered_subject: string | null;
    status: "queued";
  }[];

  // Update total_recipients up-front so the UI can show the bar
  // immediately, even before the operator has tapped any wa.me links.
  await lockSupabase
    .from("broadcasts")
    .update({ total_recipients: inserted.length })
    .eq("id", broadcastId);

  // 5. Branch on channel.
  if (broadcast.channel === "whatsapp_ctc") {
    // Pair each inserted recipient with the rendered name for the
    // client UI. We look up the original `name` from the resolved
    // list so we don't have to JOIN against customers in the response.
    const byCustomerId = new Map(
      resolved.map((r) => [r.customer_id, r.name]),
    );
    const recipients = inserted.map((row) => ({
      id: row.id,
      customer_id: row.customer_id,
      customer_name: byCustomerId.get(row.customer_id) ?? "",
      phone: row.channel_address,
      wa_url: buildCtcUrl(row.channel_address, row.rendered_message),
      rendered_message: row.rendered_message,
      status: row.status,
    }));

    return NextResponse.json({
      broadcast_id: broadcastId,
      channel: "whatsapp_ctc",
      total_recipients: inserted.length,
      recipients,
    });
  }

  // ─── Email path ──────────────────────────────────────────────────────
  const batchInput = inserted.map((row) => ({
    ref: row.id,
    to: row.channel_address,
    subject: row.rendered_subject ?? broadcast.subject ?? "",
    body: row.rendered_message,
  }));

  const batchResult = await sendEmailBatch(batchInput, { apiKey, fromEmail });

  if (!batchResult.ok) {
    // We already early-returned on missing config; the only way to
    // reach this branch is a Resend HTTP error mid-flight. Mark every
    // recipient as failed, set the broadcast to 'failed'.
    const nowIso = new Date().toISOString();
    await lockSupabase
      .from("broadcast_recipients")
      .update({ status: "failed", error: "resend_misconfigured", sent_at: nowIso })
      .eq("broadcast_id", broadcastId);
    await lockSupabase
      .from("broadcasts")
      .update({
        status: "failed",
        sent_count: 0,
        failed_count: inserted.length,
        sent_at: nowIso,
      })
      .eq("id", broadcastId);
    return NextResponse.json(
      { error: "email_channel_not_configured", missing: batchResult.missing },
      { status: 412 },
    );
  }

  // Apply per-recipient outcomes. We do this row-by-row rather than
  // CASE-based update so the service-role round-trip stays simple.
  let sentCount = 0;
  let failedCount = 0;
  const now = new Date().toISOString();
  for (const r of batchResult.results) {
    if (r.ok) {
      sentCount += 1;
      await lockSupabase
        .from("broadcast_recipients")
        .update({ status: "sent", sent_at: now, error: null })
        .eq("id", r.ref);
    } else {
      failedCount += 1;
      await lockSupabase
        .from("broadcast_recipients")
        .update({
          status: "failed",
          sent_at: now,
          error: (r.error ?? "unknown").slice(0, 500),
        })
        .eq("id", r.ref);
    }
  }

  let finalStatus: BroadcastRow["status"];
  if (failedCount === 0) finalStatus = "sent";
  else if (sentCount === 0) finalStatus = "failed";
  else finalStatus = "partially_sent";

  await lockSupabase
    .from("broadcasts")
    .update({
      status: finalStatus,
      total_recipients: inserted.length,
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: now,
    })
    .eq("id", broadcastId);

  return NextResponse.json({
    broadcast_id: broadcastId,
    channel: "email",
    status: finalStatus,
    total_recipients: inserted.length,
    sent_count: sentCount,
    failed_count: failedCount,
  });
}
