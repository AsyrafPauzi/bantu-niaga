import "server-only";

import { cache } from "react";
import type {
  AllowedAction,
  EscalationRule,
  Guardrail,
  KnowledgeSource,
} from "@/lib/super-admin/types";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type PublishedAgentScope = {
  slug: string;
  versionLabel: string;
  systemPrompt: string;
  defaultTone: string | null;
  allowedActions: AllowedAction[];
  guardrails: Guardrail[];
  escalation: EscalationRule[];
  knowledgeBase: KnowledgeSource[];
};

function personaHeader(
  displayName: string,
  businessName?: string,
  roleLabel?: string,
): string {
  const role = roleLabel ? `the ${roleLabel} staff AI` : "the staff AI";
  const businessLine = businessName
    ? `You work for "${businessName}". `
    : "";
  return (
    `You are ${displayName}, ${role} for this business. ` +
    `${businessLine}` +
    `Respond as a helpful in-house colleague.`
  );
}

export function formatAgentScopePolicy(
  scope: PublishedAgentScope | null,
): string {
  if (!scope) return "";

  const blocks: string[] = [];

  if (scope.allowedActions.length > 0) {
    const lines = scope.allowedActions
      .filter((a) => a.on)
      .map((a) => `- ${a.label}${a.note ? ` (${a.note})` : ""}`);
    if (lines.length > 0) {
      blocks.push(
        "PLATFORM ALLOWED ACTIONS (enforced at tool layer):\n" +
          lines.join("\n"),
      );
    }
    const off = scope.allowedActions.filter((a) => !a.on);
    if (off.length > 0) {
      blocks.push(
        "DISABLED UNTIL ENABLED:\n" +
          off.map((a) => `- ${a.label}`).join("\n"),
      );
    }
  }

  if (scope.guardrails.length > 0) {
    blocks.push(
      "PLATFORM GUARDRAILS (never break):\n" +
        scope.guardrails
          .map((g) => `- ${g.label}: ${g.detail}`)
          .join("\n"),
    );
  }

  if (scope.escalation.length > 0) {
    blocks.push(
      "ESCALATION:\n" +
        scope.escalation
          .map((e) => `- When ${e.trigger} → ${e.target}`)
          .join("\n"),
    );
  }

  if (scope.knowledgeBase.length > 0) {
    blocks.push(
      "KNOWLEDGE SOURCES (live tenant data — cite these, do not invent):\n" +
        scope.knowledgeBase
          .map((k) => `- ${k.label} (${k.kind}, ${k.size})`)
          .join("\n"),
    );
  }

  if (scope.defaultTone?.trim()) {
    blocks.push(`TONE: ${scope.defaultTone.trim()}`);
  }

  return blocks.length > 0
    ? `--- PLATFORM SCOPE (super-admin v${scope.versionLabel}) ---\n${blocks.join("\n\n")}`
    : "";
}

export function composeStaffAgentSystemPrompt(opts: {
  scope: PublishedAgentScope | null;
  fallbackRules: string;
  displayName: string;
  businessName?: string;
  todayIso: string;
  roleLabel?: string;
  dataPacketLabel?: string;
  dataPacketText?: string;
  extraBlocks?: string[];
}): string {
  const policy = formatAgentScopePolicy(opts.scope);
  const dateLine = `Today's date (Malaysia, YYYY-MM-DD): ${opts.todayIso}`;

  let core: string;
  if (opts.scope?.systemPrompt?.trim()) {
    core = [
      personaHeader(opts.displayName, opts.businessName, opts.roleLabel),
      opts.scope.systemPrompt.trim(),
      dateLine,
    ].join("\n\n");
  } else {
    core = opts.fallbackRules;
  }

  const parts = [core];
  if (policy) parts.push(policy);
  if (opts.extraBlocks?.length) parts.push(...opts.extraBlocks);
  if (opts.dataPacketLabel && opts.dataPacketText !== undefined) {
    parts.push(`${opts.dataPacketLabel}\n${opts.dataPacketText}`);
  }
  return parts.join("\n\n");
}

export function composeBoardroomScopePolicy(
  scope: PublishedAgentScope | null,
): string {
  return formatAgentScopePolicy(scope);
}

export const loadPublishedAgentScope = cache(
  async (slug: string): Promise<PublishedAgentScope | null> => {
    const svc = createServiceRoleClient();
    const { data: agent } = await svc
      .from("ai_agents")
      .select("slug, published_version_id")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (!agent?.published_version_id) return null;

    const { data: ver } = await svc
      .from("ai_agent_versions")
      .select(
        "version_label, system_prompt, allowed_actions, guardrails, escalation, knowledge_base, default_tone",
      )
      .eq("id", agent.published_version_id)
      .maybeSingle();

    if (!ver?.system_prompt?.trim()) return null;

    return {
      slug,
      versionLabel: ver.version_label as string,
      systemPrompt: ver.system_prompt as string,
      defaultTone: (ver.default_tone as string | null) ?? null,
      allowedActions: (ver.allowed_actions ?? []) as AllowedAction[],
      guardrails: (ver.guardrails ?? []) as Guardrail[],
      escalation: (ver.escalation ?? []) as EscalationRule[],
      knowledgeBase: (ver.knowledge_base ?? []) as KnowledgeSource[],
    };
  },
);
