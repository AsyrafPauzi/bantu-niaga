"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { BoardroomAgentState } from "@/lib/ai/boardroom-shared";
import { BOARDROOM_MIN_AGENTS } from "@/lib/ai/boardroom-shared";
import { StatusPill } from "@/components/dashboard/status-pill";

export function BoardroomGate({
  agents,
  activeCount,
}: {
  agents: BoardroomAgentState[];
  activeCount: number;
}) {
  const liveAgents = agents.filter((a) => a.live);
  const needed = Math.max(0, BOARDROOM_MIN_AGENTS - activeCount);

  return (
    <div className="space-y-6">
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-[#E5E0D8] bg-white p-8 text-center dark:border-hairline-dark dark:bg-panel-dark">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200">
          <Sparkles className="h-7 w-7" strokeWidth={2} />
        </div>
        <h2 className="text-lg font-bold text-ink dark:text-cream-100">
          Executive room needs more AI agents
        </h2>
        <p className="mt-2 max-w-md text-sm text-ink-muted dark:text-cream-400">
          The Boardroom synthesises answers from multiple module agents. Activate at
          least {BOARDROOM_MIN_AGENTS} AI agents in Marketplace to unlock the Executive
          room. You have {activeCount} active
          {activeCount === 1 ? " — one more to go." : "."}
        </p>
        <Link
          href="/marketplace"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Browse AI agents in Marketplace
        </Link>
        {needed > 0 ? (
          <p className="mt-3 text-xs text-ink-subtle dark:text-cream-500">
            Activate {needed} more agent{needed === 1 ? "" : "s"} to unlock
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-cream-200 bg-cream-50 p-4 dark:border-hairline-dark dark:bg-panel-dark/60">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
          Agents in your account
        </p>
        <ul className="mt-3 space-y-2">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-ink dark:text-cream-100">
                {agent.label} · {agent.role}
              </span>
              <StatusPill tone={agent.live ? "success" : "neutral"}>
                {agent.live ? "Active" : "Not activated"}
              </StatusPill>
            </li>
          ))}
        </ul>
        {liveAgents.length > 0 ? (
          <p className="mt-3 text-xs text-ink-muted dark:text-cream-400">
            Active: {liveAgents.map((a) => a.label).join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
