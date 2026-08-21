"use client";

import Link from "next/link";
import { Download, Loader2, Mic, Send } from "lucide-react";

export function BoardroomInputBar({
  meetingId,
  meetingStatus,
  awaitingClarifiers,
  input,
  loading,
  onInputChange,
  onSubmit,
}: {
  meetingId: string;
  meetingStatus: string;
  awaitingClarifiers?: boolean;
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (meetingStatus === "active") {
    return (
      <form
        onSubmit={onSubmit}
        className="border-t border-white/10 bg-black/20 p-4 sm:px-5"
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Mic className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              disabled={loading}
              placeholder={
                awaitingClarifiers
                  ? "Answer the room's questions…"
                  : "Ask one business question…"
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/10"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-white/35">
          Clarifiers free · 1 credit per reply ·{" "}
          <Link href="/settings/billing" className="text-white/55 hover:underline">
            Billing
          </Link>
        </p>
      </form>
    );
  }

  if (meetingStatus === "ended") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
        <a
          href={`/api/boardroom/meetings/${meetingId}/pdf`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </a>
        <p className="text-[11px] text-white/35">
          1 credit per reply ·{" "}
          <Link href="/settings/billing" className="text-white/55 hover:underline">
            Billing
          </Link>
        </p>
      </div>
    );
  }

  if (meetingStatus === "paused") {
    return (
      <p className="border-t border-white/10 px-4 py-3 text-center text-xs text-white/45">
        Paused — resume to continue.
      </p>
    );
  }

  return null;
}
