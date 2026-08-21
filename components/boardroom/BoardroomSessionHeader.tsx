"use client";

import {
  ChevronDown,
  Download,
  History,
  Loader2,
  Pause,
  Play,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { fmtMeetingWhen } from "@/lib/ai/boardroom-ui";
import { cn } from "@/lib/utils/cn";

type HistoryEntry = {
  id: string;
  created_at: string;
  ended_at?: string | null;
};

type MeetingStatus = string;

export function BoardroomSessionHeader({
  meetingId,
  meetingStatus,
  meetingMode,
  creditsSpent,
  depthRound,
  creditBalance,
  history,
  historyOpen,
  deletingHistoryId,
  loading,
  statusTone,
  statusLabel,
  onToggleHistory,
  onLoadMeeting,
  onDeleteHistory,
  onPause,
  onResume,
  onEnd,
  onNewMeeting,
}: {
  meetingId: string;
  meetingStatus: MeetingStatus;
  meetingMode?: string;
  creditsSpent: number;
  depthRound?: number | null;
  creditBalance: number | null;
  history: HistoryEntry[];
  historyOpen: boolean;
  deletingHistoryId: string | null;
  loading: boolean;
  statusTone: "success" | "warning" | "neutral";
  statusLabel: string;
  onToggleHistory: () => void;
  onLoadMeeting: (id: string) => void;
  onDeleteHistory: (id: string) => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onNewMeeting: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
        {creditsSpent > 0 ? (
          <span className="text-xs text-white/45">
            {creditsSpent} credit{creditsSpent === 1 ? "" : "s"}
          </span>
        ) : null}
        {meetingMode === "depth" ? (
          <span className="rounded-md border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
            Depth
          </span>
        ) : null}
        {depthRound ? (
          <span className="text-xs text-white/45">Round {depthRound}</span>
        ) : null}
        {creditBalance != null ? (
          <span className="text-xs text-white/45">· {creditBalance} pool</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {history.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              onClick={onToggleHistory}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              <History className="h-3.5 w-3.5" />
              History
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition",
                  historyOpen && "rotate-180",
                )}
              />
            </button>
            {historyOpen ? (
              <div className="absolute right-0 z-10 mt-1 w-64 rounded-xl border border-cream-200 bg-white py-1 shadow-lg dark:border-hairline-dark dark:bg-panel-dark">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-1 px-2 py-1">
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs text-ink hover:bg-cream-50 dark:text-cream-100 dark:hover:bg-hairline-dark/60"
                      onClick={() => onLoadMeeting(h.id)}
                    >
                      {fmtMeetingWhen(h.ended_at || h.created_at)}
                    </button>
                    <a
                      href={`/api/boardroom/meetings/${h.id}/pdf`}
                      className="rounded-md p-1.5 text-brand-700 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-hairline-dark/60"
                      title="Download PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      disabled={deletingHistoryId === h.id}
                      onClick={() => onDeleteHistory(h.id)}
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
                      title="Delete from history"
                    >
                      {deletingHistoryId === h.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {meetingStatus === "active" ? (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={onPause}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/10"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onEnd}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
            >
              <Square className="h-3.5 w-3.5" />
              End
            </button>
          </>
        ) : meetingStatus === "paused" ? (
          <button
            type="button"
            disabled={loading}
            onClick={onResume}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            <Play className="h-3.5 w-3.5" />
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={onNewMeeting}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5" />
            New meeting
          </button>
        )}
      </div>
    </div>
  );
}
