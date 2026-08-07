import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { agentBySlug, normalizeReasoningMode } from "@/lib/settings/ai-agents-catalog";
import { agentSettingsUpdateSchema } from "@/lib/settings/agent-settings-schemas";
import { hasActiveAddon } from "@/lib/marketplace/entitlements";
import {
  clampDailyBudgetCredits,
  creditsToMyr,
  DAILY_BUDGET_DEFAULT_CREDITS,
  myrToCredits,
} from "@/lib/settings/credit-pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadBusinessTier } from "@/lib/settings/load-business-tier";
import { tierAllowsDeepReasoning } from "@/lib/settings/tier-agents";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      throw e;
    }

    if (user.role !== "owner") {
      return NextResponse.json(
        {
          error: "forbidden",
          message: "Only the business owner can change AI agent settings.",
        },
        { status: 403 },
      );
    }

    const { slug } = await context.params;
    const def = agentBySlug(slug);
    if (!def) {
      return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    let parsed;
    try {
      parsed = agentSettingsUpdateSchema.parse(body);
    } catch (e) {
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: "validation_failed", issues: e.issues },
          { status: 400 },
        );
      }
      throw e;
    }

    if (
      parsed.daily_notice_enabled !== undefined &&
      !def.supportsDailyNotice
    ) {
      return NextResponse.json(
        {
          error: "validation_failed",
          message: "This agent has no daily notice.",
        },
        { status: 400 },
      );
    }

    if (parsed.daily_notice_enabled === true && def.addonSlug) {
      const addonActive = await hasActiveAddon(user.businessId, def.addonSlug);
      if (!addonActive) {
        return NextResponse.json(
          {
            error: "validation_failed",
            message: "Subscribe to this agent in Marketplace before enabling daily notices.",
          },
          { status: 400 },
        );
      }
    }

    const supabase = await createSupabaseServerClient();

    if (parsed.reasoning_mode === "deep") {
      const tier = await loadBusinessTier(user.businessId, supabase);
      if (!tierAllowsDeepReasoning(tier)) {
        return NextResponse.json(
          {
            error: "deep_not_allowed",
            message:
              "Deep reasoning is available on Solo and higher plans. Upgrade to unlock ilmu-v3.1.",
          },
          { status: 403 },
        );
      }
    }

    const { data: existing } = await supabase
      .from("business_agent_settings")
      .select(
        "id, display_name, assistant_enabled, daily_notice_enabled, reasoning_mode, daily_budget_myr",
      )
      .eq("business_id", user.businessId)
      .eq("agent_slug", slug)
      .maybeSingle();

    const budgetCredits =
      parsed.daily_budget_credits !== undefined
        ? clampDailyBudgetCredits(parsed.daily_budget_credits)
        : clampDailyBudgetCredits(
            myrToCredits(
              Number(
                existing?.daily_budget_myr ??
                  creditsToMyr(DAILY_BUDGET_DEFAULT_CREDITS),
              ),
            ),
          );

    const row = {
      business_id: user.businessId,
      agent_slug: slug,
      display_name:
        parsed.display_name ?? existing?.display_name ?? def.defaultName,
      assistant_enabled:
        parsed.assistant_enabled ?? existing?.assistant_enabled ?? true,
      daily_notice_enabled:
        parsed.daily_notice_enabled ??
        existing?.daily_notice_enabled ??
        def.supportsDailyNotice,
      reasoning_mode:
        parsed.reasoning_mode !== undefined
          ? normalizeReasoningMode(parsed.reasoning_mode)
          : normalizeReasoningMode(existing?.reasoning_mode),
      daily_budget_myr: creditsToMyr(budgetCredits),
    };

    const { data, error } = await supabase
      .from("business_agent_settings")
      .upsert(row, { onConflict: "business_id,agent_slug" })
      .select(
        "id, agent_slug, display_name, assistant_enabled, daily_notice_enabled, reasoning_mode, daily_budget_myr",
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          error: "save_failed",
          message: error?.message ?? "Could not save settings.",
        },
        { status: 500 },
      );
    }

    void supabase.from("audit_log").insert({
      business_id: user.businessId,
      actor_user_id: user.id,
      action: "settings.ai_agent.update",
      entity_type: "business_agent_settings",
      entity_id: data.id,
      diff: { agent_slug: slug, ...parsed },
    });

    revalidatePath("/settings/ai-agents");
    revalidatePath("/home");
    if (slug === "hr") {
      revalidatePath("/hr/assistant");
      revalidatePath("/hr");
    }

    return NextResponse.json({ settings: data }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save settings.";
    return NextResponse.json(
      { error: "server_error", message },
      { status: 500 },
    );
  }
}
