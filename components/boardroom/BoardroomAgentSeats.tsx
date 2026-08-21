"use client";

import { Sparkles } from "lucide-react";
import {
  BOARDROOM_AGENT_ACCENT,
  BOARDROOM_AGENT_ICON,
  isBoardroomAgentId,
} from "@/lib/ai/boardroom-ui";
import { cn } from "@/lib/utils/cn";

export function AgentChip({
  agentId,
  label,
  selected,
  disabled,
  onClick,
}: {
  agentId: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = isBoardroomAgentId(agentId)
    ? BOARDROOM_AGENT_ICON[agentId]
    : Sparkles;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
        disabled && "cursor-not-allowed opacity-40",
        selected
          ? "bg-white text-slate-900 shadow-sm"
          : "bg-white/10 text-white/85 hover:bg-white/15",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </button>
  );
}

export function AgentSeat({
  agentId,
  label,
  active,
}: {
  agentId: string;
  label: string;
  active?: boolean;
}) {
  const Icon = isBoardroomAgentId(agentId)
    ? BOARDROOM_AGENT_ICON[agentId]
    : Sparkles;
  const accent = isBoardroomAgentId(agentId)
    ? BOARDROOM_AGENT_ACCENT[agentId]
    : null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "relative grid h-10 w-10 place-items-center rounded-xl",
          accent ? cn(accent.bg, accent.text, active && accent.ring) : "bg-white/10 text-white/70",
          !active && "opacity-70",
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
        {active ? (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" />
        ) : null}
      </span>
      <span className="max-w-[4rem] truncate text-[10px] font-medium text-white/70">
        {label}
      </span>
    </div>
  );
}
