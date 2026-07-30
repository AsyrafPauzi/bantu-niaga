"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ExternalLink,
  Loader2,
  Pause,
  Play,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  REASONING_MODE_LABELS,
  TENANT_AI_AGENTS,
  type AgentsOverview,
  type ReasoningMode,
} from "@/lib/settings/ai-agents-catalog";
import type { AgentListItem } from "@/lib/settings/ai-agents-catalog";
import {
  clampDailyBudgetCredits,
  creditsToMyr,
  DAILY_BUDGET_MAX_CREDITS,
  DAILY_BUDGET_MIN_CREDITS,
  myrToCredits,
} from "@/lib/settings/credit-pricing";
import { cn } from "@/lib/utils/cn";

interface AiAgentsViewProps {
  initial: AgentsOverview;
  canEdit: boolean;
}

export function AiAgentsView({ initial, canEdit }: AiAgentsViewProps) {
  const [overview, setOverview] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subscribed = overview.agents.filter((a) => a.addon_active);
  const unsubscribed = overview.agents.filter((a) => !a.addon_active);

  async function patchAgent(
    slug: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setError(null);
    setSuccess(null);
    let res: Response;
    try {
      res = await fetch(`/api/settings/ai-agents/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
    } catch {
      setError("Network error — could not reach the server. Try again.");
      return false;
    }
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      settings?: {
        agent_slug: string;
        display_name: string;
        assistant_enabled: boolean;
        daily_notice_enabled: boolean;
        reasoning_mode: string;
        daily_budget_myr: number;
      };
    };
    if (!res.ok) {
      setError(json.message ?? json.error ?? "Could not save settings.");
      return false;
    }
    if (json.settings) {
      const saved = json.settings;
      const budgetCredits = myrToCredits(Number(saved.daily_budget_myr));
      updateLocal(slug, {
        display_name: saved.display_name,
        assistant_enabled: saved.assistant_enabled,
        daily_notice_enabled: saved.daily_notice_enabled,
        reasoning_mode: saved.reasoning_mode as ReasoningMode,
        daily_budget_myr: creditsToMyr(budgetCredits),
        daily_budget_credits: budgetCredits,
      });
    }
    return true;
  }

  function updateLocal(slug: string, patch: Partial<AgentListItem>) {
    setOverview((prev) => {
      const agents = prev.agents.map((a) =>
        a.slug === slug ? { ...a, ...patch } : a,
      );
      return {
        ...prev,
        agents,
        active_count: agents.filter(
          (a) => a.addon_active && a.assistant_enabled,
        ).length,
      };
    });
  }

  function handleToggle(slug: string, enabled: boolean) {
    if (!canEdit) return;
    updateLocal(slug, { assistant_enabled: enabled });
    startTransition(async () => {
      const ok = await patchAgent(slug, { assistant_enabled: enabled });
      if (ok) setSuccess(enabled ? "Agent activated." : "Agent paused.");
    });
  }

  function handleSaveAgent(slug: string, fields: Record<string, unknown>) {
    if (!canEdit) return;
    startTransition(async () => {
      const ok = await patchAgent(slug, fields);
      if (ok) setSuccess("Saved.");
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-3 py-2 text-sm text-status-success">
          {success}
        </div>
      ) : null}

      {!canEdit ? (
        <p className="text-sm text-ink-muted dark:text-cream-400">
          Read-only — only the owner can change agent settings.
        </p>
      ) : null}

      {subscribed.length > 0 ? (
        <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-center justify-between gap-2 border-b border-cream-200 px-3 py-2.5 dark:border-hairline-dark">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Subscribed agents
              </h2>
              <p className="text-[11px] text-ink-muted dark:text-cream-400">
                {overview.credit_balance} credits left ·{" "}
                {overview.total_spent_today_credits} used today
              </p>
            </div>
            <Link
              href="/settings/billing"
              className="text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-200"
            >
              Top up credits
            </Link>
          </div>
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {TENANT_AI_AGENTS.map((def) => {
              const agent = subscribed.find((a) => a.slug === def.slug);
              if (!agent) return null;
              return (
                <AgentRow
                  key={def.slug}
                  def={def}
                  agent={agent}
                  canEdit={canEdit}
                  pending={pending}
                  onToggle={handleToggle}
                  onSave={handleSaveAgent}
                  onPatchLocal={updateLocal}
                />
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="rounded-xl border border-cream-200 bg-white px-4 py-6 text-center shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            No AI agents subscribed yet.
          </p>
          <Link
            href="/marketplace"
            className="mt-3 inline-flex rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600"
          >
            Browse Marketplace
          </Link>
        </section>
      )}

      {unsubscribed.length > 0 ? (
        <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="border-b border-cream-200 px-3 py-2.5 dark:border-hairline-dark">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Not subscribed
            </h2>
            <p className="text-[11px] text-ink-muted dark:text-cream-400">
              Add these from the Marketplace to activate them.
            </p>
          </div>
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {TENANT_AI_AGENTS.map((def) => {
              const agent = unsubscribed.find((a) => a.slug === def.slug);
              if (!agent) return null;
              const Icon = def.icon;
              const hint =
                def.slug === "boardroom" && !overview.boardroom_unlocked
                  ? "Needs 2+ module agents or Boardroom add-on"
                  : null;

              return (
                <li
                  key={def.slug}
                  className="flex items-center gap-2 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-md text-white",
                      def.tone === "accent" ? "bg-accent-500" : "bg-brand-500",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink dark:text-cream-100">
                      {def.defaultName}
                      <span className="ml-1.5 font-normal text-ink-muted dark:text-cream-400">
                        · {def.pillar}
                      </span>
                    </p>
                    {hint ? (
                      <p className="truncate text-[10px] text-ink-muted dark:text-cream-400">
                        {hint}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href="/marketplace"
                    className="shrink-0 rounded-lg border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-cream-100 dark:border-hairline-dark dark:text-brand-200"
                  >
                    Get
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function AgentRow({
  def,
  agent,
  canEdit,
  pending,
  onToggle,
  onSave,
  onPatchLocal,
}: {
  def: (typeof TENANT_AI_AGENTS)[number];
  agent: AgentListItem;
  canEdit: boolean;
  pending: boolean;
  onToggle: (slug: string, enabled: boolean) => void;
  onSave: (slug: string, fields: Record<string, unknown>) => void;
  onPatchLocal: (slug: string, patch: Partial<AgentListItem>) => void;
}) {
  const Icon = def.icon;
  const active = agent.assistant_enabled;

  return (
    <li className="px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white",
              def.tone === "accent" ? "bg-accent-500" : "bg-brand-500",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                {agent.display_name}
              </p>
              <Badge tone={active ? "success" : "warning"}>
                {active ? "On" : "Paused"}
              </Badge>
            </div>
            <p className="text-[11px] text-ink-muted dark:text-cream-400">
              {def.pillar} · {agent.spent_today_credits}/{agent.daily_budget_credits}{" "}
              credits today
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {def.chatHref ? (
            <Link
              href={def.chatHref}
              className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:border-hairline-dark dark:text-brand-200"
            >
              Open
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onToggle(def.slug, !agent.assistant_enabled)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                agent.assistant_enabled
                  ? "border border-cream-300 bg-white text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                  : "bg-accent-500 text-white hover:bg-accent-600",
              )}
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : agent.assistant_enabled ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              {agent.assistant_enabled ? "Pause" : "On"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
            Speed
          </p>
          <div className="mt-1.5 flex rounded-lg border border-cream-200 p-0.5 dark:border-hairline-dark">
            {(["fast", "deep"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={!canEdit || pending}
                onClick={() => {
                  if (agent.reasoning_mode === mode) return;
                  onPatchLocal(def.slug, { reasoning_mode: mode });
                  onSave(def.slug, { reasoning_mode: mode });
                }}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50",
                  agent.reasoning_mode === mode
                    ? "bg-accent-500 text-white"
                    : "text-ink-muted hover:text-ink dark:text-cream-400",
                )}
              >
                {REASONING_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              Daily limit
            </p>
            <span className="text-[11px] font-semibold text-ink dark:text-cream-100">
              {agent.daily_budget_credits} credits
            </span>
          </div>
          <input
            type="range"
            min={DAILY_BUDGET_MIN_CREDITS}
            max={DAILY_BUDGET_MAX_CREDITS}
            step={5}
            disabled={!canEdit || pending}
            value={agent.daily_budget_credits}
            onChange={(e) => {
              const credits = clampDailyBudgetCredits(Number(e.target.value));
              onPatchLocal(def.slug, {
                daily_budget_credits: credits,
                daily_budget_myr: creditsToMyr(credits),
              });
            }}
            onMouseUp={(e) =>
              onSave(def.slug, {
                daily_budget_credits: Number(
                  (e.target as HTMLInputElement).value,
                ),
              })
            }
            onTouchEnd={(e) =>
              onSave(def.slug, {
                daily_budget_credits: Number(
                  (e.target as HTMLInputElement).value,
                ),
              })
            }
            className="mt-1.5 w-full accent-accent-500"
          />
        </div>
      </div>

      {def.supportsDailyNotice ? (
        <label className="mt-2.5 flex items-center gap-2 text-xs text-ink-muted dark:text-cream-400">
          <input
            type="checkbox"
            checked={agent.daily_notice_enabled}
            disabled={!canEdit || pending}
            onChange={(e) => {
              const enabled = e.target.checked;
              onPatchLocal(def.slug, { daily_notice_enabled: enabled });
              onSave(def.slug, { daily_notice_enabled: enabled });
            }}
            className="h-3.5 w-3.5 rounded"
          />
          Daily notice on Home
        </label>
      ) : null}
    </li>
  );
}
