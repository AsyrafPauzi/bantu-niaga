import { buildOperationsSnapshot } from "@/lib/ai/context/operations";
import {
  buildOperationsOutOfScopeReply,
  detectOperationsAssistantOutOfScope,
} from "@/lib/ai/assistant-pillar-guard";
import {
  formatOperationsSnapshotPacket,
  runOperationsAssistantChat,
} from "@/lib/ai/operations-assistant-run";
import { createStaffAssistantRouteHandlers } from "@/lib/ai/staff-assistant-route";
import { requireOperationsAssistantUser } from "@/lib/operations/require-assistant-user";
import {
  hasOperationsAssistantAddon,
} from "@/lib/marketplace/entitlements";
import { OPERATIONS_AGENT_SLUG } from "@/lib/marketplace/agent-types";

export const dynamic = "force-dynamic";

export const { GET, POST, DELETE } = createStaffAssistantRouteHandlers({
  agentSlug: OPERATIONS_AGENT_SLUG,
  clarifierKind: "operations",
  rateLimitBucket: "operations.assistant.chat",
  logKey: "operations.assistant",
  addonRequiredMessage:
    "Subscribe to Operations AI (Aiman) in the Marketplace to chat.",
  assistantDisabledMessage: "Aiman is turned off in Settings → AI Agents.",
  providerMissingMessage:
    "Aiman needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel).",
  unavailableMessage:
    "Aiman hit a server error. Try again in a moment — your credits and settings are fine.",
  requireUser: requireOperationsAssistantUser,
  hasAddon: hasOperationsAssistantAddon,
  chargeActionTopUp: false,
  loadPostExtras: async (ctx) => {
    const snapshot = await buildOperationsSnapshot(ctx);
    return formatOperationsSnapshotPacket(snapshot);
  },
  tryEarlyReply: async (post) => {
    const outOfScope = detectOperationsAssistantOutOfScope(post.message);
    if (!outOfScope) return null;
    return {
      reply: buildOperationsOutOfScopeReply(
        post.settings.displayName,
        outOfScope,
      ),
      outOfScope: true,
      metadata: { pillar: outOfScope.pillar },
    };
  },
  runChat: runOperationsAssistantChat,
});
