import { NextResponse } from "next/server";
import { ok, unauthorized } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { computeTenantHealthScores } from "@/lib/super-admin/health";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/cron/tenant-health — recompute tenant health scores daily. */
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

  try {
    const scored = await computeTenantHealthScores();

    const admin = createServiceRoleClient();
    const { data: rollupRows, error: rollupError } = await admin.rpc(
      "rollup_ai_agent_usage_daily",
      { p_day: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
    );

    if (rollupError) {
      logger.warn("tenant-health.rollup.failed", {
        error: rollupError.message,
        requestId,
      });
    }

    return ok(
      { tenants_scored: scored, usage_rows_rolled_up: rollupRows ?? 0 },
      { requestId },
    );
  } catch (error) {
    logger.error("tenant-health.cron.failed", {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "tenant_health_failed" },
      { status: 500 },
    );
  }
}
