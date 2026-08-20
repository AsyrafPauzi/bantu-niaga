import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isAddonFeatureAccessible } from "@/lib/marketplace/addon-meta";
import {
  hasAgentEntitlement,
  hasAgentEntitlementWithClient,
} from "@/lib/marketplace/plan-agent-entitlements";
import {
  defaultAgentSettingsForSlug,
  HR_AGENT_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
  HR_PUBLIC_HOLIDAYS_ADDON_SLUG,
  HR_STAFF_APPRAISAL_ADDON_SLUG,
  HR_STAFF_PORTAL_ADDON_SLUG,
  HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG,
  HR_SHIFT_ATTENDANCE_ADDON_SLUG,
  HR_REMINDER_PACK_ADDON_SLUG,
  ADMIN_ASSISTANT_ADDON_SLUG,
  FINANCE_ASSISTANT_ADDON_SLUG,
  MARKETING_ASSISTANT_ADDON_SLUG,
  OPERATIONS_ASSISTANT_ADDON_SLUG,
  SALES_ASSISTANT_ADDON_SLUG,
  type BusinessAgentSettings,
} from "@/lib/marketplace/agent-types";
import { hasPillar } from "@/lib/auth/entitlements";
import type { TierKey } from "@/lib/settings/plans";
import { staffPortalIncludedForTier } from "@/lib/marketplace/staff-portal-entitlement";
import { normalizeReasoningMode } from "@/lib/settings/ai-agents-catalog";
import {
  clampDailyBudgetCredits,
  creditsToMyr,
  DAILY_BUDGET_DEFAULT_CREDITS,
  myrToCredits,
} from "@/lib/settings/credit-pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function loadBusinessTier(
  supabase: SupabaseClient,
  businessId: string,
): Promise<TierKey> {
  const { data, error } = await supabase
    .from("businesses")
    .select("tier")
    .eq("id", businessId)
    .single();
  if (error) throw new Error(error.message);
  return (data?.tier as TierKey) ?? "starter";
}

export async function hasActiveAddonWithClient(
  supabase: SupabaseClient,
  businessId: string,
  addonSlug: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("business_addons")
    .select("id, status, meta, marketplace_addons!inner(slug)")
    .eq("business_id", businessId)
    .in("status", ["active", "pending_cancel"])
    .eq("marketplace_addons.slug", addonSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return false;
  return isAddonFeatureAccessible({
    id: data.id,
    business_id: businessId,
    addon_id: "",
    status: data.status as "active" | "pending_cancel" | "cancelled",
    activated_at: "",
    next_charge_at: null,
    cancel_at: null,
    qty: 1,
    meta: (data.meta as Record<string, unknown>) ?? {},
  });
}

export async function hasActiveAddon(
  businessId: string,
  addonSlug: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  return hasActiveAddonWithClient(supabase, businessId, addonSlug);
}

async function hasAssistantEntitlement(
  businessId: string,
  addonSlug: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const tier = await loadBusinessTier(supabase, businessId);
  return hasAgentEntitlementWithClient(
    supabase,
    businessId,
    tier,
    addonSlug,
  );
}

export async function hasHrAssistantAddon(businessId: string): Promise<boolean> {
  return hasAssistantEntitlement(businessId, HR_ASSISTANT_ADDON_SLUG);
}

export async function hasMarketingAssistantAddon(
  businessId: string,
): Promise<boolean> {
  return hasAssistantEntitlement(businessId, MARKETING_ASSISTANT_ADDON_SLUG);
}

export async function hasSalesAssistantAddon(
  businessId: string,
): Promise<boolean> {
  return hasAssistantEntitlement(businessId, SALES_ASSISTANT_ADDON_SLUG);
}

export async function hasFinanceAssistantAddon(
  businessId: string,
): Promise<boolean> {
  return hasAssistantEntitlement(businessId, FINANCE_ASSISTANT_ADDON_SLUG);
}

export async function hasOperationsAssistantAddon(
  businessId: string,
): Promise<boolean> {
  return hasAssistantEntitlement(businessId, OPERATIONS_ASSISTANT_ADDON_SLUG);
}

export async function hasAdminAssistantAddon(
  businessId: string,
): Promise<boolean> {
  return hasAssistantEntitlement(businessId, ADMIN_ASSISTANT_ADDON_SLUG);
}

export async function hasPublicHolidaysAddon(businessId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const tier = await loadBusinessTier(supabase, businessId);
  if (hasPillar(tier, "hr")) {
    return true;
  }
  return hasActiveAddon(businessId, HR_PUBLIC_HOLIDAYS_ADDON_SLUG);
}

export async function hasStaffAppraisalAddon(businessId: string): Promise<boolean> {
  return hasActiveAddon(businessId, HR_STAFF_APPRAISAL_ADDON_SLUG);
}

export async function hasStaffPortalAddon(businessId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const tier = await loadBusinessTier(supabase, businessId);
  if (staffPortalIncludedForTier(tier)) {
    return true;
  }
  return hasActiveAddon(businessId, HR_STAFF_PORTAL_ADDON_SLUG);
}

export async function hasAdvancedLeavePolicyAddon(
  businessId: string,
): Promise<boolean> {
  return hasActiveAddon(businessId, HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG);
}

export async function hasHrShiftAttendanceAddon(
  businessId: string,
): Promise<boolean> {
  return hasActiveAddon(businessId, HR_SHIFT_ATTENDANCE_ADDON_SLUG);
}

export async function hasHrReminderPackAddon(
  businessId: string,
): Promise<boolean> {
  return hasActiveAddon(businessId, HR_REMINDER_PACK_ADDON_SLUG);
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

// Re-export for assistant routes that need tier-aware checks
export { hasAgentEntitlement, loadEntitledAgentSlugs } from "@/lib/marketplace/plan-agent-entitlements";
