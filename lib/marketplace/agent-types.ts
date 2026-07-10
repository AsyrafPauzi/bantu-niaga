import type { ReasoningMode } from "@/lib/settings/ai-agents-catalog";
import {
  creditsToMyr,
  DAILY_BUDGET_DEFAULT_CREDITS,
  myrToCredits,
} from "@/lib/settings/credit-pricing";

export const HR_ASSISTANT_ADDON_SLUG = "hr-assistant";
export const HR_PUBLIC_HOLIDAYS_ADDON_SLUG = "hr-public-holidays";
export const HR_STAFF_APPRAISAL_ADDON_SLUG = "hr-staff-appraisal";
export const HR_STAFF_PORTAL_ADDON_SLUG = "hr-staff-portal";
export const HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG = "hr-advanced-leave-policy";
export const HR_AGENT_SLUG = "hr";
export const HR_ASSISTANT_MONTHLY_CREDITS = 100;

export const MARKETING_ASSISTANT_ADDON_SLUG = "marketing-assistant";
export const MARKETING_AGENT_SLUG = "marketing";
export const MARKETING_ASSISTANT_MONTHLY_CREDITS = 100;
/** Baseline fast-mode costs — prefer `chatCreditsForReasoning` / `actionCreditsForReasoning`. */
export const HR_CREDIT_COST_CHAT = 1;
export const HR_CREDIT_COST_ACTION = 2;

export {
  actionCreditsForReasoning,
  actionTopUpCreditsForReasoning,
  chatCreditsForReasoning,
} from "@/lib/settings/reasoning-credits";

export interface BusinessAgentSettings {
  businessId: string;
  agentSlug: string;
  displayName: string;
  assistantEnabled: boolean;
  dailyNoticeEnabled: boolean;
  dailyNoticeHour: number;
  reasoningMode: ReasoningMode;
  dailyBudgetCredits: number;
  modelOverride: string | null;
}

export const DEFAULT_HR_AGENT_SETTINGS: Omit<
  BusinessAgentSettings,
  "businessId" | "agentSlug"
> = {
  displayName: "Hana",
  assistantEnabled: true,
  dailyNoticeEnabled: true,
  dailyNoticeHour: 7,
  reasoningMode: "fast",
  dailyBudgetCredits: DAILY_BUDGET_DEFAULT_CREDITS,
  modelOverride: null,
};

export const DEFAULT_MARKETING_AGENT_SETTINGS: Omit<
  BusinessAgentSettings,
  "businessId" | "agentSlug"
> = {
  displayName: "Maya",
  assistantEnabled: true,
  dailyNoticeEnabled: true,
  dailyNoticeHour: 8,
  reasoningMode: "fast",
  dailyBudgetCredits: DAILY_BUDGET_DEFAULT_CREDITS,
  modelOverride: null,
};

export function defaultAgentSettingsForSlug(
  agentSlug: string,
): Omit<BusinessAgentSettings, "businessId" | "agentSlug"> {
  if (agentSlug === HR_AGENT_SLUG) return DEFAULT_HR_AGENT_SETTINGS;
  if (agentSlug === MARKETING_AGENT_SLUG) return DEFAULT_MARKETING_AGENT_SETTINGS;
  return {
    displayName: "Assistant",
    assistantEnabled: true,
    dailyNoticeEnabled: false,
    dailyNoticeHour: 8,
    reasoningMode: "fast",
    dailyBudgetCredits: DAILY_BUDGET_DEFAULT_CREDITS,
    modelOverride: null,
  };
}
