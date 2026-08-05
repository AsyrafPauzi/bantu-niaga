/**
 * Prefill super-admin AI agent scope (prompt, actions, guardrails) for all 7 agents.
 *
 *   npm run seed:agent-scopes
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { AGENT_SCOPE_SEEDS } from "../lib/super-admin/agent-scope-catalog";

function loadDotEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadDotEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const svc = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const seed of AGENT_SCOPE_SEEDS) {
    const { data: agent, error: agentErr } = await svc
      .from("ai_agents")
      .select("id, slug, published_version_id")
      .eq("slug", seed.slug)
      .maybeSingle();

    if (agentErr || !agent) {
      console.warn(`skip ${seed.slug}: agent row not found`);
      continue;
    }

    const payload = {
      version_label: seed.versionLabel,
      system_prompt: seed.systemPrompt,
      allowed_actions: seed.allowedActions,
      guardrails: seed.guardrails,
      escalation: seed.escalation,
      knowledge_base: seed.knowledgeBase,
      default_tone: seed.defaultTone,
      published_at: new Date().toISOString(),
    };

    if (agent.published_version_id) {
      const { error: updErr } = await svc
        .from("ai_agent_versions")
        .update(payload)
        .eq("id", agent.published_version_id);
      if (updErr) {
        console.error(`update failed ${seed.slug}:`, updErr.message);
        process.exit(1);
      }
      console.log(`updated ${seed.slug} → ${seed.versionLabel}`);
    } else {
      const { data: ver, error: insErr } = await svc
        .from("ai_agent_versions")
        .insert({
          agent_id: agent.id,
          ...payload,
        })
        .select("id")
        .single();
      if (insErr || !ver) {
        console.error(`insert failed ${seed.slug}:`, insErr?.message);
        process.exit(1);
      }
      await svc
        .from("ai_agents")
        .update({ published_version_id: ver.id, updated_at: new Date().toISOString() })
        .eq("id", agent.id);
      console.log(`created ${seed.slug} → ${seed.versionLabel}`);
    }
  }

  console.log("Done — all agent scopes prefilled.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
