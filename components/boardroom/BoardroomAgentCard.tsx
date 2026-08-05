"use client";

import { Sparkles } from "lucide-react";
import {
  BOARDROOM_AGENT_ACCENT,
  BOARDROOM_AGENT_ICON,
  boardroomAgentLabel,
  boardroomAgentRole,
  isBoardroomAgentId,
} from "@/lib/ai/boardroom-ui";
import type { AgentStructuredOutput } from "@/lib/ai/boardroom-output-schema";
import { cn } from "@/lib/utils/cn";
import { BoardroomRichContent } from "./BoardroomRichContent";

export function BoardroomAgentCard({
  agentId,
  content,
  structured,
  compact,
  agentLabel,
}: {
  agentId: string;
  content: string;
  structured?: AgentStructuredOutput | null;
  compact?: boolean;
  agentLabel?: string;
}) {
  const label = agentLabel ?? boardroomAgentLabel(agentId);
  const role = boardroomAgentRole(agentId);
  const Icon = isBoardroomAgentId(agentId)
    ? BOARDROOM_AGENT_ICON[agentId]
    : Sparkles;
  const accent = isBoardroomAgentId(agentId)
    ? BOARDROOM_AGENT_ACCENT[agentId]
    : null;

  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          accent ? cn(accent.bg, accent.text) : "bg-white/10 text-white/70",
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white/70">
          {label}
          <span className="ml-2 font-normal text-white/40">{role}</span>
        </p>
        <div
          className={cn(
            "mt-1 rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-4 py-3",
            compact && "text-xs",
          )}
        >
          <BoardroomRichContent content={content} agentId={agentId} />
          {structured ? (
            <span className="sr-only">{JSON.stringify(structured)}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
