"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Brush,
  ChevronRight,
  Cpu,
  Gauge,
  Megaphone,
  Pause,
  Play,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type AgentStatus = "active" | "paused" | "unconfigured";

interface Agent {
  id: string;
  name: string;
  pillar: string;
  description: string;
  status: AgentStatus;
  model: "fast" | "deep" | "auto";
  dailyBudgetMyr: number;
  spentTodayMyr: number;
  creditsUsed: number;
  creditsTotal: number;
  icon: LucideIcon;
  tone: "brand" | "accent" | "info";
  capabilities: string[];
}

const INITIAL_AGENTS: Agent[] = [
  {
    id: "maya",
    name: "Maya",
    pillar: "Marketing",
    description:
      "Auto-tags customers, drafts captions, recommends best times to post, and segments your CRM.",
    status: "active",
    model: "fast",
    dailyBudgetMyr: 5,
    spentTodayMyr: 1.2,
    creditsUsed: 48,
    creditsTotal: 300,
    icon: Megaphone,
    tone: "accent",
    capabilities: [
      "Customer auto-segmentation",
      "Caption + hashtag suggestions",
      "Best-time posting recommendations",
      "Churn-risk early warnings",
    ],
  },
  {
    id: "finance",
    name: "Finance AI",
    pillar: "Finance",
    description:
      "Reconciles invoices, flags duplicate expenses, and forecasts cash-flow 30 days ahead.",
    status: "active",
    model: "deep",
    dailyBudgetMyr: 8,
    spentTodayMyr: 2.7,
    creditsUsed: 102,
    creditsTotal: 300,
    icon: TrendingUp,
    tone: "brand",
    capabilities: [
      "Invoice OCR & reconciliation",
      "Duplicate expense detection",
      "30-day cash-flow forecast",
      "Tax-saving suggestions",
    ],
  },
  {
    id: "operations",
    name: "Operations AI",
    pillar: "Operations",
    description:
      "Tracks low-stock, suggests reorder quantities, and matches supplier deals weekly.",
    status: "active",
    model: "fast",
    dailyBudgetMyr: 4,
    spentTodayMyr: 0.9,
    creditsUsed: 34,
    creditsTotal: 300,
    icon: ShoppingBag,
    tone: "brand",
    capabilities: [
      "Predictive low-stock alerts",
      "Supplier price comparison",
      "Booking calendar optimisation",
      "Order routing",
    ],
  },
  {
    id: "boardroom",
    name: "Boardroom AI",
    pillar: "Cross-cutting",
    description:
      "Synthesises every module into a weekly briefing and answers strategic questions in chat.",
    status: "active",
    model: "deep",
    dailyBudgetMyr: 10,
    spentTodayMyr: 4.1,
    creditsUsed: 116,
    creditsTotal: 300,
    icon: Briefcase,
    tone: "accent",
    capabilities: [
      "Weekly executive briefing",
      "Cross-module Q&A in chat",
      "Goal-tracking & alerts",
      "Strategic scenario modelling",
    ],
  },
];

const MODEL_LABEL: Record<Agent["model"], string> = {
  fast: "Fast",
  deep: "Deep think",
  auto: "Auto",
};

export default function AiAgentSettingsPage() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);

  function toggleAgent(id: string) {
    setAgents((s) =>
      s.map((a) =>
        a.id === id
          ? { ...a, status: a.status === "active" ? "paused" : "active" }
          : a,
      ),
    );
  }

  function setModel(id: string, model: Agent["model"]) {
    setAgents((s) => s.map((a) => (a.id === id ? { ...a, model } : a)));
  }

  function setBudget(id: string, dailyBudgetMyr: number) {
    setAgents((s) =>
      s.map((a) => (a.id === id ? { ...a, dailyBudgetMyr } : a)),
    );
  }

  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalSpentToday = agents.reduce((n, a) => n + a.spentTodayMyr, 0);
  const totalBudget = agents.reduce((n, a) => n + a.dailyBudgetMyr, 0);
  const totalCreditsUsed = agents.reduce((n, a) => n + a.creditsUsed, 0);
  const totalCredits = agents.reduce((n, a) => n + a.creditsTotal, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
            Settings · Power features
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
            AI Agent activation
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-muted dark:text-cream-400">
            Switch agents on or off per module. Each agent has a daily budget
            and runs against its own credit pool.
          </p>
        </div>
        <Badge tone="accent">{activeCount} / {agents.length} active</Badge>
      </header>

      {/* Summary tiles */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile
          icon={Sparkles}
          label="Agents active"
          value={`${activeCount}`}
          caption={`of ${agents.length} agents`}
          tone="accent"
        />
        <SummaryTile
          icon={Zap}
          label="Fast credits used"
          value={`${totalCreditsUsed}`}
          caption={`of ${totalCredits} this month`}
          tone="brand"
        />
        <SummaryTile
          icon={Gauge}
          label="Spent today"
          value={`RM ${totalSpentToday.toFixed(2)}`}
          caption={`Cap: RM ${totalBudget.toFixed(2)}`}
          tone="info"
        />
        <SummaryTile
          icon={Cpu}
          label="Default model"
          value="Fast"
          caption="Switch to Deep per agent"
          tone="brand"
        />
      </section>

      {/* Agents */}
      <div className="space-y-4">
        {agents.map((agent) => {
          const active = agent.status === "active";
          const Icon = agent.icon;
          const creditPct = Math.round(
            (agent.creditsUsed / agent.creditsTotal) * 100,
          );
          return (
            <div
              key={agent.id}
              className={`overflow-hidden rounded-xl border bg-white shadow-card transition-opacity dark:bg-panel-dark ${
                active
                  ? "border-cream-200 dark:border-hairline-dark"
                  : "border-cream-200 opacity-60 dark:border-hairline-dark"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
                <div className="flex items-start gap-4">
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-card ${
                      agent.tone === "accent"
                        ? "bg-accent-500"
                        : agent.tone === "info"
                          ? "bg-[#1F4E66]"
                          : "bg-brand-500"
                    }`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-ink dark:text-cream-100">
                        {agent.name}
                      </h3>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                        {agent.pillar}
                      </span>
                      {active ? (
                        <Badge tone="success">
                          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-status-success" />
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="warning">Paused</Badge>
                      )}
                    </div>
                    <p className="mt-1 max-w-xl text-sm text-ink-muted dark:text-cream-400">
                      {agent.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAgent(agent.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-card ${
                    active
                      ? "border border-cream-300 bg-white text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
                      : "bg-accent-500 text-white hover:bg-accent-600"
                  }`}
                >
                  {active ? (
                    <>
                      <Pause className="h-4 w-4" strokeWidth={2} />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" strokeWidth={2} />
                      Activate
                    </>
                  )}
                </button>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-3">
                {/* Capabilities */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                    Capabilities
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {agent.capabilities.map((c) => (
                      <li
                        key={c}
                        className="flex items-start gap-2 text-xs text-ink dark:text-cream-100"
                      >
                        <ChevronRight
                          className="mt-0.5 h-3 w-3 shrink-0 text-accent-500"
                          strokeWidth={2.5}
                        />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Model picker */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                    Reasoning model
                  </p>
                  <div className="mt-2 space-y-2">
                    {(["fast", "deep", "auto"] as const).map((m) => (
                      <label
                        key={m}
                        className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors ${
                          agent.model === m
                            ? "border-accent-500 bg-accent-50 dark:bg-accent-700/15"
                            : "border-cream-200 hover:border-brand-300 dark:border-hairline-dark"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`model-${agent.id}`}
                          checked={agent.model === m}
                          onChange={() => setModel(agent.id, m)}
                          className="mt-1 h-3 w-3 accent-accent-500"
                        />
                        <div>
                          <p className="text-xs font-semibold text-ink dark:text-cream-100">
                            {MODEL_LABEL[m]}
                          </p>
                          <p className="text-[10px] text-ink-muted dark:text-cream-400">
                            {m === "fast"
                              ? "Low cost, ~2s latency. Best for chat."
                              : m === "deep"
                                ? "Slower (~15s) but stronger reasoning."
                                : "Bantu Niaga picks per task."}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Budget + credits */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                      Daily budget
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-ink dark:text-cream-100">
                          RM {agent.dailyBudgetMyr.toFixed(2)}
                        </span>
                        <span className="text-xs text-ink-muted dark:text-cream-400">
                          Spent RM {agent.spentTodayMyr.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={agent.dailyBudgetMyr}
                        onChange={(e) =>
                          setBudget(agent.id, Number(e.target.value))
                        }
                        className="w-full accent-accent-500"
                      />
                      <p className="text-[10px] text-ink-subtle">
                        RM 1 minimum · RM 20 max. Auto-pause if exceeded.
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                      Fast credits
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink dark:text-cream-100">
                          {agent.creditsUsed}
                        </span>
                        <span className="text-ink-muted dark:text-cream-400">
                          {agent.creditsTotal}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-cream-200 dark:bg-hairline-dark">
                        <div
                          className={`h-full rounded-full ${
                            creditPct >= 80
                              ? "bg-status-warning"
                              : "bg-brand-500"
                          }`}
                          style={{ width: `${Math.min(100, creditPct)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-ink-subtle">
                        Top up RM 10 / 50 credits in{" "}
                        <Link
                          href="/settings/billing"
                          className="text-brand-700 hover:underline dark:text-brand-200"
                        >
                          Billing
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-2 rounded-lg border border-cream-200 bg-cream-50 p-3 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <p>
          AI agents call out to OpenAI / Anthropic / Gemini depending on the
          task. We never train on your data, and all calls happen from the
          Supabase Singapore region.
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
  const BG = {
    brand: "border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/30",
    accent: "border-accent-200 bg-accent-50 dark:border-accent-700/40 dark:bg-accent-700/15",
    info: "border-[#A6CFE0]/40 bg-[#DCE9F0] dark:border-[#1F4E66] dark:bg-[#13303D]",
  }[tone];
  const TXT = {
    brand: "text-brand-700 dark:text-brand-200",
    accent: "text-accent-700 dark:text-accent-200",
    info: "text-[#1F4E66] dark:text-[#A6CFE0]",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${BG}`}>
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
          {label}
        </p>
        <Icon className={`h-4 w-4 ${TXT}`} strokeWidth={2} />
      </div>
      <p className={`mt-1.5 text-2xl font-bold ${TXT}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted dark:text-cream-400">
        {caption}
      </p>
    </div>
  );
}
