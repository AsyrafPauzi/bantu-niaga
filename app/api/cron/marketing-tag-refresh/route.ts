import { NextResponse } from "next/server";
import { ok, unauthorized } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/marketing-tag-refresh
 * Nightly recompute of customer auto-tags (VIP, dormant, at-risk, …).
 */
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

  const runId = crypto.randomUUID();
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("marketing_apply_auto_tags_all", {
      p_run_id: runId,
    });

    if (error) {
      logger.error("marketing-tag-refresh.cron.failed", {
        error: error.message,
        requestId,
        runId,
      });
      return NextResponse.json(
        { ok: false, error: "tag_refresh_failed", message: error.message },
        { status: 500 },
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const updated = rows.reduce(
      (sum: number, row: { updated_count?: number | null }) =>
        sum + (Number(row.updated_count) || 0),
      0,
    );

    logger.info("marketing-tag-refresh.cron.ok", {
      requestId,
      runId,
      businesses: rows.length,
      customers_updated: updated,
    });

    return ok(
      {
        run_id: runId,
        businesses: rows.length,
        customers_updated: updated,
      },
      { requestId },
    );
  } catch (error) {
    logger.error("marketing-tag-refresh.cron.exception", {
      error: error instanceof Error ? error.message : String(error),
      requestId,
      runId,
    });
    return NextResponse.json(
      { ok: false, error: "tag_refresh_failed" },
      { status: 500 },
    );
  }
}
