"use client";

import Link from "next/link";
import { ArrowRight, Lock, Users } from "lucide-react";
import type { BoardroomAgentState } from "@/lib/ai/boardroom-shared";
import { BOARDROOM_MIN_AGENTS } from "@/lib/ai/boardroom-shared";
import {
  BOARDROOM_AGENT_ACCENT,
  BOARDROOM_AGENT_ICON,
  isBoardroomAgentId,
} from "@/lib/ai/boardroom-ui";
import { cn } from "@/lib/utils/cn";

export function BoardroomGate({
  agents,
  activeCount,
}: {
  agents: BoardroomAgentState[];
  activeCount: number;
}) {
  const needed = Math.max(0, BOARDROOM_MIN_AGENTS - activeCount);

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-card dark:border-hairline-dark">
      <div className="border-b border-white/10 px-6 py-8 sm:px-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Lock className="h-5 w-5 text-white/90" strokeWidth={2} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Locked
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              Switch on {needed} more team member{needed === 1 ? "" : "s"}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
              You have {activeCount} team member{activeCount === 1 ? "" : "s"}{" "}
              switched on. Turn on at least {BOARDROOM_MIN_AGENTS} module
              assistants in Settings to open the room.
            </p>
            <Link
              href="/settings/ai-agents"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white/90"
            >
              Open team settings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {agents.map((agent) => {
          const Icon = isBoardroomAgentId(agent.id)
            ? BOARDROOM_AGENT_ICON[agent.id]
            : Users;
          const accent = isBoardroomAgentId(agent.id)
            ? BOARDROOM_AGENT_ACCENT[agent.id]
            : null;

          return (
            <div
              key={agent.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition",
                agent.live
                  ? "border-white/20 bg-white/10"
                  : "border-white/5 bg-white/[0.03] opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  agent.live && accent
                    ? cn(accent.bg, accent.text)
                    : "bg-white/5 text-white/40",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{agent.label}</p>
                <p className="text-xs text-white/50">{agent.role}</p>
              </div>
              <span
                className={cn(
                  "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  agent.live
                  ? "bg-emerald-500/20 text-emerald-200"
                  : agent.subscribed
                    ? "bg-amber-500/20 text-amber-200"
                    : "bg-white/5 text-white/40",
                )}
              >
                {agent.live ? "On" : agent.subscribed ? "Paused" : "Off"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
