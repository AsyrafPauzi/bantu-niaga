import type { ReasoningMode } from "@/lib/settings/ai-agents-catalog";
import {
  creditsToMyr,
  DAILY_BUDGET_DEFAULT_CREDITS,
  myrToCredits,
} from "@/lib/settings/credit-pricing";

export {
  ADMIN_ASSISTANT_ADDON_SLUG,
  FINANCE_ASSISTANT_ADDON_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
  MARKETING_ASSISTANT_ADDON_SLUG,
  OPERATIONS_ASSISTANT_ADDON_SLUG,
  SALES_ASSISTANT_ADDON_SLUG,
} from "@/lib/marketplace/agent-addon-slugs";

export const HR_PUBLIC_HOLIDAYS_ADDON_SLUG = "hr-public-holidays";
export const HR_STAFF_APPRAISAL_ADDON_SLUG = "hr-staff-appraisal";
export const HR_STAFF_PORTAL_ADDON_SLUG = "hr-staff-portal";
export const HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG = "hr-advanced-leave-policy";
export const HR_AGENT_SLUG = "hr";
export const HR_ASSISTANT_MONTHLY_CREDITS = 100;

export const MARKETING_AGENT_SLUG = "marketing";
export const MARKETING_ASSISTANT_MONTHLY_CREDITS = 100;

export const SALES_AGENT_SLUG = "sales";
export const SALES_ASSISTANT_MONTHLY_CREDITS = 100;

export const FINANCE_AGENT_SLUG = "finance";
export const FINANCE_ASSISTANT_MONTHLY_CREDITS = 100;

export const OPERATIONS_AGENT_SLUG = "operations";
export const OPERATIONS_ASSISTANT_MONTHLY_CREDITS = 100;

export const ADMIN_AGENT_SLUG = "admin";
export const ADMIN_ASSISTANT_MONTHLY_CREDITS = 100;
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

export const DEFAULT_SALES_AGENT_SETTINGS: Omit<
  BusinessAgentSettings,
  "businessId" | "agentSlug"
> = {
  displayName: "Sufi",
  assistantEnabled: true,
  dailyNoticeEnabled: true,
  dailyNoticeHour: 8,
  reasoningMode: "fast",
  dailyBudgetCredits: DAILY_BUDGET_DEFAULT_CREDITS,
  modelOverride: null,
};

export const DEFAULT_FINANCE_AGENT_SETTINGS: Omit<
  BusinessAgentSettings,
  "businessId" | "agentSlug"
> = {
  displayName: "Fayza",
  assistantEnabled: true,
  dailyNoticeEnabled: true,
  dailyNoticeHour: 8,
  reasoningMode: "fast",
  dailyBudgetCredits: DAILY_BUDGET_DEFAULT_CREDITS,
  modelOverride: null,
};

export const DEFAULT_OPERATIONS_AGENT_SETTINGS: Omit<
  BusinessAgentSettings,
  "businessId" | "agentSlug"
> = {
  displayName: "Aiman",
  assistantEnabled: true,
  dailyNoticeEnabled: true,
  dailyNoticeHour: 8,
  reasoningMode: "fast",
  dailyBudgetCredits: DAILY_BUDGET_DEFAULT_CREDITS,
  modelOverride: null,
};

export const DEFAULT_ADMIN_AGENT_SETTINGS: Omit<
  BusinessAgentSettings,
  "businessId" | "agentSlug"
> = {
  displayName: "Amir",
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
  if (agentSlug === SALES_AGENT_SLUG) return DEFAULT_SALES_AGENT_SETTINGS;
  if (agentSlug === FINANCE_AGENT_SLUG) return DEFAULT_FINANCE_AGENT_SETTINGS;
  if (agentSlug === OPERATIONS_AGENT_SLUG) return DEFAULT_OPERATIONS_AGENT_SETTINGS;
  if (agentSlug === ADMIN_AGENT_SLUG) return DEFAULT_ADMIN_AGENT_SETTINGS;
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
