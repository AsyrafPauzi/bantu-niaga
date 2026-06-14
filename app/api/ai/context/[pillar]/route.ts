import {
  badRequest,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { PILLARS, type Pillar } from "@/lib/permissions";
import {
  buildBriefing,
  TenantIsolationViolation,
} from "@/lib/ai/context";
import {
  resolveAgentContext,
} from "@/lib/ai/context/guard";
import { UnauthorizedError } from "@/lib/auth/current-user";

/**
 * GET /api/ai/context/[pillar]
 *
 * Returns the strictly tenant-scoped briefing packet for the requested
 * pillar. Used by:
 *   - AI agent invocations on the server (the canonical caller)
 *   - The /home dashboard to render a "What does the AI see?" debug
 *     panel for power users (read-only)
 *
 * Notes:
 *   - The `businessId` field on the response is ALWAYS the caller's
 *     own tenant. It cannot be overridden by query string or body.
 *   - Pillar must be one of the six in `lib/permissions.ts`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ pillar: string }> },
) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { pillar } = await context.params;

  if (!(PILLARS as readonly string[]).includes(pillar)) {
    return badRequest(
      `Unknown pillar: ${pillar}. Expected one of: ${PILLARS.join(", ")}.`,
      undefined,
      { requestId },
    );
  }

  let ctx;
  try {
    ctx = await resolveAgentContext();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return unauthorized("Authentication required.", { requestId });
    }
    throw e;
  }

  try {
    const briefing = await buildBriefing(pillar as Pillar, ctx);
    return ok(briefing, { requestId });
  } catch (e) {
    if (e instanceof TenantIsolationViolation) {
      logger.error("ai.context.tenant_drift", {
        requestId,
        pillar,
        userId: ctx.userId,
        error: e.message,
      });
      return serverError(requestId, "AI context could not be produced.");
    }
    logger.error("ai.context.build_failed", {
      requestId,
      pillar,
      userId: ctx.userId,
      error: e instanceof Error ? e.message : String(e),
    });
    return serverError(requestId, "AI context could not be produced.");
  }
}
