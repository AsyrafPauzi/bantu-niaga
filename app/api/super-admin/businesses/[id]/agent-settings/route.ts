import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  ALLOWED_MODEL_OVERRIDES,
  normalizeReasoningMode,
} from "@/lib/settings/ai-agents-catalog";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z
  .object({
    agent_slug: z.string().min(1).max(40),
    reasoning_mode: z.enum(["fast", "deep"]).optional(),
    model_override: z
      .union([z.enum(ALLOWED_MODEL_OVERRIDES), z.literal(""), z.null()])
      .optional(),
  })
  .strict();

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await requirePlatformAdmin();
  const { id: businessId } = await ctx.params;
  const svc = createServiceRoleClient();

  const { data, error } = await svc
    .from("business_agent_settings")
    .select(
      "agent_slug, display_name, assistant_enabled, reasoning_mode, model_override, daily_budget_myr",
    )
    .eq("business_id", businessId)
    .order("agent_slug", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data ?? [] }, { status: 200 });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requirePlatformAdmin();
  const { id: businessId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed: z.infer<typeof patchSchema>;
  try {
    parsed = patchSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const svc = createServiceRoleClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.reasoning_mode !== undefined) {
    update.reasoning_mode = normalizeReasoningMode(parsed.reasoning_mode);
  }
  if (parsed.model_override !== undefined) {
    update.model_override = normalizeOverride(parsed.model_override);
  }

  const { data: existing } = await svc
    .from("business_agent_settings")
    .select("agent_slug")
    .eq("business_id", businessId)
    .eq("agent_slug", parsed.agent_slug)
    .maybeSingle();

  let row;
  if (existing) {
    const { data, error } = await svc
      .from("business_agent_settings")
      .update(update)
      .eq("business_id", businessId)
      .eq("agent_slug", parsed.agent_slug)
      .select(
        "agent_slug, display_name, assistant_enabled, reasoning_mode, model_override",
      )
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    row = data;
  } else {
    const { data, error } = await svc
      .from("business_agent_settings")
      .insert({
        business_id: businessId,
        agent_slug: parsed.agent_slug,
        display_name: parsed.agent_slug,
        assistant_enabled: true,
        reasoning_mode: normalizeReasoningMode(parsed.reasoning_mode),
        model_override: normalizeOverride(parsed.model_override),
      })
      .select(
        "agent_slug, display_name, assistant_enabled, reasoning_mode, model_override",
      )
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }
    row = data;
  }

  await svc.from("super_admin_audit").insert({
    admin_user_id: admin.userId,
    admin_email: admin.email,
    action: "tenant.agent_routing",
    target_type: "business_agent_settings",
    target_id: businessId,
    target_business_id: businessId,
    diff: {
      agent_slug: parsed.agent_slug,
      reasoning_mode: parsed.reasoning_mode,
      model_override: parsed.model_override,
    },
  });

  return NextResponse.json({ setting: row }, { status: 200 });
}

function normalizeOverride(
  value: string | null | undefined,
): string | null {
  if (!value || value.trim() === "") return null;
  return value;
}
