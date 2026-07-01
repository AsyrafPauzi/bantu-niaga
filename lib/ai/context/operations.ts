import "server-only";

import type { AgentContext, PillarSnapshot } from "./types";

export async function buildOperationsSnapshot(
  ctx: AgentContext,
): Promise<PillarSnapshot> {
  return {
    pillar: "operations",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available: false,
    headline:
      "Operations snapshot not yet wired for AI — use the Operations dashboard directly.",
    kpis: [],
    recent: [],
    attention: [],
  };
}
