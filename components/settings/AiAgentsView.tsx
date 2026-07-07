"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Cpu,
  ExternalLink,
  Gauge,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  REASONING_MODE_HINTS,
  REASONING_MODE_LABELS,
  REASONING_MODE_MODELS,
  REASONING_MODES,
  TENANT_AI_AGENTS,
  type AgentsOverview,
  type ReasoningMode,
} from "@/lib/settings/ai-agents-catalog";
import type { AgentListItem } from "@/lib/settings/ai-agents-catalog";
import {
  creditsToMyr,
  DAILY_BUDGET_MAX_CREDITS,
  DAILY_BUDGET_MIN_CREDITS,
  myrToCredits,
} from "@/lib/settings/credit-pricing";

interface AiAgentsViewProps {
  initial: AgentsOverview;
  canEdit: boolean;
}

export function AiAgentsView({ initial, canEdit }: AiAgentsViewProps) {
  const [overview, setOverview] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function patchAgent(
    slug: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/settings/ai-agents/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
    setOverview((prev) => ({
      ...prev,
      agents: prev.agents.map((a) =>
        a.slug === slug ? { ...a, ...patch } : a,
      ),
    }));
  }

  function handleToggle(slug: string, enabled: boolean) {
    if (!canEdit) return;
    updateLocal(slug, { assistant_enabled: enabled });
    startTransition(async () => {
      const ok = await patchAgent(slug, { assistant_enabled: enabled });
      if (ok) {
        setSuccess(enabled ? "Agent activated." : "Agent paused.");
      }
    });
  }

  function handleSaveAgent(
    slug: string,
    fields: Record<string, unknown>,
  ) {
    if (!canEdit) return;
    startTransition(async () => {
      const ok = await patchAgent(slug, fields);
      if (ok) {
        setSuccess("Settings saved.");
      }
    });
  }

  function handleSaveDisplayName(slug: string, rawName: string) {
    if (!canEdit) return;
    const display_name = rawName.trim();
    if (display_name.length < 1) {
      setError("Display name cannot be empty.");
      return;
    }
    handleSaveAgent(slug, { display_name });
  }

  const fastCount = overview.agents.filter(
    (a) => a.reasoning_mode === "fast" && a.addon_active,
  ).length;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {success}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-[#8C5C0A] dark:text-[#F5C97A]">
          You can view agent status here. Only the business owner can activate,
          pause, or change settings.
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile
          icon={Sparkles}
          label="Agents active"
          value={`${overview.active_count}`}
          caption={`of ${overview.agents.length} available`}
          tone="accent"
        />
        <SummaryTile
          icon={Zap}
          label="Shared credit pool"
          value={`${overview.credit_balance}`}
          caption={
            overview.subscribed_agent_count > 0
              ? `${overview.subscribed_agent_count} agents × 100 = ${overview.monthly_bundled_credits} bundled/mo`
              : "Subscribe agents in Marketplace"
          }
          tone="brand"
        />
        <SummaryTile
          icon={Gauge}
          label="Spent today"
          value={`${overview.total_spent_today_credits} credits`}
          caption={`All agents · daily caps total ${overview.total_daily_budget_credits} credits`}
          tone="info"
        />
        <SummaryTile
          icon={Cpu}
          label="Fast mode"
          value={`${fastCount}`}
          caption="Agents on quick replies"
          tone="brand"
        />
      </section>

      <div className="space-y-4">
        {TENANT_AI_AGENTS.map((def) => {
          const agent = overview.agents.find((a) => a.slug === def.slug);
          if (!agent) return null;
          const Icon = def.icon;
          const active = agent.addon_active && agent.assistant_enabled;
          const locked = !agent.addon_active;

          return (
            <article
              key={def.slug}
              className={`overflow-hidden rounded-xl border bg-white shadow-card dark:bg-panel-dark ${
                locked
                  ? "border-cream-200 opacity-95 dark:border-hairline-dark"
                  : active
                    ? "border-cream-200 dark:border-hairline-dark"
                    : "border-cream-200 opacity-75 dark:border-hairline-dark"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
                <div className="flex items-start gap-4">
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-card ${
                      def.tone === "accent" ? "bg-accent-500" : "bg-brand-500"
                    }`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-ink dark:text-cream-100">
                        {agent.display_name}
                      </h3>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                        {def.pillar}
                      </span>
                      {locked ? (
                        <Badge tone="neutral">Not subscribed</Badge>
                      ) : active ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="warning">Paused</Badge>
                      )}
                    </div>
                    <p className="mt-1 max-w-xl text-sm text-ink-muted dark:text-cream-400">
                      {def.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {def.chatHref && agent.addon_active ? (
                    <Link
                      href={def.chatHref}
                      className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-3 py-2 text-xs font-semibold text-brand-700 dark:border-hairline-dark dark:text-brand-200"
                    >
                      Open
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                  {locked ? (
                    <Link
                      href="/marketplace"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      Get in Marketplace
                    </Link>
                  ) : canEdit ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        handleToggle(def.slug, !agent.assistant_enabled)
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
                        agent.assistant_enabled
                          ? "border border-cream-300 bg-white text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                          : "bg-accent-500 text-white hover:bg-accent-600"
                      }`}
                    >
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : agent.assistant_enabled ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {agent.assistant_enabled ? "Pause" : "Activate"}
                    </button>
                  ) : null}
                </div>
              </div>

              {def.slug === "boardroom" && !agent.addon_active ? (
                <div className="border-b border-cream-200 bg-cream-50 px-5 py-3 text-sm text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/20 dark:text-cream-400">
                  Activate at least two module agents, or subscribe to{" "}
                  <strong>Boardroom AI weekly digest</strong> in the Marketplace.
                </div>
              ) : null}

              {!locked ? (
                <div className="grid gap-5 p-5 lg:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                      What it does
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {def.capabilities.map((c) => (
                        <li
                          key={c}
                          className="text-xs text-ink dark:text-cream-100"
                        >
                          · {c}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                      Reasoning speed
                    </p>
                    <div className="mt-2 space-y-2">
                      {REASONING_MODES.map((mode) => (
                        <label
                          key={mode}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${
                            agent.reasoning_mode === mode
                              ? "border-accent-500 bg-accent-50 dark:bg-accent-700/15"
                              : "border-cream-200 dark:border-hairline-dark"
                          } ${!canEdit ? "opacity-60" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`mode-${def.slug}`}
                            checked={agent.reasoning_mode === mode}
                            disabled={!canEdit || pending}
                            onChange={() => {
                              updateLocal(def.slug, { reasoning_mode: mode });
                              handleSaveAgent(def.slug, {
                                reasoning_mode: mode,
                              });
                            }}
                            className="mt-1 h-3 w-3 accent-accent-500"
                          />
                          <div>
                            <p className="text-xs font-semibold text-ink dark:text-cream-100">
                              {REASONING_MODE_LABELS[mode]}
                            </p>
                            <p className="font-mono text-[10px] text-brand-700 dark:text-brand-200">
                              {REASONING_MODE_MODELS[mode]}
                            </p>
                            <p className="text-[10px] text-ink-muted dark:text-cream-400">
                              {REASONING_MODE_HINTS[mode]}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                        Display name
                      </p>
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={agent.display_name}
                          disabled={!canEdit || pending}
                          maxLength={40}
                          onChange={(e) =>
                            updateLocal(def.slug, {
                              display_name: e.target.value,
                            })
                          }
                          onBlur={(e) =>
                            handleSaveDisplayName(def.slug, e.currentTarget.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                        />
                        <button
                          type="button"
                          disabled={!canEdit || pending}
                          onClick={() =>
                            handleSaveDisplayName(def.slug, agent.display_name)
                          }
                          className="shrink-0 rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark"
                        >
                          Save
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-ink-muted dark:text-cream-400">
                        Shown in chat and on Home. Saves when you leave the field
                        or click Save.
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                        Daily budget
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold text-ink dark:text-cream-100">
                            {agent.daily_budget_credits} credits
                          </span>
                          <span className="text-xs text-ink-muted">
                            RM {agent.daily_budget_myr.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-ink-muted dark:text-cream-400">
                          <span>
                            Spent {agent.spent_today_credits} credits today
                          </span>
                          <span>RM {agent.spent_today_myr.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={DAILY_BUDGET_MIN_CREDITS}
                          max={DAILY_BUDGET_MAX_CREDITS}
                          step={5}
                          disabled={!canEdit || pending}
                          value={agent.daily_budget_credits}
                          onChange={(e) => {
                            const credits = Number(e.target.value);
                            updateLocal(def.slug, {
                              daily_budget_credits: credits,
                              daily_budget_myr: creditsToMyr(credits),
                            });
                          }}
                          onMouseUp={(e) =>
                            handleSaveAgent(def.slug, {
                              daily_budget_credits: Number(
                                (e.target as HTMLInputElement).value,
                              ),
                            })
                          }
                          onTouchEnd={(e) =>
                            handleSaveAgent(def.slug, {
                              daily_budget_credits: Number(
                                (e.target as HTMLInputElement).value,
                              ),
                            })
                          }
                          className="w-full accent-accent-500"
                        />
                        <p className="text-[10px] text-ink-subtle">
                          {DAILY_BUDGET_MIN_CREDITS}–{DAILY_BUDGET_MAX_CREDITS}{" "}
                          credits per day for this agent (from your shared pool).
                          Agent pauses if exceeded.
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                        Used from shared pool
                      </p>
                      <p className="mt-1 text-sm font-semibold text-ink dark:text-cream-100">
                        {agent.credits_used_month} credits this month
                      </p>
                      <p className="text-[10px] text-ink-subtle">
                        All agents share one balance ({overview.credit_balance}{" "}
                        left).{" "}
                        <Link
                          href="/settings/billing"
                          className="text-brand-700 underline dark:text-brand-200"
                        >
                          Top up credits
                        </Link>{" "}
                        in Billing.
                      </p>
                    </div>

                    {def.supportsDailyNotice ? (
                      <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-cream-400">
                        <input
                          type="checkbox"
                          checked={agent.daily_notice_enabled}
                          disabled={!canEdit || pending}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            updateLocal(def.slug, {
                              daily_notice_enabled: enabled,
                            });
                            handleSaveAgent(def.slug, {
                              daily_notice_enabled: enabled,
                            });
                          }}
                          className="h-4 w-4 rounded"
                        />
                        Daily notice on Home &amp; HR
                      </label>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-cream-200 bg-cream-50 p-4 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <p>
          All AI assistants draw from one shared credit pool. Each subscribed
          module adds 100 credits per month (e.g. 6 agents = 600 credits/mo).
          Top-ups roll over; monthly bundled credits do not. Your data is never
          used to train external models.
        </p>
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
  tone: "brand" | "accent" | "info";
}) {
  const bg = {
    brand: "border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/30",
    accent:
      "border-accent-200 bg-accent-50 dark:border-accent-700/40 dark:bg-accent-700/15",
    info: "border-[#A6CFE0]/40 bg-[#DCE9F0] dark:border-[#1F4E66] dark:bg-[#13303D]",
  }[tone];
  const txt = {
    brand: "text-brand-700 dark:text-brand-200",
    accent: "text-accent-700 dark:text-accent-200",
    info: "text-[#1F4E66] dark:text-[#A6CFE0]",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
          {label}
        </p>
        <Icon className={`h-4 w-4 ${txt}`} strokeWidth={2} />
      </div>
      <p className={`mt-1.5 text-2xl font-bold ${txt}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted dark:text-cream-400">
        {caption}
      </p>
    </div>
  );
}
