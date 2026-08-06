import { NextResponse } from "next/server";
import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";
import { processUndispatchedOutbox } from "@/lib/events/dispatcher";
import "@/lib/events/register-handlers";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/events-dispatch
 * Replays undispatched `events_outbox` rows (cross-pillar sync recovery).
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = requireCronAuth(request, requestId);
  if (denied) return denied;

  try {
    const admin = createServiceRoleClient();
    const results = await processUndispatchedOutbox(admin, { limit: 100 });
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      logger.warn("events-dispatch.cron.partial_failure", {
        requestId,
        failed: failed.slice(0, 10),
        processed: results.length,
      });
    }
    return NextResponse.json({
      ok: true,
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: failed.length,
    });
  } catch (e) {
    logger.error("events-dispatch.cron.failed", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      {
        ok: false,
        error: "dispatch_failed",
        message: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
