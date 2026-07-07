import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { agentBySlug, normalizeReasoningMode } from "@/lib/settings/ai-agents-catalog";
import { agentSettingsUpdateSchema } from "@/lib/settings/agent-settings-schemas";
import {
  clampDailyBudgetCredits,
  creditsToMyr,
  DAILY_BUDGET_DEFAULT_CREDITS,
  myrToCredits,
} from "@/lib/settings/credit-pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, context: RouteContext) {
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
      { error: "validation_failed", message: "This agent has no daily notice." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("business_agent_settings")
    .select(
      "display_name, assistant_enabled, daily_notice_enabled, reasoning_mode, daily_budget_myr",
    )
    .eq("business_id", user.businessId)
    .eq("agent_slug", slug)
    .maybeSingle();

  const budgetCredits =
    parsed.daily_budget_credits !== undefined
      ? clampDailyBudgetCredits(parsed.daily_budget_credits)
      : clampDailyBudgetCredits(
          myrToCredits(Number(existing?.daily_budget_myr ?? creditsToMyr(DAILY_BUDGET_DEFAULT_CREDITS))),
        );

  const patch: Record<string, unknown> = {
    business_id: user.businessId,
    agent_slug: slug,
    display_name:
      parsed.display_name ?? existing?.display_name ?? def.defaultName,
    assistant_enabled:
      parsed.assistant_enabled ??
      existing?.assistant_enabled ??
      true,
    daily_notice_enabled:
      parsed.daily_notice_enabled ??
      existing?.daily_notice_enabled ??
      (slug === "hr"),
    reasoning_mode:
      parsed.reasoning_mode !== undefined
        ? normalizeReasoningMode(parsed.reasoning_mode)
        : normalizeReasoningMode(existing?.reasoning_mode),
    daily_budget_myr: creditsToMyr(budgetCredits),
  };

  const { data, error } = existing
    ? await supabase
        .from("business_agent_settings")
        .update(patch)
        .eq("business_id", user.businessId)
        .eq("agent_slug", slug)
        .select(
          "agent_slug, display_name, assistant_enabled, daily_notice_enabled, reasoning_mode, daily_budget_myr",
        )
        .single()
    : await supabase
        .from("business_agent_settings")
        .insert(patch)
        .select(
          "agent_slug, display_name, assistant_enabled, daily_notice_enabled, reasoning_mode, daily_budget_myr",
        )
        .single();

  if (error || !data) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "settings.ai_agent.update",
    entity_type: "business_agent_settings",
    entity_id: slug,
    diff: parsed,
  });

  revalidatePath("/settings/ai-agents");
  if (slug === "hr") {
    revalidatePath("/hr/assistant");
    revalidatePath("/hr");
  }

  return NextResponse.json({ settings: data }, { status: 200 });
}
