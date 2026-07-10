"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Boxes,
  Download,
  Loader2,
  Megaphone,
  Pause,
  Play,
  Send,
  ShoppingCart,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { BoardroomAgentState } from "@/lib/ai/boardroom-shared";
import { cn } from "@/lib/utils/cn";

const ICON_BY_ID: Record<string, LucideIcon> = {
  finance: Banknote,
  operations: Boxes,
  marketing: Megaphone,
  sales: ShoppingCart,
  hr: Users,
};

type Meeting = {
  id: string;
  status: string;
  invited_agent_ids: string[];
  title: string | null;
  awaiting_clarifiers?: boolean;
  credits_spent: number;
  created_at: string;
  ended_at?: string | null;
};

type Msg = {
  id: string;
  role: string;
  agent_id: string | null;
  content: string;
  created_at: string;
};

type Invitable = {
  id: string;
  label: string;
  role: string;
  live: boolean;
};

export function BoardroomMeetingClient({
  agents,
}: {
  agents: BoardroomAgentState[];
  activeCount: number;
}) {
  const [invitable, setInvitable] = useState<Invitable[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<Meeting[]>([]);
  const [history, setHistory] = useState<Meeting[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/boardroom/meetings");
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Could not load boardroom");
    setInvitable(json.invitable ?? []);
    setOpen(json.open ?? []);
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
  }, [messages]);

  function toggleAgent(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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
        }),
      });
      const json = await res.json();
      if (res.status === 409 && json.needs_confirm) {
        setConfirmNew(true);
        return;
      }
      if (!res.ok) {
        setError(json.message ?? json.error ?? "Could not start");
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

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!meeting || meeting.status !== "active" || !input.trim()) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/boardroom/meetings/${meeting.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Send failed");
        setInput(text);
        return;
      }
      setMessages(json.messages ?? []);
      if (typeof json.credit_balance === "number") {
        setCreditBalance(json.credit_balance);
      }
      setMeeting((m) =>
        m
          ? {
              ...m,
              awaiting_clarifiers: json.awaiting_clarifiers,
              credits_spent:
                (m.credits_spent ?? 0) + (json.credits_charged ?? 0),
            }
          : m,
      );
    } finally {
      setLoading(false);
    }
  }

  if (booting) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-ink-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading boardroom…
      </div>
    );
  }

  const inRoom = meeting && (meeting.status === "active" || meeting.status === "paused");
  const pausedOnly = meeting?.status === "paused";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
      <aside className="space-y-3 lg:col-span-1">
        {!inRoom || pausedOnly ? (
          <SectionCard
            title="Who joins this meeting?"
            subtitle="Pick at least 2 live agents"
            bodyClassName="space-y-2"
          >
            {invitable.map((a) => {
              const Icon = ICON_BY_ID[a.id] ?? Sparkles;
              return (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-2.5",
                    !a.live && "opacity-50",
                    selected.includes(a.id)
                      ? "border-brand-400 bg-brand-50/50 dark:border-brand-700"
                      : "border-cream-200 dark:border-hairline-dark",
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={!a.live || loading}
                    checked={selected.includes(a.id)}
                    onChange={() => toggleAgent(a.id)}
                    className="rounded border-cream-300"
                  />
                  <Icon className="h-4 w-4 text-brand-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block text-xs text-ink-muted">
                      {a.live ? a.role : "Activate in Marketplace"}
                    </span>
                  </span>
                </label>
              );
            })}
            <button
              type="button"
              disabled={loading || selected.length < 2}
              onClick={() => void startMeeting(false)}
              className="mt-2 w-full rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Start meeting
            </button>
            {pausedOnly ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void patchMeeting("resume")}
                className="w-full rounded-md border border-cream-300 px-3 py-2 text-sm font-semibold dark:border-hairline-dark"
              >
                <Play className="mr-1 inline h-3.5 w-3.5" />
                Resume paused meeting
              </button>
            ) : null}
          </SectionCard>
        ) : (
          <SectionCard
            title="In this room"
            subtitle={`${meeting.invited_agent_ids.join(", ")}`}
            bodyClassName="space-y-2"
          >
            {meeting.invited_agent_ids.map((id) => {
              const agent = agents.find((a) => a.id === id);
              const Icon = ICON_BY_ID[id] ?? Sparkles;
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-lg border border-cream-200 p-2 dark:border-hairline-dark"
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {agent?.label ?? id}
                  </span>
                </div>
              );
            })}
            <p className="text-xs text-ink-muted">
              Credits used this meeting: {meeting.credits_spent}
              {creditBalance != null ? ` · Pool: ${creditBalance}` : ""}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void patchMeeting("pause")}
                className="rounded-md border border-cream-300 px-3 py-2 text-sm font-semibold dark:border-hairline-dark"
              >
                <Pause className="mr-1 inline h-3.5 w-3.5" />
                Pause
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void patchMeeting("end")}
                className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white dark:bg-cream-100 dark:text-ink"
              >
                End meeting
              </button>
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="Past meetings"
          subtitle="Ended · export PDF"
          bodyClassName="space-y-2"
        >
          {history.length === 0 ? (
            <p className="text-xs text-ink-muted">No ended meetings yet.</p>
          ) : (
            history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-cream-200 px-2 py-2 text-xs dark:border-hairline-dark"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left font-medium hover:text-brand-700"
                  onClick={() => void loadMeeting(h.id)}
                >
                  {h.title ||
                    new Date(h.ended_at || h.created_at).toLocaleDateString(
                      "en-MY",
                    )}
                </button>
                <a
                  href={`/api/boardroom/meetings/${h.id}/pdf`}
                  className="shrink-0 text-brand-700"
                  title="Export PDF"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            ))
          )}
        </SectionCard>
      </aside>

      <section className="space-y-3 lg:col-span-3">
        {error ? (
          <p className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        {!meeting ? (
          <Card>
            <CardBody className="py-12 text-center text-sm text-ink-muted">
              Pick who joins, then Start meeting. Need at least two live agents
              (Maya, Hana, Sufi).
            </CardBody>
          </Card>
        ) : (
          <>
            <div
              ref={listRef}
              className="max-h-[28rem] space-y-4 overflow-y-auto rounded-xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark"
            >
              {messages.map((m) => {
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-2xl rounded-2xl rounded-tr-md bg-brand-500 px-4 py-3 text-sm text-white">
                        {m.content}
                      </div>
                    </div>
                  );
                }
                if (m.role === "synth") {
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-accent-200 bg-accent-50 p-4 dark:border-accent-700/40 dark:bg-accent-700/15"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
                        Recommendation
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{m.content}</p>
                    </div>
                  );
                }
                if (m.role === "room_clarifier") {
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-800 dark:bg-brand-900/20"
                    >
                      <p className="text-xs font-semibold text-brand-800 dark:text-brand-200">
                        Room questions (free)
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{m.content}</p>
                    </div>
                  );
                }
                const agent = agents.find((a) => a.id === m.agent_id);
                const Icon = ICON_BY_ID[m.agent_id ?? ""] ?? Sparkles;
                return (
                  <div key={m.id} className="flex items-start gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {agent?.label ?? m.agent_id ?? "Staff"}
                      </p>
                      <div className="mt-1 rounded-2xl rounded-tl-md border border-cream-200 bg-cream-50 px-4 py-3 text-sm dark:border-hairline-dark dark:bg-panel-dark">
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {meeting.status === "active" ? (
              <Card>
                <CardBody>
                  <form onSubmit={sendMessage} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={loading}
                      placeholder={
                        meeting.awaiting_clarifiers
                          ? "Answer the room questions…"
                          : "Ask the boardroom… or reply confirm to create drafts"
                      }
                      className="flex-1 rounded-md border border-cream-300 bg-white px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark"
                    />
                    <button
                      type="submit"
                      disabled={loading || !input.trim()}
                      className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send
                    </button>
                  </form>
                  <p className="mt-2 text-xs text-ink-muted">
                    Clarifiers are free. Each speaking agent uses 1 credit.{" "}
                    <Link href="/marketplace" className="font-semibold text-brand-700">
                      Marketplace
                    </Link>
                  </p>
                </CardBody>
              </Card>
            ) : meeting.status === "ended" ? (
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="neutral">Ended</StatusPill>
                <a
                  href={`/api/boardroom/meetings/${meeting.id}/pdf`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </a>
              </div>
            ) : (
              <StatusPill tone="warning">Paused — resume from the sidebar</StatusPill>
            )}
          </>
        )}
      </section>

      {confirmNew ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-panel-dark">
            <h3 className="text-base font-bold">Start a new meeting?</h3>
            <p className="mt-2 text-sm text-ink-muted">
              You have a paused meeting. Starting new will end the paused one
              (it stays in history). This cannot be undone as a resume.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmNew(false)}
                className="rounded-lg border border-cream-300 px-3 py-2 text-sm font-semibold dark:border-hairline-dark"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void startMeeting(true)}
                className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
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
