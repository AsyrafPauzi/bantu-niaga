import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";

import { ok } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/cron/hr-assistant-renewal — monthly credit grants for all AI assistants (shared pool). */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = requireCronAuth(request, requestId);
  if (denied) return denied;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("hr_assistant_process_renewals");

  if (error) {
    logger.error("hr.renewal.cron.failed", { error: error.message, requestId });
    return dbErrorResponse("rpc_failed", error, "cron.job_failed", { requestId });
  }

  return ok({ renewed: data ?? 0 }, { requestId });
}
