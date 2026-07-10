import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  defaultAgentSettingsForSlug,
  HR_AGENT_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
  HR_PUBLIC_HOLIDAYS_ADDON_SLUG,
  HR_STAFF_APPRAISAL_ADDON_SLUG,
  HR_STAFF_PORTAL_ADDON_SLUG,
  HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG,
  MARKETING_ASSISTANT_ADDON_SLUG,
  type BusinessAgentSettings,
} from "@/lib/marketplace/agent-types";
import { normalizeReasoningMode } from "@/lib/settings/ai-agents-catalog";
import {
  clampDailyBudgetCredits,
  creditsToMyr,
  DAILY_BUDGET_DEFAULT_CREDITS,
  myrToCredits,
} from "@/lib/settings/credit-pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function hasActiveAddonWithClient(
  supabase: SupabaseClient,
  businessId: string,
  addonSlug: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("business_addons")
    .select("id, status, marketplace_addons!inner(slug)")
    .eq("business_id", businessId)
    .eq("status", "active")
    .eq("marketplace_addons.slug", addonSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return !!data;
}

export async function hasActiveAddon(
  businessId: string,
  addonSlug: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  return hasActiveAddonWithClient(supabase, businessId, addonSlug);
}

export async function hasHrAssistantAddon(businessId: string): Promise<boolean> {
  return hasActiveAddon(businessId, HR_ASSISTANT_ADDON_SLUG);
}

export async function hasMarketingAssistantAddon(
  businessId: string,
): Promise<boolean> {
  return hasActiveAddon(businessId, MARKETING_ASSISTANT_ADDON_SLUG);
}

export async function hasPublicHolidaysAddon(businessId: string): Promise<boolean> {
  return hasActiveAddon(businessId, HR_PUBLIC_HOLIDAYS_ADDON_SLUG);
}

export async function hasStaffAppraisalAddon(businessId: string): Promise<boolean> {
  return hasActiveAddon(businessId, HR_STAFF_APPRAISAL_ADDON_SLUG);
}

export async function hasStaffPortalAddon(businessId: string): Promise<boolean> {
  return hasActiveAddon(businessId, HR_STAFF_PORTAL_ADDON_SLUG);
}

export async function hasAdvancedLeavePolicyAddon(
  businessId: string,
): Promise<boolean> {
  return hasActiveAddon(businessId, HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG);
}

export async function loadBusinessAgentSettings(
  businessId: string,
  agentSlug: string = HR_AGENT_SLUG,
): Promise<BusinessAgentSettings> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("business_agent_settings")
    .select(
      "business_id, agent_slug, display_name, assistant_enabled, daily_notice_enabled, daily_notice_hour, reasoning_mode, daily_budget_myr, model_override",
    )
    .eq("business_id", businessId)
    .eq("agent_slug", agentSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      businessId,
      agentSlug,
      ...defaultAgentSettingsForSlug(agentSlug),
    };
  }

  return {
    businessId: data.business_id,
    agentSlug: data.agent_slug,
    displayName: data.display_name,
    assistantEnabled: data.assistant_enabled,
    dailyNoticeEnabled: data.daily_notice_enabled,
    dailyNoticeHour: data.daily_notice_hour,
    reasoningMode: normalizeReasoningMode(data.reasoning_mode),
    dailyBudgetCredits: clampDailyBudgetCredits(
      myrToCredits(
        Number(data.daily_budget_myr ?? creditsToMyr(DAILY_BUDGET_DEFAULT_CREDITS)),
      ),
    ),
    modelOverride: data.model_override ?? null,
  };
}

export async function getCreditBalance(businessId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("credit_balance")
    .eq("id", businessId)
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data.credit_balance ?? 0;
}
