import { NextResponse } from "next/server";

import { ok, unauthorized } from "@/lib/api/response";
import { buildOperationsSnapshot } from "@/lib/ai/context/operations";
import { runAgentDailyNoticeCron } from "@/lib/ai/run-agent-daily-notice-cron";
import {
  OPERATIONS_AGENT_SLUG,
  OPERATIONS_ASSISTANT_ADDON_SLUG,
} from "@/lib/marketplace/agent-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
