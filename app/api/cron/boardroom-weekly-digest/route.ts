import { NextResponse } from "next/server";

import { ok, unauthorized } from "@/lib/api/response";
import { buildBoardroomWeeklyDigest } from "@/lib/ai/boardroom-weekly-digest";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/marketing/email-resend";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Sunday cron — emails owners with the Boardroom weekly digest add-on. */
export async function GET(request: Request) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const fromEmail = process.env.MARKETING_FROM_EMAIL ?? "";

  if (!cronSecret) {
    return unauthorized("CRON_SECRET is not configured.", { requestId });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized("Invalid cron credentials.", { requestId });
  }

  const admin = createServiceRoleClient();
  let sent = 0;
  let skipped = 0;

  const { data: addons, error } = await admin
    .from("business_addons")
    .select("business_id, marketplace_addons!inner(slug)")
    .eq("status", "active")
    .eq("marketplace_addons.slug", "boardroom-weekly");

  if (error) {
    logger.error("boardroom.digest.cron.load_failed", {
      error: error.message,
      requestId,
    });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  for (const row of addons ?? []) {
    const businessId = row.business_id as string;

    const [{ data: business }, { data: owner }] = await Promise.all([
      admin
        .from("businesses")
        .select("id, name")
        .eq("id", businessId)
        .maybeSingle(),
      admin
        .from("users")
        .select("id, email")
        .eq("business_id", businessId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle(),
    ]);

    if (!business || !owner?.email) {
      skipped += 1;
      continue;
    }

    try {
      const digest = await buildBoardroomWeeklyDigest(
        businessId,
        owner.id,
        business.name as string,
        admin,
      );

      const result = await sendEmail({
        to: owner.email,
        subject: digest.subject,
        body: digest.body,
        fromEmail,
        apiKey,
      });

      if (!result.ok) {
        logger.warn("boardroom.digest.cron.send_failed", {
          businessId,
          reason: result.reason,
          requestId,
        });
        skipped += 1;
        continue;
      }

      sent += 1;
    } catch (err) {
      logger.warn("boardroom.digest.cron.business_failed", {
        businessId,
        error: err instanceof Error ? err.message : String(err),
        requestId,
      });
      skipped += 1;
    }
  }

  return ok({ sent, skipped }, { requestId });
}
