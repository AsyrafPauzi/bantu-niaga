import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { renderBriefingText } from "@/lib/ai/context";
import { buildAdminSnapshot } from "@/lib/ai/context/admin";
import { buildFinanceSnapshot } from "@/lib/ai/context/finance";
import { buildHrSnapshot } from "@/lib/ai/context/hr";
import { buildMarketingSnapshot } from "@/lib/ai/context/marketing";
import { buildOperationsSnapshot } from "@/lib/ai/context/operations";
import { buildSalesSnapshot } from "@/lib/ai/context/sales";
import type { AgentContext, PillarSnapshot } from "@/lib/ai/context/types";
import { boardroomAgentLabel } from "@/lib/ai/boardroom-access";
import {
  AI_AGENT_ADDON_SLUGS,
  loadActiveAiAgentSlugs,
} from "@/lib/ai/boardroom";
import type { Pillar } from "@/lib/permissions";

const ADDON_TO_PILLAR: Record<(typeof AI_AGENT_ADDON_SLUGS)[number], Pillar> = {
  "hr-assistant": "hr",
  "finance-assistant": "finance",
  "marketing-assistant": "marketing",
  "operations-assistant": "operations",
  "sales-assistant": "sales",
  "admin-assistant": "admin",
};

export interface BoardroomWeeklyDigest {
  subject: string;
  body: string;
  weekLabel: string;
  snapshots: PillarSnapshot[];
}

function malaysiaWeekLabel(date = new Date()): string {
  const end = new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
  const start = new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(date.getTime() - 6 * 24 * 60 * 60 * 1000));
  return `${start} – ${end}`;
}

async function buildSnapshotForPillar(
  pillar: Pillar,
  ctx: AgentContext,
  client: SupabaseClient,
): Promise<PillarSnapshot> {
  switch (pillar) {
    case "finance":
      return buildFinanceSnapshot(ctx);
    case "marketing":
      return buildMarketingSnapshot(ctx, client);
    case "sales":
      return buildSalesSnapshot(ctx, client);
    case "hr":
      return buildHrSnapshot(ctx, client);
    case "operations":
      return buildOperationsSnapshot(ctx);
    case "admin":
      return buildAdminSnapshot(ctx);
    default:
      return buildMarketingSnapshot(ctx, client);
  }
}

/**
 * Template-only weekly Boardroom digest (0 LLM credits).
 * Aggregates pillar snapshots for every active module AI agent.
 */
export async function buildBoardroomWeeklyDigest(
  businessId: string,
  ownerUserId: string,
  businessName: string,
  client: SupabaseClient,
): Promise<BoardroomWeeklyDigest> {
  const ctx: AgentContext = {
    businessId,
    userId: ownerUserId,
    role: "owner",
    impersonated: false,
  };

  const activeSlugs = await loadActiveAiAgentSlugs(businessId, client);
  const pillars = AI_AGENT_ADDON_SLUGS.filter((slug) => activeSlugs.has(slug)).map(
    (slug) => ADDON_TO_PILLAR[slug],
  );

  const uniquePillars = [...new Set(pillars)];
  const snapshots = await Promise.all(
    uniquePillars.map((pillar) => buildSnapshotForPillar(pillar, ctx, client)),
  );

  const weekLabel = malaysiaWeekLabel();
  const lines: string[] = [
    `Weekly digest for ${businessName}`,
    `Week of ${weekLabel}`,
    "",
    "Here is what your AI agents are seeing across your business:",
    "",
  ];

  if (snapshots.length === 0) {
    lines.push(
      "No module AI agents are active yet. Activate agents in Settings → AI Agents to unlock weekly insights.",
    );
  } else {
    for (const snapshot of snapshots) {
      const agentLabel = boardroomAgentLabel(snapshot.pillar);
      lines.push(`── ${agentLabel} (${snapshot.pillar}) ──`);
      lines.push(renderBriefingText(snapshot));
      lines.push("");
    }
    lines.push(
      "Open the Boardroom in Bantu Niaga to dig deeper or run a multi-agent strategy session.",
    );
  }

  return {
    weekLabel,
    snapshots,
    subject: `Boardroom weekly digest · ${businessName} · ${weekLabel}`,
    body: lines.join("\n"),
  };
}
