import { buildSalesSnapshot } from "@/lib/ai/context/sales";
import type { PillarSnapshot } from "@/lib/ai/context/types";
import {
  formatSalesSnapshotPacket,
  runSalesAssistantChat,
} from "@/lib/ai/sales-assistant-run";
import { buildFreeClarifierReply } from "@/lib/ai/assistant-clarifier";
import { buildSmartSalesClarifier } from "@/lib/ai/sales-smart-clarifier";
import { createStaffAssistantRouteHandlers } from "@/lib/ai/staff-assistant-route";
import { requireSalesAssistantUser } from "@/lib/sales/require-assistant-user";
import { hasSalesAssistantAddon } from "@/lib/marketplace/entitlements";
import { SALES_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";

export const dynamic = "force-dynamic";

export const { GET, POST, DELETE } = createStaffAssistantRouteHandlers({
  agentSlug: SALES_AGENT_SLUG,
  clarifierKind: "sales",
  rateLimitBucket: "sales.assistant.chat",
  logKey: "sales.assistant",
  addonRequiredMessage:
    "Subscribe to Sales AI (Sufi) in the Marketplace to chat.",
  assistantDisabledMessage: "Sufi is turned off in Settings → AI Agents.",
  providerMissingMessage:
    "Sufi needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel).",
  unavailableMessage:
    "Sufi hit a server error. Try again in a moment — your credits and settings are fine.",
  requireUser: requireSalesAssistantUser,
  hasAddon: hasSalesAssistantAddon,
  includeDailyNoticeInGet: true,
  loadPostExtras: async (ctx) => {
    const snapshot = await buildSalesSnapshot(ctx);
    return {
      snapshot,
      packetText: formatSalesSnapshotPacket(snapshot),
    };
  },
  resolveClarifierReply: async (post) => {
    const extras = post.extras as {
      snapshot: PillarSnapshot;
      packetText: string;
    };
    const model = resolveAgentModel({
      reasoningMode: post.settings.reasoningMode,
      modelOverride: post.settings.modelOverride,
    });
    const smart = await buildSmartSalesClarifier({
      displayName: post.settings.displayName,
      userMessage: post.message,
      snapshot: extras.snapshot,
      model,
    });
    return (
      smart.reply ||
      buildFreeClarifierReply("sales", post.settings.displayName, post.message)
    );
  },
  runChat: runSalesAssistantChat,
});
