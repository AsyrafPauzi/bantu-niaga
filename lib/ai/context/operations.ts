import "server-only";

import type { AgentContext, PillarSnapshot } from "./types";

/**
 * Operations snapshot — placeholder until the orders / bookings /
 * products / suppliers tables land. Returning `available: false` lets
 * the briefing renderer drop the section instead of hallucinating data.
 *
 * When the Operations migration ships:
 *   1. Add real queries for the operations tables (RLS-scoped).
 *   2. Set `available: true` and populate kpis / recent / attention.
 */
export async function buildOperationsSnapshot(
  ctx: AgentContext,
): Promise<PillarSnapshot> {
  return {
    pillar: "operations",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available: false,
    headline:
      "Operations data tables not yet migrated. AI should disclaim that this pillar is read-only roadmap.",
    kpis: [],
    recent: [],
    attention: [],
  };
}
