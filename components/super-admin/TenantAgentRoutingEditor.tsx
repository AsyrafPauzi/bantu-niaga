"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  ALLOWED_MODEL_OVERRIDES,
  REASONING_MODE_MODELS,
  TENANT_AI_AGENTS,
  type ReasoningMode,
} from "@/lib/settings/ai-agents-catalog";

export interface TenantAgentSettingRow {
  agent_slug: string;
  display_name: string | null;
  assistant_enabled: boolean;
  reasoning_mode: string;
  model_override: string | null;
}

export function TenantAgentRoutingEditor({
  businessId,
  initialSettings,
}: {
  businessId: string;
  initialSettings: TenantAgentSettingRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bySlug = new Map(initialSettings.map((s) => [s.agent_slug, s]));

  async function save(
    agentSlug: string,
    patch: { reasoning_mode?: ReasoningMode; model_override?: string | null },
  ) {
    setError(null);
    setSaving(agentSlug);
    try {
      const res = await fetch(
        `/api/super-admin/businesses/${businessId}/agent-settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_slug: agentSlug, ...patch }),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.message ?? "Could not save routing");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}
      {TENANT_AI_AGENTS.map((agent) => {
        const stored = bySlug.get(agent.slug);
        const mode: ReasoningMode =
          stored?.reasoning_mode === "deep" ? "deep" : "fast";
        const override = stored?.model_override ?? "";
        const effective = override || REASONING_MODE_MODELS[mode];
        const busy = saving === agent.slug || pending;

        return (
          <div
            key={agent.slug}
            className="rounded-xl border border-cream-300 bg-white p-4 shadow-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">
                  {stored?.display_name ?? agent.defaultName}{" "}
                  <span className="font-normal text-ink-muted">
                    · {agent.roleTitle}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Effective model:{" "}
                  <span className="font-mono text-ink">{effective}</span>
                </p>
              </div>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
              ) : null}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-ink-muted">
                  Reasoning mode
                </span>
                <select
                  value={mode}
                  disabled={busy}
                  onChange={(e) =>
                    save(agent.slug, {
                      reasoning_mode: e.target.value as ReasoningMode,
                    })
                  }
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="fast">Fast ({REASONING_MODE_MODELS.fast})</option>
                  <option value="deep">Deep ({REASONING_MODE_MODELS.deep})</option>
                </select>
              </label>

              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-ink-muted">
                  Admin model override
                </span>
                <select
                  value={override}
                  disabled={busy}
                  onChange={(e) =>
                    save(agent.slug, {
                      model_override: e.target.value || null,
                    })
                  }
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">None (use mode default)</option>
                  {ALLOWED_MODEL_OVERRIDES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
