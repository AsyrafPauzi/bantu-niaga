import "server-only";

import type { AgentContext, PillarSnapshot } from "./types";

/**
 * HR snapshot — placeholder until employees / leave tables land. See
 * operations.ts for the pattern to follow when the HR migration ships.
 */
export async function buildHrSnapshot(
  ctx: AgentContext,
): Promise<PillarSnapshot> {
  return {
    pillar: "hr",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available: false,
    headline:
      "HR data tables not yet migrated. Inform the user this pillar is on the roadmap.",
    kpis: [],
    recent: [],
    attention: [],
  };
}
