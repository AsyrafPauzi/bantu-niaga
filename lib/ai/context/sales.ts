import "server-only";

import type { AgentContext, PillarSnapshot } from "./types";

/**
 * Sales snapshot — placeholder until leads / POS tables land. See
 * operations.ts for the pattern to follow when the Sales migration
 * ships.
 */
export async function buildSalesSnapshot(
  ctx: AgentContext,
): Promise<PillarSnapshot> {
  return {
    pillar: "sales",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available: false,
    headline:
      "Sales data tables not yet migrated. Inform the user this pillar is on the roadmap.",
    kpis: [],
    recent: [],
    attention: [],
  };
}
