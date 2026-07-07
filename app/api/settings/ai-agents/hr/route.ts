import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import {
  getCreditBalance,
  hasHrAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { HR_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { hrAgentSettingsSchema } from "@/lib/settings/agent-settings-schemas";
import {
  creditsToMyr,
  DAILY_BUDGET_DEFAULT_CREDITS,
} from "@/lib/settings/credit-pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireHrSettingsUser() {
  try {
    const user = await getCurrentUser();
    if (!canManageHrCore(user.role)) {
      return {
        user: null,
        response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
      };
    }
    return { user, response: null };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      };
    }
    throw error;
  }
}

export async function GET() {
  const { user, response } = await requireHrSettingsUser();
  if (response) return response;

  const [settings, addonActive, balance] = await Promise.all([
    loadBusinessAgentSettings(user.businessId),
    hasHrAssistantAddon(user.businessId),
    getCreditBalance(user.businessId),
  ]);

  return NextResponse.json({
    settings: {
      display_name: settings.displayName,
      assistant_enabled: settings.assistantEnabled,
      daily_notice_enabled: settings.dailyNoticeEnabled,
    },
    addon_active: addonActive,
    credit_balance: balance,
  });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireHrSettingsUser();
  if (response) return response;

  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "forbidden", message: "Only the owner can change AI agent settings." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = hrAgentSettingsSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("business_agent_settings")
    .select(
      "display_name, assistant_enabled, daily_notice_enabled, reasoning_mode, daily_budget_myr",
    )
    .eq("business_id", user.businessId)
    .eq("agent_slug", HR_AGENT_SLUG)
    .maybeSingle();

  const { data, error } = await supabase
    .from("business_agent_settings")
    .upsert(
      {
        business_id: user.businessId,
        agent_slug: HR_AGENT_SLUG,
        display_name: parsed.display_name,
        assistant_enabled: parsed.assistant_enabled,
        daily_notice_enabled: parsed.daily_notice_enabled,
        reasoning_mode: existing?.reasoning_mode ?? "fast",
        daily_budget_myr:
          existing?.daily_budget_myr ??
          creditsToMyr(DAILY_BUDGET_DEFAULT_CREDITS),
      },
      { onConflict: "business_id,agent_slug" },
    )
    .select("display_name, assistant_enabled, daily_notice_enabled")
    .single();

  if (error) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  return NextResponse.json({ settings: data }, { status: 200 });
}
