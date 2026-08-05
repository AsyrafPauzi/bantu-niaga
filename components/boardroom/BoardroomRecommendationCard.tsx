"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { BoardroomPendingAction } from "@/lib/ai/boardroom-actions";
import type { ChairRecommendation } from "@/lib/ai/boardroom-output-schema";
import {
  resolveBoardroomDisplayName,
  isBoardroomAgentId,
} from "@/lib/ai/boardroom-ui";
import { BoardroomActionChips } from "./BoardroomActionChips";
import { BoardroomRichContent } from "./BoardroomRichContent";

export function BoardroomRecommendationCard({
  content,
  structured,
  pendingActions,
  meetingActive,
  agentLabels,
}: {
  content: string;
  structured?: ChairRecommendation | null;
  pendingActions?: BoardroomPendingAction[];
  meetingActive?: boolean;
  agentLabels?: Record<string, string>;
}) {
  const actions =
    pendingActions ??
    structured?.priority_actions?.map((a) => ({
      id: a.id,
      agent: a.owner_agent,
      tool: a.link_href ? "navigate" : "draft",
      args: a.link_href ? { href: a.link_href } : {},
      summary: a.label,
      label: a.label,
      link_href: a.link_href,
      rationale: a.rationale,
    })) ??
    [];

  const verdict = structured?.verdict?.trim();
  const numberedActions = structured?.priority_actions ?? [];

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45">
        <Sparkles className="h-3.5 w-3.5 text-amber-200" />
        Recommendation
      </p>

      {verdict ? (
        <p className="mt-2 text-base font-bold leading-snug text-white">
          {verdict}
        </p>
      ) : (
        <div className="mt-2 text-sm leading-relaxed text-white/90">
          <BoardroomRichContent content={content} />
        </div>
      )}

      {numberedActions.length > 0 ? (
        <ol className="mt-3 list-none space-y-1.5 text-sm text-white/65">
          {numberedActions.map((action, i) => {
            const who = isBoardroomAgentId(action.owner_agent)
              ? resolveBoardroomDisplayName(action.owner_agent, agentLabels)
              : action.owner_agent;
            return (
              <li key={action.id || i}>
                {i + 1}.{" "}
                {action.link_href?.trim() ? (
                  <Link
                    href={action.link_href}
                    className="font-medium text-amber-100 underline-offset-2 hover:underline"
                  >
                    {action.label.trim()}
                  </Link>
                ) : (
                  action.label.trim()
                )}{" "}
                <span className="text-white/40">({who})</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {structured?.uncertainty_note?.trim() ? (
        <p className="mt-2 text-xs italic text-white/45">
          {structured.uncertainty_note.trim()}
        </p>
      ) : null}

      {meetingActive && actions.length > 0 ? (
        <BoardroomActionChips actions={actions} />
      ) : null}
    </div>
  );
}
