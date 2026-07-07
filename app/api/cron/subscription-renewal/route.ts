import { NextResponse } from "next/server";

import { ok, unauthorized } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/cron/subscription-renewal — monthly Free RM0 invoices + trial expiry. */
export async function GET(request: Request) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return unauthorized("CRON_SECRET is not configured.", { requestId });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized("Invalid cron credentials.", { requestId });
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("subscription_process_renewals");

  if (error) {
    logger.error("subscription.renewal.cron.failed", {
      error: error.message,
      requestId,
    });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return ok({ renewed: data ?? 0 }, { requestId });
}
