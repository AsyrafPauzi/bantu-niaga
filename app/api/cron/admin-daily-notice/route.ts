import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";
import { logger } from "@/lib/logger";
import { ok, serverError } from "@/lib/api/response";
import { buildAdminSnapshot } from "@/lib/ai/context/admin";
import { runAgentDailyNoticeCron } from "@/lib/ai/run-agent-daily-notice-cron";
import {
  ADMIN_AGENT_SLUG,
  ADMIN_ASSISTANT_ADDON_SLUG,
} from "@/lib/marketplace/agent-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = requireCronAuth(request, requestId);
  if (denied) return denied;

  try {
    const result = await runAgentDailyNoticeCron(
      {
        addonSlug: ADMIN_ASSISTANT_ADDON_SLUG,
        agentSlug: ADMIN_AGENT_SLUG,
        defaultDisplayName: "Amir",
        pillarLabel: "Admin",
        emptyMessage:
          "No admin activity yet — your business overview will appear here.",
        calmMessage:
          "• No urgent Admin items today — compliance and tasks look up to date.",
        logKey: "admin.notice.cron",
        buildSnapshot: buildAdminSnapshot,
      },
      requestId,
    );
    return ok(result, { requestId });
  } catch (err) {
    logger.error("admin.notice.cron.failed", {}, err);
    return serverError(requestId);
  }
}
