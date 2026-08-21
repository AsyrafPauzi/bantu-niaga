import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";
import { logger } from "@/lib/logger";
import { ok, serverError } from "@/lib/api/response";
import { buildOperationsSnapshot } from "@/lib/ai/context/operations";
import { runAgentDailyNoticeCron } from "@/lib/ai/run-agent-daily-notice-cron";
import {
  OPERATIONS_AGENT_SLUG,
  OPERATIONS_ASSISTANT_ADDON_SLUG,
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
        addonSlug: OPERATIONS_ASSISTANT_ADDON_SLUG,
        agentSlug: OPERATIONS_AGENT_SLUG,
        defaultDisplayName: "Aiman",
        pillarLabel: "Operations",
        emptyMessage:
          "No operations data yet — add products, orders, or bookings.",
        calmMessage:
          "• No urgent Operations items today — stock and orders look on track.",
        logKey: "operations.notice.cron",
        buildSnapshot: buildOperationsSnapshot,
      },
      requestId,
    );
    return ok(result, { requestId });
  } catch (err) {
    logger.error("operations.notice.cron.failed", {}, err);
    return serverError(requestId);
  }
}
