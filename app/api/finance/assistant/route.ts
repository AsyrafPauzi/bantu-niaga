import { buildFinanceSnapshot } from "@/lib/ai/context/finance";
import {
  formatFinanceSnapshotPacket,
  runFinanceAssistantChat,
} from "@/lib/ai/finance-assistant-run";
import { createStaffAssistantRouteHandlers } from "@/lib/ai/staff-assistant-route";
import { requireFinanceAssistantUser } from "@/lib/finance/require-user";
import {
  hasFinanceAssistantAddon,
} from "@/lib/marketplace/entitlements";
import { FINANCE_AGENT_SLUG } from "@/lib/marketplace/agent-types";

export const dynamic = "force-dynamic";

export const { GET, POST, DELETE } = createStaffAssistantRouteHandlers({
  agentSlug: FINANCE_AGENT_SLUG,
  clarifierKind: "finance",
  rateLimitBucket: "finance.assistant.chat",
  logKey: "finance.assistant",
  addonRequiredMessage:
    "Subscribe to Finance AI (Fayza) in the Marketplace to chat.",
  assistantDisabledMessage: "Fayza is turned off in Settings → AI Agents.",
  providerMissingMessage:
    "Fayza needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel).",
  unavailableMessage:
    "Fayza hit a server error. Try again in a moment — your credits and settings are fine.",
  requireUser: requireFinanceAssistantUser,
  hasAddon: hasFinanceAssistantAddon,
  loadPostExtras: async (ctx) => {
    const snapshot = await buildFinanceSnapshot(ctx);
    return formatFinanceSnapshotPacket(snapshot);
  },
  runChat: runFinanceAssistantChat,
});
