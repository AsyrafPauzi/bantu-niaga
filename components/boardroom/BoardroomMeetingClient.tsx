"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  History,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  BoardroomMessage,
  type BoardroomMsgMeta,
} from "@/components/boardroom/BoardroomMessage";
import { BoardroomTypingIndicator } from "@/components/boardroom/BoardroomTypingIndicator";
import { DepthCheckpointCard } from "@/components/boardroom/DepthCheckpointCard";
import { DepthConfidenceBar } from "@/components/boardroom/DepthConfidenceBar";
import type { BoardroomPendingAction } from "@/lib/ai/boardroom-actions";
import type { DepthState } from "@/lib/ai/boardroom-output-schema";
import { DEPTH_CHECKPOINT_CREDITS } from "@/lib/ai/boardroom-output-schema";
import type { DepthAction } from "@/lib/ai/boardroom-orchestrator";
import type { BoardroomAgentState } from "@/lib/ai/boardroom-shared";
import { BOARDROOM_MAX_INVITEES } from "@/lib/ai/boardroom-shared";
import {
  BOARDROOM_AGENT_ACCENT,
  BOARDROOM_AGENT_ICON,
  boardroomAgentLabel,
  resolveBoardroomDisplayName,
  fmtMeetingWhen,
  isBoardroomAgentId,
} from "@/lib/ai/boardroom-ui";
import { cn } from "@/lib/utils/cn";

type Meeting = {
  id: string;
  status: string;
  invited_agent_ids: string[];
  title: string | null;
  awaiting_clarifiers?: boolean;
  credits_spent: number;
  meeting_mode?: string;
  depth_state?: DepthState | null;
  pending_actions?: BoardroomPendingAction[] | null;
  created_at: string;
  ended_at?: string | null;
};

type Msg = {
  id: string;
  role: string;
  agent_id: string | null;
  content: string;
  meta?: BoardroomMsgMeta | null;
  created_at: string;
};

type MeetingMode = "normal" | "depth";

type Invitable = {
  id: string;
  label: string;
  role: string;
  subscribed: boolean;
  live: boolean;
};

function meetingStatusTone(
  status: string,
): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  return "neutral";
}

function meetingStatusLabel(status: string): string {
  if (status === "active") return "Live";
  if (status === "paused") return "Paused";
  if (status === "ended") return "Ended";
  return status;
}

function AgentChip({
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

function AgentSeat({
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

export function BoardroomMeetingClient({
  agents: _agents,
}: {
  agents: BoardroomAgentState[];
}) {
  const [invitable, setInvitable] = useState<Invitable[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<Meeting[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>("normal");
  const [typingAgentId, setTypingAgentId] = useState<string | null>(null);
  const [depthCheckpoint, setDepthCheckpoint] = useState<{
    confidence: number;
    creditsSinceCheckpoint: number;
    partialContent?: string;
    partialStructured?: BoardroomMsgMeta["structured"];
  } | null>(null);
  const [pendingActions, setPendingActions] = useState<BoardroomPendingAction[]>(
    [],
  );
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== "system"),
    [messages],
  );

  const agentLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const agent of invitable) {
      map[agent.id] = agent.label;
    }
    return map;
  }, [invitable]);

  const labelForAgent = useCallback(
    (id: string) => resolveBoardroomDisplayName(id, agentLabels),
    [agentLabels],
  );

  /** Latest recommendation pinned after discussion; above depth checkpoint when shown. */
  const { threadMessages, trailingRecommendation } = useMemo(() => {
    let lastSynthIdx = -1;
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i]!.role === "synth") {
        lastSynthIdx = i;
        break;
      }
    }
    if (lastSynthIdx === -1) {
      return {
        threadMessages: visibleMessages,
        trailingRecommendation: null as Msg | null,
      };
    }
    return {
      threadMessages: visibleMessages.filter((_, i) => i !== lastSynthIdx),
      trailingRecommendation: visibleMessages[lastSynthIdx]!,
    };
  }, [visibleMessages]);

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/boardroom/meetings");
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Could not load boardroom");
    setInvitable(json.invitable ?? []);
    setHistory(json.history ?? []);
    const liveIds = (json.invitable ?? [])
      .filter((a: Invitable) => a.live)
      .map((a: Invitable) => a.id);
    setSelected((prev) =>
      prev.length > 0 ? prev.filter((id) => liveIds.includes(id)) : liveIds.slice(0, 2),
    );
    return json;
  }, []);

  const loadMeeting = useCallback(async (id: string) => {
    const res = await fetch(`/api/boardroom/meetings/${id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Could not load meeting");
    setMeeting(json.data);
    setMessages(json.messages ?? []);
    setPendingActions(
      (json.data.pending_actions as BoardroomPendingAction[] | null) ?? [],
    );
    setDepthCheckpoint(
      json.data.depth_state?.paused_at_checkpoint
        ? {
            confidence: json.data.depth_state.confidence ?? 0,
            creditsSinceCheckpoint:
              json.data.depth_state.credits_since_checkpoint ??
              DEPTH_CHECKPOINT_CREDITS,
          }
        : null,
    );
    setHistoryOpen(false);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const json = await refreshList();
        const active = (json.open ?? []).find(
          (m: Meeting) => m.status === "active",
        );
        const paused = (json.open ?? []).find(
          (m: Meeting) => m.status === "paused",
        );
        if (active) await loadMeeting(active.id);
        else if (paused) {
          setMeeting(paused);
          await loadMeeting(paused.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setBooting(false);
      }
    })();
  }, [refreshList, loadMeeting]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [threadMessages, trailingRecommendation, depthCheckpoint]);

  function toggleAgent(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= BOARDROOM_MAX_INVITEES) {
        setError(`You can invite up to ${BOARDROOM_MAX_INVITEES} team members.`);
        return prev;
      }
      setError(null);
      return [...prev, id];
    });
  }

  function formatStartError(json: {
    error?: string;
    message?: string;
    issues?: Array<{ message?: string }>;
  }): string {
    if (json.message) return json.message;
    if (json.error === "validation_failed") {
      return `Pick ${2}–${BOARDROOM_MAX_INVITEES} team members who are switched on.`;
    }
    return json.error ?? "Could not start meeting";
  }

  function startNewMeeting() {
    setMeeting(null);
    setMessages([]);
    setInput("");
    setError(null);
  }

  async function startMeeting(replacePaused = false) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/boardroom/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invited_agent_ids: selected,
          replace_paused: replacePaused,
          meeting_mode: meetingMode,
        }),
      });
      const json = await res.json();
      if (res.status === 409 && json.needs_confirm) {
        setConfirmNew(true);
        return;
      }
      if (!res.ok) {
        setError(formatStartError(json));
        return;
      }
      setConfirmNew(false);
      await refreshList();
      await loadMeeting(json.data.id);
    } finally {
      setLoading(false);
    }
  }

  async function patchMeeting(action: "pause" | "resume" | "end") {
    if (!meeting) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/boardroom/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Update failed");
        return;
      }
      await refreshList();
      if (action === "end") {
        setMeeting(json.data);
        await loadMeeting(json.data.id);
      } else {
        await loadMeeting(meeting.id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteHistoryMeeting(id: string) {
    setDeletingHistoryId(id);
    setError(null);
    try {
      const res = await fetch(`/api/boardroom/meetings/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Could not delete meeting");
        return;
      }
      if (meeting?.id === id) {
        setMeeting(null);
        setMessages([]);
        setPendingActions([]);
        setDepthCheckpoint(null);
      }
      await refreshList();
    } finally {
      setDeletingHistoryId(null);
    }
  }

  async function sendStreamPayload(payload: Record<string, unknown>) {
    if (!meeting || meeting.status !== "active") return;
    setLoading(true);
    setError(null);
    setTypingAgentId(null);
    setDepthCheckpoint(null);

    try {
      const res = await fetch(
        `/api/boardroom/meetings/${meeting.id}/message/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const json = await res.json();
        setError(json.message ?? "Send failed");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Streaming not supported in this browser.");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = JSON.parse(line.slice(5)) as {
            event: string;
            agentId?: string;
            content?: string;
            structured?: unknown;
            confidence?: number;
            creditsSinceCheckpoint?: number;
            partialContent?: string;
            partialStructured?: unknown;
            messages?: Msg[];
            credit_balance?: number;
            credits_charged?: number;
            awaiting_clarifiers?: boolean;
            awaiting_depth_checkpoint?: boolean;
            depth_state?: DepthState | null;
            pending_actions?: BoardroomPendingAction[];
            invited_agent_ids?: string[];
            message?: string;
          };

          if (json.event === "agent_start" && json.agentId) {
            setTypingAgentId(json.agentId);
            setDepthCheckpoint(null);
          }
          if (json.event === "agent_done" && json.agentId && json.content) {
            setTypingAgentId(null);
            setMessages((prev) => [
              ...prev,
              {
                id: `stream-agent-${json.agentId}-${Date.now()}`,
                role: "agent",
                agent_id: json.agentId!,
                content: json.content!,
                meta: { structured: json.structured as BoardroomMsgMeta["structured"] },
                created_at: new Date().toISOString(),
              },
            ]);
          }
          if (json.event === "recommendation_done" && json.content) {
            setTypingAgentId(null);
            setMessages((prev) => [
              ...prev,
              {
                id: `stream-synth-${Date.now()}`,
                role: "synth",
                agent_id: null,
                content: json.content!,
                meta: {
                  structured: json.structured as BoardroomMsgMeta["structured"],
                  priority_actions: json.pending_actions,
                },
                created_at: new Date().toISOString(),
              },
            ]);
            if (json.pending_actions?.length) {
              setPendingActions(json.pending_actions);
            }
          }
          if (json.event === "depth_checkpoint") {
            setDepthCheckpoint({
              confidence: json.confidence ?? 0,
              creditsSinceCheckpoint:
                json.creditsSinceCheckpoint ?? DEPTH_CHECKPOINT_CREDITS,
              partialContent: json.partialContent,
              partialStructured:
                json.partialStructured as BoardroomMsgMeta["structured"],
            });
          }
          if (json.event === "error") {
            setError(json.message ?? "Turn failed");
          }
          if (json.event === "done") {
            if (json.messages) setMessages(json.messages);
            if (typeof json.credit_balance === "number") {
              setCreditBalance(json.credit_balance);
            }
            setPendingActions(json.pending_actions ?? []);
            setMeeting((m) =>
              m
                ? {
                    ...m,
                    awaiting_clarifiers: json.awaiting_clarifiers ?? false,
                    depth_state: json.depth_state ?? m.depth_state,
                    credits_spent:
                      (m.credits_spent ?? 0) + (json.credits_charged ?? 0),
                    pending_actions: json.pending_actions ?? null,
                    invited_agent_ids:
                      json.invited_agent_ids ?? m.invited_agent_ids,
                  }
                : m,
            );
            if (json.awaiting_depth_checkpoint && json.depth_state) {
              setDepthCheckpoint({
                confidence: json.depth_state.confidence ?? 0,
                creditsSinceCheckpoint:
                  json.depth_state.credits_since_checkpoint ??
                  DEPTH_CHECKPOINT_CREDITS,
              });
            }
          }
        }
      }
    } finally {
      setLoading(false);
      setTypingAgentId(null);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!meeting || meeting.status !== "active" || !input.trim()) return;
    const text = input.trim();
    setInput("");

    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: "user",
        agent_id: null,
        content: text,
        created_at: new Date().toISOString(),
      },
    ]);

    await sendStreamPayload({ message: text, stream: true });
  }

  async function handleDepthAction(
    action: DepthAction,
    redirectMessage?: string,
    inviteAgentIds?: string[],
  ) {
    setDepthCheckpoint(null);
    await sendStreamPayload({
      depth_action: action,
      redirect_message: redirectMessage,
      invite_agent_ids: inviteAgentIds,
      stream: true,
    });
  }

  if (booting) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-cream-200 bg-cream-50/50 dark:border-hairline-dark dark:bg-panel-dark/40">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-600" />
        <span className="text-sm text-ink-muted">Opening the boardroom…</span>
      </div>
    );
  }

  const inSession =
    meeting &&
    (meeting.status === "active" ||
      meeting.status === "paused" ||
      meeting.status === "ended");
  const showSetup = !inSession;
  const pausedOnly = meeting?.status === "paused";

  const selectedLabels = selected
    .map((id) => invitable.find((a) => a.id === id)?.label ?? boardroomAgentLabel(id))
    .join(", ");

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      {showSetup ? (
        <div className="flex flex-col gap-3 rounded-xl border border-cream-200 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white shadow-sm dark:border-hairline-dark sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Boardroom
            </p>
            <p className="text-sm font-semibold">
              Pick at least 2 · up to {BOARDROOM_MAX_INVITEES}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {invitable.map((a) => (
              <AgentChip
                key={a.id}
                agentId={a.id}
                label={a.label}
                selected={selected.includes(a.id)}
                disabled={!a.live || loading}
                onClick={() => toggleAgent(a.id)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMeetingMode("normal")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                meetingMode === "normal"
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-white/80 hover:bg-white/15",
              )}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setMeetingMode("depth")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                meetingMode === "depth"
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-white/80 hover:bg-white/15",
              )}
            >
              Depth
            </button>
            <span className="hidden text-[11px] text-white/45 sm:inline">
              {meetingMode === "depth"
                ? "Debate until 80% confident"
                : "Agents validate in invite order"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {history.length > 0 ? (
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10"
              >
                <History className="h-3 w-3" />
                Recent
              </button>
            ) : null}
            <button
              type="button"
              disabled={loading || selected.length < 2}
              onClick={() => void startMeeting(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white/90 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Call meeting
            </button>
          </div>
        </div>
      ) : null}

      {showSetup && historyOpen && history.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-lg border border-cream-200 bg-white px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark">
          {history.map((h) => (
            <div
              key={h.id}
              className="inline-flex items-center gap-0.5 rounded-md border border-cream-200 dark:border-hairline-dark"
            >
              <button
                type="button"
                onClick={() => void loadMeeting(h.id)}
                className="rounded-l-md px-2 py-1 text-[11px] font-medium text-ink-muted hover:text-brand-700 dark:hover:text-brand-200"
              >
                {fmtMeetingWhen(h.ended_at || h.created_at)}
              </button>
              <a
                href={`/api/boardroom/meetings/${h.id}/pdf`}
                className="p-1 text-brand-700 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-hairline-dark/60"
                title="Download PDF"
              >
                <Download className="h-3 w-3" />
              </a>
              <button
                type="button"
                disabled={deletingHistoryId === h.id}
                onClick={() => void deleteHistoryMeeting(h.id)}
                className="rounded-r-md p-1 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
                title="Delete from history"
              >
                {deletingHistoryId === h.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-cream-200 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-card dark:border-hairline-dark">
        {inSession ? (
          <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={meetingStatusTone(meeting.status)}>
                {meetingStatusLabel(meeting.status)}
              </StatusPill>
              {meeting.credits_spent > 0 ? (
                <span className="text-xs text-white/45">
                  {meeting.credits_spent} credit
                  {meeting.credits_spent === 1 ? "" : "s"}
                </span>
              ) : null}
              {meeting.meeting_mode === "depth" ? (
                <span className="rounded-md border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                  Depth
                </span>
              ) : null}
              {meeting.depth_state?.round ? (
                <span className="text-xs text-white/45">
                  Round {meeting.depth_state.round}
                </span>
              ) : null}
              {creditBalance != null ? (
                <span className="text-xs text-white/45">
                  · {creditBalance} pool
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {history.length > 0 ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((o) => !o)}
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
                        <div
                          key={h.id}
                          className="flex items-center gap-1 px-2 py-1"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs text-ink hover:bg-cream-50 dark:text-cream-100 dark:hover:bg-hairline-dark/60"
                            onClick={() => void loadMeeting(h.id)}
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
                            onClick={() => void deleteHistoryMeeting(h.id)}
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

              {meeting.status === "active" ? (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void patchMeeting("pause")}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/10"
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void patchMeeting("end")}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                  >
                    <Square className="h-3.5 w-3.5" />
                    End
                  </button>
                </>
              ) : meeting.status === "paused" ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void patchMeeting("resume")}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startNewMeeting}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New meeting
                </button>
              )}
            </div>
          </div>

          {meeting.meeting_mode === "depth" &&
          meeting.depth_state?.confidence != null ? (
            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <DepthConfidenceBar
                confidence={meeting.depth_state.confidence}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap justify-center gap-4 border-b border-white/10 px-4 py-3 sm:gap-5">
            {meeting.invited_agent_ids.map((id) => (
              <AgentSeat
                key={id}
                agentId={id}
                label={labelForAgent(id)}
                active={meeting.status === "active"}
              />
            ))}
          </div>

          <div
            ref={listRef}
            className="min-h-[min(50vh,24rem)] max-h-[min(60vh,32rem)] space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
          >
            {threadMessages.length === 0 && !trailingRecommendation ? (
              <p className="py-12 text-center text-sm text-white/45">
                {meeting.status === "active"
                  ? "The table is set. Ask your question below."
                  : "No messages in this session."}
              </p>
            ) : (
              threadMessages.map((m) => (
                <BoardroomMessage
                  key={m.id}
                  role={m.role}
                  agentId={m.agent_id}
                  content={m.content}
                  meta={m.meta}
                  meetingActive={meeting.status === "active"}
                  agentLabels={agentLabels}
                />
              ))
            )}
            {typingAgentId ? (
              <BoardroomTypingIndicator
                agentId={typingAgentId}
                label={labelForAgent(typingAgentId)}
              />
            ) : null}
            {trailingRecommendation ? (
              <BoardroomMessage
                key={trailingRecommendation.id}
                role={trailingRecommendation.role}
                agentId={trailingRecommendation.agent_id}
                content={trailingRecommendation.content}
                meta={trailingRecommendation.meta}
                pendingActions={pendingActions}
                meetingActive={meeting.status === "active"}
                agentLabels={agentLabels}
              />
            ) : depthCheckpoint?.partialContent ? (
              <BoardroomMessage
                key="depth-checkpoint-partial-synth"
                role="synth"
                agentId={null}
                content={depthCheckpoint.partialContent}
                meta={{ structured: depthCheckpoint.partialStructured }}
                pendingActions={pendingActions}
                meetingActive={meeting.status === "active"}
                agentLabels={agentLabels}
              />
            ) : null}
            {depthCheckpoint && meeting.status === "active" ? (
              <DepthCheckpointCard
                confidence={depthCheckpoint.confidence}
                creditsSinceCheckpoint={depthCheckpoint.creditsSinceCheckpoint}
                invitable={invitable}
                invitedAgentIds={meeting.invited_agent_ids}
                onAction={(action, msg, inviteIds) =>
                  void handleDepthAction(action, msg, inviteIds)
                }
                loading={loading}
              />
            ) : null}
          </div>

          {meeting.status === "active" ? (
            <form
              onSubmit={sendMessage}
              className="border-t border-white/10 bg-black/20 p-4 sm:px-5"
            >
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mic className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loading}
                    placeholder={
                      meeting.awaiting_clarifiers
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
          ) : meeting.status === "ended" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
              <a
                href={`/api/boardroom/meetings/${meeting.id}/pdf`}
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
          ) : pausedOnly ? (
            <p className="border-t border-white/10 px-4 py-3 text-center text-xs text-white/45">
              Paused — resume to continue.
            </p>
          ) : null}
          </>
        ) : (
          <>
            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Meeting room
              </p>
              <p className="mt-0.5 text-sm text-white/60">
                {selected.length >= 2
                  ? `Waiting for ${selectedLabels}…`
                  : "Select at least 2 team members above, then call the meeting."}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 border-b border-white/10 px-4 py-4 sm:gap-5">
              {selected.length > 0 ? (
                selected.map((id) => (
                  <AgentSeat
                    key={id}
                    agentId={id}
                    label={
                      invitable.find((a) => a.id === id)?.label ??
                      boardroomAgentLabel(id)
                    }
                    active={false}
                  />
                ))
              ) : (
                <p className="py-6 text-sm text-white/35">
                  Seats will appear here once you pick your team.
                </p>
              )}
            </div>
            <div className="flex min-h-[min(40vh,20rem)] items-center justify-center px-4 py-8">
              <p className="max-w-sm text-center text-sm text-white/40">
                Your question and the team&apos;s debate will show here after you
                call the meeting.
              </p>
            </div>
            <div className="border-t border-white/10 bg-black/20 p-4 opacity-50 sm:px-5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mic className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    disabled
                    placeholder="Ask one business question…"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/35"
                  />
                </div>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white/40">
                  <Send className="h-4 w-4" />
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmNew ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-panel-dark">
            <h3 className="text-lg font-bold text-ink dark:text-cream-100">
              Replace paused meeting?
            </h3>
            <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
              Starting fresh will end your paused session. It stays in history.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmNew(false)}
                className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold dark:border-hairline-dark"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void startMeeting(true)}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Start new
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
