import { buildAdminSnapshot } from "@/lib/ai/context/admin";
import {
  formatAdminSnapshotPacket,
  runAdminAssistantChat,
} from "@/lib/ai/admin-assistant-run";
import { createStaffAssistantRouteHandlers } from "@/lib/ai/staff-assistant-route";
import { requireAdminAssistantUser } from "@/lib/admin/require-assistant-user";
import {
  hasAdminAssistantAddon,
} from "@/lib/marketplace/entitlements";
import { ADMIN_AGENT_SLUG } from "@/lib/marketplace/agent-types";

export const dynamic = "force-dynamic";

export const { GET, POST, DELETE } = createStaffAssistantRouteHandlers({
  agentSlug: ADMIN_AGENT_SLUG,
  clarifierKind: "admin",
  rateLimitBucket: "admin.assistant.chat",
  logKey: "admin.assistant",
  addonRequiredMessage:
    "Subscribe to Admin AI (Amir) in the Marketplace to chat.",
  assistantDisabledMessage: "Amir is turned off in Settings → AI Agents.",
  providerMissingMessage:
    "Amir needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel).",
  unavailableMessage:
    "Amir hit a server error. Try again in a moment — your credits and settings are fine.",
  requireUser: requireAdminAssistantUser,
  hasAddon: hasAdminAssistantAddon,
  chargeActionTopUp: false,
  loadPostExtras: async (ctx) => {
    const snapshot = await buildAdminSnapshot(ctx);
    return formatAdminSnapshotPacket(snapshot);
  },
  runChat: runAdminAssistantChat,
});
