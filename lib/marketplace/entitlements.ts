import "server-only";

import {
  DEFAULT_HR_AGENT_SETTINGS,
  HR_AGENT_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
  type BusinessAgentSettings,
} from "@/lib/marketplace/agent-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function hasActiveAddon(
  businessId: string,
  addonSlug: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
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

export async function hasHrAssistantAddon(businessId: string): Promise<boolean> {
  return hasActiveAddon(businessId, HR_ASSISTANT_ADDON_SLUG);
}

export async function loadBusinessAgentSettings(
  businessId: string,
  agentSlug: string = HR_AGENT_SLUG,
): Promise<BusinessAgentSettings> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("business_agent_settings")
    .select(
      "business_id, agent_slug, display_name, assistant_enabled, daily_notice_enabled, daily_notice_hour",
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
      ...DEFAULT_HR_AGENT_SETTINGS,
    };
  }

  return {
    businessId: data.business_id,
    agentSlug: data.agent_slug,
    displayName: data.display_name,
    assistantEnabled: data.assistant_enabled,
    dailyNoticeEnabled: data.daily_notice_enabled,
    dailyNoticeHour: data.daily_notice_hour,
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
