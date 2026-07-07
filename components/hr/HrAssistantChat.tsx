"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageSquarePlus, PauseCircle, Send, Sparkles } from "lucide-react";
import { HR_ASSISTANT_SUGGESTIONS } from "@/lib/ai/hr-assistant-prompt";
import { HrAssistantGate } from "@/components/hr/HrAssistantGate";
import { HrAssistantMessage } from "@/components/hr/HrAssistantMessage";
import { HR_CREDIT_COST_CHAT } from "@/lib/marketplace/agent-types";
import { cn } from "@/lib/utils/cn";

const MAX_MESSAGES = 20;

function storageKey(businessId: string): string {
  return `bn-hr-assistant-chat-v1-${businessId}`;
}

type ChatRole = "user" | "assistant";

interface ChatTurn {
  role: ChatRole;
  content: string;
}

interface AssistantStatus {
  addon_active: boolean;
  assistant_enabled: boolean;
  display_name: string;
  credit_balance: number;
  credits_paused?: boolean;
  business_id?: string;
  recent_turns?: ChatTurn[];
}

interface HrAssistantChatProps {
  businessId: string;
  initialStatus?: AssistantStatus | null;
}

function loadSession(businessId: string): ChatTurn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatTurn[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

function saveSession(businessId: string, turns: ChatTurn[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      storageKey(businessId),
      JSON.stringify(turns.slice(-MAX_MESSAGES)),
    );
  } catch {
    // ignore quota errors
  }
}

export function HrAssistantChat({
  businessId,
  initialStatus,
}: HrAssistantChatProps) {
  const [status, setStatus] = useState<AssistantStatus | null>(
    initialStatus ?? null,
  );
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(!initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(
    initialStatus?.credit_balance ?? null,
  );
  const listRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      const local = loadSession(businessId);
      if (local.length > 0) {
        setTurns(local);
      } else if (initialStatus?.recent_turns?.length) {
        setTurns(initialStatus.recent_turns);
      }
      hydrated.current = true;
    }
  }, [businessId, initialStatus?.recent_turns]);

  useEffect(() => {
    if (hydrated.current) {
      saveSession(businessId, turns);
    }
  }, [businessId, turns]);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/hr/assistant");
      const json = (await res.json()) as AssistantStatus & {
        error?: string;
      };
      if (res.ok) {
        setStatus(json);
        setCreditBalance(json.credit_balance);
        if (
          turns.length === 0 &&
          json.recent_turns &&
          json.recent_turns.length > 0
        ) {
          setTurns(json.recent_turns);
        }
      }
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialStatus) {
      void refreshStatus();
    }
  }, [initialStatus, refreshStatus]);

  function newChat() {
    setTurns([]);
    setError(null);
    setInput("");
    sessionStorage.removeItem(storageKey(businessId));
    void fetch("/api/hr/assistant", { method: "DELETE" }).catch(() => undefined);
  }

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    if (creditBalance !== null && creditBalance < HR_CREDIT_COST_CHAT) {
      setError(
        "No credits left. Top up in Billing or wait for your monthly refill.",
      );
      return;
    }

    setError(null);
    setLoading(true);
    setInput("");

    const userTurn: ChatTurn = { role: "user", content: message };
    setTurns((prev) => [...prev, userTurn]);

    try {
      const res = await fetch("/api/hr/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        message?: string;
        error?: string;
        credit_balance?: number;
        billing_href?: string;
        credits?: { balance: number; mode: string; charged: number };
      };

      if (res.status === 403 && data.error === "addon_required") {
        setStatus((s) => (s ? { ...s, addon_active: false } : s));
        setTurns((prev) => prev.slice(0, -1));
        setInput(message);
        return;
      }

      if (
        res.status === 402 &&
        data.error === "insufficient_credits"
      ) {
        if (typeof data.credit_balance === "number") {
          setCreditBalance(data.credit_balance);
        }
        setTurns((prev) => prev.slice(0, -1));
        setInput(message);
        setError(
          data.message ??
            "No credits left. Top up in Billing or wait for your monthly refill.",
        );
        return;
      }

      if (res.status === 429 && data.error === "daily_budget_exceeded") {
        setTurns((prev) => prev.slice(0, -1));
        setInput(message);
        setError(data.message ?? "Daily budget reached for this agent.");
        return;
      }

      if (!res.ok) {
        throw new Error(
          data.message || "Could not reach the HR assistant. Try again.",
        );
      }

      const reply = data.reply?.trim() || "I could not generate a response.";
      setTurns((prev) => [...prev, { role: "assistant", content: reply }]);

      if (data.credits) {
        setCreditBalance(data.credits.balance);
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Something went wrong. Try again.";
      setError(msg);
      setTurns((prev) => prev.slice(0, -1));
      setInput(message);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  if (statusLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-ink-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!status?.addon_active) {
    return <HrAssistantGate />;
  }

  if (!status.assistant_enabled) {
    return (
      <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 text-center text-sm text-ink-muted dark:border-hairline-dark dark:bg-panel-dark">
        HR Assistant is turned off. Enable it in{" "}
        <a href="/settings/ai-agents" className="font-semibold text-brand-700">
          Settings → AI Agents
        </a>
        .
      </div>
    );
  }

  const displayName = status.display_name || "Hana";
  const creditsPaused =
    creditBalance !== null && creditBalance < HR_CREDIT_COST_CHAT;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E5E0D8] bg-white dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E5E0D8] px-4 py-3 dark:border-hairline-dark">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-cream-100">
          <Sparkles className="h-4 w-4 text-brand-600" />
          {displayName}
        </div>
        <div className="flex items-center gap-2">
          {creditBalance !== null ? (
            <span
              className={cn(
                "text-xs font-medium",
                creditsPaused
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-ink-muted dark:text-cream-400",
              )}
            >
              {creditsPaused ? (
                <>
                  <PauseCircle className="mr-1 inline h-3.5 w-3.5" />
                  Paused · 0 credits
                </>
              ) : (
                <>⚡ {creditBalance} shared credits left</>
              )}
            </span>
          ) : null}
          <button
            type="button"
            onClick={newChat}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E5E0D8] px-2.5 py-1 text-xs font-medium text-ink-muted hover:text-ink dark:border-hairline-dark dark:text-cream-400"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>
      </div>

      {creditsPaused ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          AI chat is paused — no credits left in your shared pool.{" "}
          <Link
            href="/settings/billing"
            className="font-semibold underline hover:text-amber-950 dark:hover:text-amber-50"
          >
            Top up in Billing
          </Link>{" "}
          or wait for your monthly refill.
        </div>
      ) : null}

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5"
      >
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Ask {displayName} about your HR records
            </p>
            <p className="mt-1 max-w-sm text-xs text-ink-muted dark:text-cream-400">
              Answers use lists and links where helpful. 1 credit per question;
              leave actions use 2 credits.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {HR_ASSISTANT_SUGGESTIONS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading || creditsPaused}
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-[#E5E0D8] bg-[#FFFEFB] px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 dark:border-hairline-dark dark:bg-surface-dark dark:text-cream-400"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, i) => (
            <div
              key={`${turn.role}-${i}`}
              className={cn(
                "max-w-[min(90%,42rem)] rounded-2xl px-4 py-3 text-sm",
                turn.role === "user"
                  ? "ml-auto bg-brand-500 text-white"
                  : "mr-auto border border-[#E5E0D8] bg-[#FFFEFB] text-ink dark:border-hairline-dark dark:bg-surface-dark dark:text-cream-100",
              )}
            >
              {turn.role === "assistant" ? (
                <HrAssistantMessage content={turn.content} />
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">
                  {turn.content}
                </p>
              )}
            </div>
          ))
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-ink-muted dark:text-cream-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking your HR records…
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="px-4 pb-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-[#E5E0D8] bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${displayName}…`}
            maxLength={2000}
            disabled={loading || creditsPaused}
            className="flex-1 rounded-xl border border-[#E5E0D8] bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <button
            type="submit"
            disabled={loading || creditsPaused || !input.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-muted dark:text-cream-500">
          Not legal advice. Chat clears when you close this tab.
        </p>
      </form>
    </div>
  );
}
