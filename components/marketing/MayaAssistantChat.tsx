"use client";

import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, MessageSquarePlus, PauseCircle, Send, Sparkles } from "lucide-react";
import { MARKETING_ASSISTANT_SUGGESTIONS } from "@/lib/ai/marketing-assistant-prompt";
import type {
  PillarAssistantChatHandle as MayaAssistantChatHandle,
  PillarAssistantChatTurn,
  PillarAssistantChatVariant,
  PillarAssistantStatus as MayaAssistantStatus,
} from "@/lib/ai/pillar-assistant-types";
import { MayaAssistantGate } from "@/components/marketing/MayaAssistantGate";
import { MayaAssistantMessage } from "@/components/marketing/MayaAssistantMessage";
import { HR_CREDIT_COST_CHAT } from "@/lib/marketplace/agent-types";
import { cn } from "@/lib/utils/cn";

export type { MayaAssistantStatus, MayaAssistantChatHandle };

const MAX_MESSAGES = 20;

function storageKey(businessId: string): string {
  return `bn-maya-assistant-chat-v1-${businessId}`;
}

interface MayaAssistantChatProps {
  businessId: string;
  initialStatus?: MayaAssistantStatus | null;
  /** Pre-fill the message box (e.g. from customer win-back CTA). */
  initialSeed?: string;
  variant?: PillarAssistantChatVariant;
  onStatusChange?: (status: MayaAssistantStatus) => void;
}

function loadSession(businessId: string): PillarAssistantChatTurn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PillarAssistantChatTurn[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

function saveSession(businessId: string, turns: PillarAssistantChatTurn[]) {
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

export const MayaAssistantChat = forwardRef<
  MayaAssistantChatHandle,
  MayaAssistantChatProps
>(function MayaAssistantChat(
  {
    businessId,
    initialStatus,
    initialSeed,
    variant = "page",
    onStatusChange,
  },
  ref,
) {
  const isPanel = variant === "panel";
  const [status, setStatus] = useState<MayaAssistantStatus | null>(
    initialStatus ?? null,
  );
  const [turns, setTurns] = useState<PillarAssistantChatTurn[]>([]);
  const [input, setInput] = useState(initialSeed ?? "");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(!initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(
    initialStatus?.credit_balance ?? null,
  );
  const listRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  const patchStatus = useCallback(
    (patch: Partial<MayaAssistantStatus>) => {
      setStatus((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        onStatusChange?.(next);
        return next;
      });
    },
    [onStatusChange],
  );

  useEffect(() => {
    if (initialSeed) {
      setInput(initialSeed);
    }
  }, [initialSeed]);

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
      const res = await fetch("/api/marketing/assistant");
      const json = (await res.json()) as MayaAssistantStatus & {
        error?: string;
      };
      if (res.ok) {
        setStatus(json);
        setCreditBalance(json.credit_balance);
        onStatusChange?.(json);
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
  }, [onStatusChange, turns.length]);

  useEffect(() => {
    if (!initialStatus) {
      void refreshStatus();
    }
  }, [initialStatus, refreshStatus]);

  const newChat = useCallback(() => {
    setTurns([]);
    setError(null);
    setInput("");
    sessionStorage.removeItem(storageKey(businessId));
    void fetch("/api/marketing/assistant", { method: "DELETE" }).catch(
      () => undefined,
    );
  }, [businessId]);

  useImperativeHandle(ref, () => ({ newChat }), [newChat]);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setError(null);
    setLoading(true);
    setInput("");

    const userTurn: PillarAssistantChatTurn = { role: "user", content: message };
    setTurns((prev) => [...prev, userTurn]);

    try {
      const res = await fetch("/api/marketing/assistant", {
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
        patchStatus({ addon_active: false });
        setTurns((prev) => prev.slice(0, -1));
        setInput(message);
        return;
      }

      if (res.status === 402 && data.error === "insufficient_credits") {
        if (typeof data.credit_balance === "number") {
          setCreditBalance(data.credit_balance);
          patchStatus({ credit_balance: data.credit_balance });
        }
        setTurns((prev) => prev.slice(0, -1));
        setInput(message);
        setError(
          data.message ??
            "No credits left. Top up in Billing or wait for your monthly refill.",
        );
        return;
      }

      if (res.status === 403 && data.error === "assistant_disabled") {
        patchStatus({ assistant_enabled: false });
        setTurns((prev) => prev.slice(0, -1));
        setInput(message);
        setError(
          data.message ?? "Maya is turned off in Settings → AI Agents.",
        );
        return;
      }

      if (res.status === 429 && data.error === "rate_limited") {
        setTurns((prev) => prev.slice(0, -1));
        setInput(message);
        setError(data.message ?? "Too many messages. Pause a moment and try again.");
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
          data.message || "Could not reach the Maya. Try again.",
        );
      }

      const reply = data.reply?.trim() || "I could not generate a response.";
      setTurns((prev) => [...prev, { role: "assistant", content: reply }]);

      if (data.credits) {
        setCreditBalance(data.credits.balance);
        patchStatus({ credit_balance: data.credits.balance });
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

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  if (statusLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-ink-muted dark:text-cream-400",
          isPanel ? "flex-1" : "min-h-[200px]",
        )}
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!status?.addon_active) {
    return <MayaAssistantGate />;
  }

  if (!status.assistant_enabled) {
    return (
      <div
        className={cn(
          "text-center text-sm text-ink-muted dark:text-cream-400",
          isPanel
            ? "flex flex-1 items-center justify-center p-6"
            : "rounded-2xl border border-[#E5E0D8] bg-white p-6 dark:border-hairline-dark dark:bg-panel-dark",
        )}
      >
        Maya is turned off. Enable it in{" "}
        <a href="/settings/ai-agents" className="font-semibold text-brand-700">
          Settings → AI Agents
        </a>
        .
      </div>
    );
  }

  const displayName = status.display_name || "Maya";
  const chatCost = status.credit_cost_chat ?? HR_CREDIT_COST_CHAT;
  const creditsPaused =
    creditBalance !== null && creditBalance < chatCost;

  const shellClass = isPanel
    ? "flex min-h-0 flex-1 flex-col overflow-hidden"
    : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E5E0D8] bg-white dark:border-hairline-dark dark:bg-panel-dark";

  return (
    <div className={shellClass}>
      {!isPanel ? (
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
      ) : null}

      {creditsPaused ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Shared credits are low — clarifying questions stay free.{" "}
          <Link
            href="/settings/billing"
            className="font-semibold underline hover:text-amber-950 dark:hover:text-amber-50"
          >
            Top up in Billing
          </Link>
          .
        </div>
      ) : null}

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3"
      >
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Ask {displayName} about your Marketing records
            </p>
            <p className="mt-1 max-w-sm text-xs text-ink-muted dark:text-cream-400">
              She uses your CRM, products, and monthly sales — then plans and
              can create drafts.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {MARKETING_ASSISTANT_SUGGESTIONS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
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
                "max-w-[90%] rounded-xl px-3 py-2 text-sm",
                turn.role === "user"
                  ? "ml-auto bg-brand-500 text-white"
                  : "mr-auto border border-[#E5E0D8] bg-[#FFFEFB] text-ink dark:border-hairline-dark dark:bg-surface-dark dark:text-cream-100",
              )}
            >
              {turn.role === "assistant" ? (
                <MayaAssistantMessage content={turn.content} />
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
            Checking your Marketing records…
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="px-3 pb-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-[#E5E0D8] bg-white p-3 dark:border-hairline-dark dark:bg-panel-dark"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={`Message ${displayName}…`}
            maxLength={2000}
            rows={1}
            disabled={loading}
            className="max-h-28 min-h-[40px] flex-1 resize-none rounded-lg border border-[#E5E0D8] bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
});
