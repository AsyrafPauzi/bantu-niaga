import { buildMayaCommerceContext } from "@/lib/ai/maya-commerce-context";
import { runMarketingAssistantChat } from "@/lib/ai/marketing-assistant-run";
import { createStaffAssistantRouteHandlers } from "@/lib/ai/staff-assistant-route";
import { requireMarketingAssistantUser } from "@/lib/marketing/require-assistant-user";
import {
  hasMarketingAssistantAddon,
} from "@/lib/marketplace/entitlements";
import { MARKETING_AGENT_SLUG } from "@/lib/marketplace/agent-types";

export const dynamic = "force-dynamic";

export const { GET, POST, DELETE } = createStaffAssistantRouteHandlers({
  agentSlug: MARKETING_AGENT_SLUG,
  clarifierKind: "marketing",
  rateLimitBucket: "marketing.assistant.chat",
  logKey: "marketing.assistant",
  addonRequiredMessage:
    "Subscribe to Marketing AI (Maya) in the Marketplace to chat.",
  assistantDisabledMessage: "Maya is turned off in Settings → AI Agents.",
  providerMissingMessage:
    "Maya needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel).",
  unavailableMessage:
    "Maya hit a server error. Try again in a moment — your credits and settings are fine.",
  requireUser: requireMarketingAssistantUser,
  hasAddon: hasMarketingAssistantAddon,
  includeDailyNoticeInGet: true,
  loadPostExtras: async (ctx) => {
    const commerce = await buildMayaCommerceContext(ctx);
    return commerce.text;
  },
  runChat: runMarketingAssistantChat,
});
