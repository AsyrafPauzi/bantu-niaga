import { createStaffAssistantRouteHandlers } from "@/lib/ai/staff-assistant-route";
import { runHrAssistantChat } from "@/lib/ai/hr-assistant-run";
import { requireHrAssistantUser } from "@/lib/hr/require-assistant-user";
import { hasHrAssistantAddon } from "@/lib/marketplace/entitlements";
import { HR_AGENT_SLUG } from "@/lib/marketplace/agent-types";

export const dynamic = "force-dynamic";

export const { GET, POST, DELETE } = createStaffAssistantRouteHandlers({
  agentSlug: HR_AGENT_SLUG,
  clarifierKind: "hr",
  rateLimitBucket: "hr.assistant.chat",
  logKey: "hr.assistant",
  addonRequiredMessage:
    "Subscribe to HR Assistant (Hana) in the Marketplace to chat.",
  assistantDisabledMessage:
    "HR Assistant is turned off in Settings → AI Agents.",
  providerMissingMessage:
    "The HR assistant needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel).",
  unavailableMessage:
    "The HR assistant hit a server error. Try again in a moment — your credits and settings are fine.",
  requireUser: requireHrAssistantUser,
  hasAddon: hasHrAssistantAddon,
  includeDailyNoticeInGet: true,
  runChat: runHrAssistantChat,
});
