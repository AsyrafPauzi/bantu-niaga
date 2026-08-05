"use client";

import type { AgentStructuredOutput } from "@/lib/ai/boardroom-output-schema";
import type { ChairRecommendation } from "@/lib/ai/boardroom-output-schema";
import type { BoardroomPendingAction } from "@/lib/ai/boardroom-actions";
import { BoardroomRichContent } from "./BoardroomRichContent";
import { BoardroomAgentCard } from "./BoardroomAgentCard";
import { BoardroomRecommendationCard } from "./BoardroomRecommendationCard";
import { resolveBoardroomDisplayName } from "@/lib/ai/boardroom-ui";

export type BoardroomMsgMeta = {
  structured?: AgentStructuredOutput | ChairRecommendation;
  priority_actions?: BoardroomPendingAction[];
  credits?: number;
  free?: boolean;
  round?: number;
  confidence?: number;
};

export function BoardroomMessage({
  role,
  agentId,
  content,
  meta,
  pendingActions,
  meetingActive,
  agentLabels,
}: {
  role: string;
  agentId?: string | null;
  content: string;
  meta?: BoardroomMsgMeta | null;
  pendingActions?: BoardroomPendingAction[];
  meetingActive?: boolean;
  agentLabels?: Record<string, string>;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-white px-4 py-3 text-sm text-slate-900">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  if (role === "room_clarifier") {
    return (
      <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">
          Quick questions
        </p>
        <div className="mt-2 text-sm leading-relaxed text-white/85">
          <BoardroomRichContent content={content} />
        </div>
      </div>
    );
  }

  if (role === "synth") {
    const structured = meta?.structured as ChairRecommendation | undefined;
    return (
      <BoardroomRecommendationCard
        content={content}
        structured={structured ?? null}
        pendingActions={pendingActions ?? meta?.priority_actions}
        meetingActive={meetingActive}
        agentLabels={agentLabels}
      />
    );
  }

  if (role === "agent" && agentId) {
    const structured = meta?.structured as AgentStructuredOutput | undefined;
    return (
      <BoardroomAgentCard
        agentId={agentId}
        content={content}
        structured={structured ?? null}
        compact={meta?.round != null && meta.round > 1}
        agentLabel={
          agentLabels && agentId
            ? resolveBoardroomDisplayName(agentId, agentLabels)
            : undefined
        }
      />
    );
  }

  return (
    <p className="text-center text-xs text-white/45 whitespace-pre-wrap">
      {content}
    </p>
  );
}
