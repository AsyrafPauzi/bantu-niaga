import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedActionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  note: z.string().optional(),
  on: z.boolean(),
});

const guardrailSchema = z.object({
  label: z.string().min(1),
  detail: z.string().min(1),
  severity: z.string().min(1),
});

const escalationSchema = z.object({
  trigger: z.string().min(1),
  target: z.string().min(1),
});

const knowledgeSchema = z.object({
  label: z.string().min(1),
  kind: z.string().min(1),
  size: z.string().min(1),
});

const schema = z
  .object({
    version_label: z.string().min(1).max(40),
    system_prompt: z.string().min(10).max(20000),
    allowed_actions: z.array(allowedActionSchema).max(40),
    guardrails: z.array(guardrailSchema).max(40),
    escalation: z.array(escalationSchema).max(20),
    knowledge_base: z.array(knowledgeSchema).max(40),
    default_tone: z.string().max(80).nullable().optional(),
    publish: z.boolean().default(true),
  })
  .strict();

/**
 * PUT /api/super-admin/agents/[slug]
 *
 * Save a new version of an AI agent's scope + guardrails. When
 * publish=true the agent's `published_version_id` flips to point at the
 * newly created row, which is what the runtime reads. Going forward,
 * Maya / Operations AI / etc. will load this JSON at the start of every
 * conversation and refuse anything outside the allowed_actions set.
 */
export async function PUT(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  await requirePlatformAdmin();
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(body);
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
  const { data, error } = await svc.rpc("super_admin_save_agent_version", {
    p_agent_slug: slug,
    p_version_label: parsed.version_label,
    p_system_prompt: parsed.system_prompt,
    p_allowed_actions: parsed.allowed_actions,
    p_guardrails: parsed.guardrails,
    p_escalation: parsed.escalation,
    p_knowledge_base: parsed.knowledge_base,
    p_default_tone: parsed.default_tone ?? null,
    p_publish: parsed.publish,
  });

  if (error) {
    return NextResponse.json(
      { error: "save_failed", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, version: data });
}
