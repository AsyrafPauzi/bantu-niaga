"use client";

import { useState } from "react";
import type { DepthAction } from "@/lib/ai/boardroom-orchestrator";
import { DEPTH_CHECKPOINT_CREDITS } from "@/lib/ai/boardroom-output-schema";
import { boardroomAgentLabel } from "@/lib/ai/boardroom-ui";
import { cn } from "@/lib/utils/cn";

type CallInAgent = {
  id: string;
  label: string;
  role: string;
  live: boolean;
};

export function DepthCheckpointCard({
  confidence,
  creditsSinceCheckpoint,
  invitable,
  invitedAgentIds,
  onAction,
  loading,
}: {
  confidence: number;
  creditsSinceCheckpoint: number;
  invitable: CallInAgent[];
  invitedAgentIds: string[];
  onAction: (
    action: DepthAction,
    redirectMessage?: string,
    inviteAgentIds?: string[],
  ) => void;
  loading?: boolean;
}) {
  const [redirect, setRedirect] = useState("");

  const callInOptions = invitable.filter(
    (a) => a.live && !invitedAgentIds.includes(a.id),
  );

  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-500/15 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-200">
        Depth checkpoint
      </p>
      <p className="mt-2 text-sm text-white/85">
        Used {creditsSinceCheckpoint} of {DEPTH_CHECKPOINT_CREDITS} credits this
        segment — confidence {Math.round(confidence * 100)}% (target 80%).
        Continue debating, accept the current plan, call in another agent, or
        redirect the room.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => onAction("continue")}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-40"
        >
          Continue debating
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onAction("accept")}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90 disabled:opacity-40"
        >
          Use what we have
        </button>
      </div>

      {callInOptions.length > 0 ? (
        <div className="mt-4 border-t border-amber-400/20 pt-3">
          <p className="mb-2 text-xs font-semibold text-white/70">
            Call in to the meeting
          </p>
          <div className="flex flex-wrap gap-2">
            {callInOptions.map((agent) => (
              <button
                key={agent.id}
                type="button"
                disabled={loading}
                onClick={() => onAction("continue", undefined, [agent.id])}
                className={cn(
                  "rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90",
                  "hover:bg-white/10 disabled:opacity-40",
                )}
              >
                + {agent.label} ({agent.role})
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/45">
            New agents join with their data packet — e.g. call Maya for buyer
            segments, Sufi for pipeline.
          </p>
        </div>
      ) : null}

      <div className="mt-4 border-t border-amber-400/20 pt-3">
        <p className="mb-2 text-xs font-semibold text-white/70">
          Redirect — tell them what you want
        </p>
        <textarea
          value={redirect}
          onChange={(e) => setRedirect(e.target.value)}
          placeholder={`e.g. ${boardroomAgentLabel("marketing")} — focus on buyers who already purchased`}
          rows={2}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
        />
        <button
          type="button"
          disabled={loading || !redirect.trim()}
          onClick={() => onAction("redirect", redirect.trim())}
          className="mt-2 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/85 disabled:opacity-40"
        >
          Re-run depth with this direction
        </button>
      </div>
    </div>
  );
}
