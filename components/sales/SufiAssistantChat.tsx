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
import { SALES_ASSISTANT_SUGGESTIONS } from "@/lib/ai/sales-assistant-prompt";
import type {
  PillarAssistantChatHandle,
  PillarAssistantChatTurn,
  PillarAssistantChatVariant,
  PillarAssistantStatus,
} from "@/lib/ai/pillar-assistant-types";
import { SufiAssistantGate } from "@/components/sales/SufiAssistantGate";
import { SufiAssistantMessage } from "@/components/sales/SufiAssistantMessage";
import { HR_CREDIT_COST_CHAT } from "@/lib/marketplace/agent-types";
import { cn } from "@/lib/utils/cn";

const MAX_MESSAGES = 20;

function storageKey(businessId: string): string {
  return `bn-sufi-assistant-chat-v1-${businessId}`;
}

export type SufiAssistantStatus = PillarAssistantStatus;
export type SufiAssistantChatHandle = PillarAssistantChatHandle;

interface SufiAssistantChatProps {
  businessId: string;
  initialStatus?: PillarAssistantStatus | null;
  /** Pre-fill the message box (e.g. from a contextual CTA). */
  initialSeed?: string;
  variant?: PillarAssistantChatVariant;
  onStatusChange?: (status: PillarAssistantStatus) => void;
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

export const SufiAssistantChat = forwardRef<
  SufiAssistantChatHandle,
  SufiAssistantChatProps
>(function SufiAssistantChat(
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
  const [status, setStatus] = useState<PillarAssistantStatus | null>(
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
    (patch: Partial<PillarAssistantStatus>) => {
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
      const res = await fetch("/api/sales/assistant");
      const json = (await res.json()) as PillarAssistantStatus & {
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
    void fetch("/api/sales/assistant", { method: "DELETE" }).catch(
      () => undefined,
    );
  }, [businessId]);

  useImperativeHandle(ref, () => ({ newChat }), [newChat]);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    // Low balance: still allow send — clarifying questions are free on the server.
    setError(null);
    setLoading(true);
    setInput("");

    const userTurn: PillarAssistantChatTurn = { role: "user", content: message };
    setTurns((prev) => [...prev, userTurn]);

    try {
      const res = await fetch("/api/sales/assistant", {
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

      if (res.status === 429 && data.error === "daily_budget_exceeded") {
        setTurns((prev) => prev.slice(0, -1));
        setInput(message);
        setError(data.message ?? "Daily budget reached for this agent.");
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || "Could not reach Sufi. Try again.");
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
    return <SufiAssistantGate />;
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
        Sufi is turned off. Enable it in{" "}
        <a href="/settings/ai-agents" className="font-semibold text-[#2563EB]">
          Settings → AI Agents
        </a>
        .
      </div>
    );
  }

  const displayName = status.display_name || "Sufi";
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
            <Sparkles className="h-4 w-4 text-[#2563EB]" />
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
        <div
          className={cn(
            "shrink-0 border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100",
            isPanel ? "px-4 py-2.5 text-xs" : "px-4 py-3 text-sm",
          )}
        >
          Shared credits are low — clarifying questions stay free. Plans and
          actions need credits.{" "}
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
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          isPanel ? "space-y-3 p-3" : "space-y-4 p-4 sm:p-5",
        )}
      >
        {turns.length === 0 ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center text-center",
              isPanel ? "py-6" : "py-8",
            )}
          >
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Ask {displayName} about your Sales records
            </p>
            <p className="mt-1 max-w-sm text-xs text-ink-muted dark:text-cream-400">
              Ask like you would a sales colleague — leads, follow-ups, and
              today&apos;s POS. Clarifying questions are free; plans and
              actions use credits.
            </p>
            <div className={cn("flex flex-wrap justify-center gap-2", isPanel ? "mt-4" : "mt-5")}>
              {SALES_ASSISTANT_SUGGESTIONS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-[#E5E0D8] bg-[#FFFEFB] px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-blue-300 hover:text-[#2563EB] disabled:opacity-50 dark:border-hairline-dark dark:bg-surface-dark dark:text-cream-400"
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
                "text-sm",
                isPanel
                  ? "max-w-[90%] rounded-xl px-3 py-2"
                  : "max-w-[min(90%,42rem)] rounded-2xl px-4 py-3",
                turn.role === "user"
                  ? "ml-auto bg-[#2563EB] text-white"
                  : "mr-auto border border-[#E5E0D8] bg-[#FFFEFB] text-ink dark:border-hairline-dark dark:bg-surface-dark dark:text-cream-100",
              )}
            >
              {turn.role === "assistant" ? (
                <SufiAssistantMessage content={turn.content} />
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
            Checking your Sales records…
          </div>
        ) : null}
      </div>

      {error ? (
        <p
          className={cn(
            "text-xs text-red-600 dark:text-red-400",
            isPanel ? "px-3 pb-1" : "px-4 pb-2",
          )}
        >
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className={cn(
          "shrink-0 border-t border-[#E5E0D8] bg-white dark:border-hairline-dark dark:bg-panel-dark",
          isPanel ? "p-3" : "p-4",
        )}
      >
        <div className={cn("flex gap-2", isPanel ? "items-end" : "items-center")}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${displayName}…`}
            maxLength={2000}
            disabled={loading}
            className={cn(
              "flex-1 border border-[#E5E0D8] bg-white text-sm text-ink placeholder:text-ink-subtle focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
              isPanel ? "rounded-lg px-3 py-2" : "rounded-xl px-3.5 py-2.5",
            )}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={cn(
              "inline-flex shrink-0 items-center justify-center bg-[#2563EB] text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50",
              isPanel
                ? "h-10 w-10 rounded-lg"
                : "rounded-xl px-4 py-2.5 text-sm font-semibold",
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
        {!isPanel ? (
          <p className="mt-2 text-[11px] text-ink-muted dark:text-cream-500">
            Clarifying questions are free. Plans and actions use credits. Not
            sales or legal advice.
          </p>
        ) : null}
      </form>
    </div>
  );
});
