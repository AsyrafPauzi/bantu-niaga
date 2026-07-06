export const HR_ASSISTANT_ADDON_SLUG = "hr-assistant";
export const HR_AGENT_SLUG = "hr";
export const HR_ASSISTANT_MONTHLY_CREDITS = 100;
export const HR_CREDIT_COST_CHAT = 1;
export const HR_CREDIT_COST_ACTION = 2;

export interface BusinessAgentSettings {
  businessId: string;
  agentSlug: string;
  displayName: string;
  assistantEnabled: boolean;
  dailyNoticeEnabled: boolean;
  dailyNoticeHour: number;
}

export const DEFAULT_HR_AGENT_SETTINGS: Omit<
  BusinessAgentSettings,
  "businessId" | "agentSlug"
> = {
  displayName: "Hana",
  assistantEnabled: true,
  dailyNoticeEnabled: true,
  dailyNoticeHour: 7,
};
