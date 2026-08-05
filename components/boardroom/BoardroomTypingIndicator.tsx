"use client";

import { Sparkles } from "lucide-react";
import {
  BOARDROOM_AGENT_ICON,
  boardroomAgentLabel,
  isBoardroomAgentId,
} from "@/lib/ai/boardroom-ui";
import { cn } from "@/lib/utils/cn";

export function BoardroomTypingIndicator({
  agentId,
  label,
}: {
  agentId?: string;
  label?: string;
}) {
  const Icon =
    agentId && isBoardroomAgentId(agentId)
      ? BOARDROOM_AGENT_ICON[agentId]
      : Sparkles;
  const name =
    label ?? (agentId ? boardroomAgentLabel(agentId) : "Staff");

  return (
    <div className="flex items-start gap-3 opacity-85">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/70">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div>
        <p className="text-xs text-white/50">{name}</p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 rounded-2xl rounded-tl-sm border border-dashed border-white/20 px-4 py-3",
          )}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
