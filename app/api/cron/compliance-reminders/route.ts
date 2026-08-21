import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";
import { logger } from "@/lib/logger";
import { ok, serverError } from "@/lib/api/response";
import { syncComplianceInAppAlerts } from "@/lib/admin/compliance-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = requireCronAuth(request, requestId);
  if (denied) return denied;

  try {
    const result = await syncComplianceInAppAlerts();
    return ok(result, { requestId });
  } catch (err) {
    logger.error("compliance.reminders.cron.failed", {}, err);
    return serverError(requestId);
  }
}
