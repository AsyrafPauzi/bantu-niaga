import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";
import { logger } from "@/lib/logger";
import { ok, serverError } from "@/lib/api/response";
import { buildFinanceSnapshot } from "@/lib/ai/context/finance";
import { runAgentDailyNoticeCron } from "@/lib/ai/run-agent-daily-notice-cron";
import {
  FINANCE_AGENT_SLUG,
  FINANCE_ASSISTANT_ADDON_SLUG,
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
        addonSlug: FINANCE_ASSISTANT_ADDON_SLUG,
        agentSlug: FINANCE_AGENT_SLUG,
        defaultDisplayName: "Fayza",
        pillarLabel: "Finance",
        emptyMessage:
          "No finance records yet — create an invoice or log a transaction.",
        calmMessage:
          "• No urgent Finance items today — invoices and cash flow look up to date.",
        logKey: "finance.notice.cron",
        buildSnapshot: buildFinanceSnapshot,
      },
      requestId,
    );
    return ok(result, { requestId });
  } catch (err) {
    logger.error("finance.notice.cron.failed", {}, err);
    return serverError(requestId);
  }
}
