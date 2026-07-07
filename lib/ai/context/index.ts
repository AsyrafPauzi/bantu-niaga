import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";

import type { Pillar } from "@/lib/permissions";

import { buildAdminSnapshot } from "./admin";
import { buildFinanceSnapshot } from "./finance";
import { buildHrSnapshot } from "./hr";
import { buildMarketingSnapshot } from "./marketing";
import { buildOperationsSnapshot } from "./operations";
import { buildSalesSnapshot } from "./sales";
import { resolveAgentContext } from "./guard";
import type {
  AgentContext,
  BriefingPacket,
  PillarSnapshot,
} from "./types";

/**
 * Single entry point used by every AI agent: returns a token-optimised
 * briefing packet for the requested pillar, strictly tenant-scoped.
 *
 *   const briefing = await buildBriefing("marketing");
 *   openaiChat({
 *     messages: [
 *       { role: "system", content: AGENT_RULES + "\n\n" + briefing.text },
 *       { role: "user", content: userPrompt },
 *     ],
 *   });
 *
 * `resolveAgentContext` is `cache()`-memoised so calling this multiple
 * times in one request share state.
 */

const BUILDERS: Record<
  Pillar,
  (ctx: AgentContext) => Promise<PillarSnapshot>
> = {
  admin: buildAdminSnapshot,
  finance: buildFinanceSnapshot,
  marketing: buildMarketingSnapshot,
  operations: buildOperationsSnapshot,
  sales: buildSalesSnapshot,
  hr: buildHrSnapshot,
};

/**
 * Build a snapshot for `pillar`. Cached per-request so the same agent
 * invocation calling buildBriefing twice doesn't re-hit the DB.
 */
export const buildPillarSnapshot = cache(
  async (pillar: Pillar, ctx?: AgentContext): Promise<PillarSnapshot> => {
    const resolved = ctx ?? (await resolveAgentContext());
    if (pillar === "hr") {
      return getCachedHrSnapshot(resolved);
    }
    return BUILDERS[pillar](resolved);
  },
);

const getCachedHrSnapshot = cache(async (ctx: AgentContext): Promise<PillarSnapshot> => {
  const read = unstable_cache(
    async () => buildHrSnapshot(ctx),
    ["hr-pillar-snapshot", ctx.businessId],
    { revalidate: 120, tags: [`hr-snapshot-${ctx.businessId}`] },
  );
  return read();
});

/**
 * Build a complete briefing packet (snapshot + ready-to-inline text).
 */
export async function buildBriefing(
  pillar: Pillar,
  ctx?: AgentContext,
): Promise<BriefingPacket> {
  const resolved = ctx ?? (await resolveAgentContext());
  const snapshot = await buildPillarSnapshot(pillar, resolved);
  return {
    pillar,
    businessId: resolved.businessId,
    snapshot,
    text: renderBriefingText(snapshot),
  };
}

/**
 * Render a PillarSnapshot into a compact, human-readable text packet
 * optimised for LLM system prompts. Aims for <500 tokens.
 *
 * Format:
 *
 *   [PILLAR overview · business=<id> · generated=<iso>]
 *   <headline>
 *   KPIs:
 *     · label: value [unit]
 *   Recent:
 *     · label — meta (at)
 *   Attention:
 *     · [severity] label
 *   Notes: …
 */
export function renderBriefingText(snapshot: PillarSnapshot): string {
  const lines: string[] = [];
  lines.push(
    `[${snapshot.pillar.toUpperCase()} overview · business=${snapshot.businessId} · generated=${snapshot.generatedAt}]`,
  );
  lines.push(snapshot.headline);
  if (!snapshot.available) {
    lines.push(
      "WARNING: This pillar has no live data — do not invent figures.",
    );
    return lines.join("\n");
  }

  if (snapshot.kpis.length > 0) {
    lines.push("KPIs:");
    for (const k of snapshot.kpis) {
      lines.push(
        `  · ${k.label}: ${k.value}${k.unit ? " " + k.unit : ""}${k.delta ? " (" + k.delta + ")" : ""}`,
      );
    }
  }

  if (snapshot.recent.length > 0) {
    lines.push("Recent:");
    for (const r of snapshot.recent.slice(0, 10)) {
      const at = r.at ? ` (${new Date(r.at).toISOString().slice(0, 10)})` : "";
      const meta = r.meta ? ` — ${r.meta}` : "";
      lines.push(`  · ${r.label}${meta}${at}`);
    }
  }

  if (snapshot.attention.length > 0) {
    lines.push("Attention:");
    for (const a of snapshot.attention) {
      lines.push(`  · [${a.severity}] ${a.label}`);
    }
  }

  if (snapshot.notes) {
    lines.push(`Notes: ${snapshot.notes}`);
  }

  return lines.join("\n");
}

export type { AgentContext, BriefingPacket, PillarSnapshot } from "./types";
export {
  TenantIsolationViolation,
  assertTenantOnly,
  resolveAgentContext,
  requireSameTenant,
} from "./guard";
