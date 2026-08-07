"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MessageSquarePlus,
  PauseCircle,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { MOBILE_FLOAT_ABOVE_NAV } from "@/lib/navigation/mobile-chrome";
import type {
  PillarAssistantChatHandle,
  PillarAssistantStatus,
} from "@/lib/ai/pillar-assistant-types";
import type { PillarAssistantFloatMeta } from "@/lib/ai/pillar-assistant-float-meta";
import { HR_CREDIT_COST_CHAT } from "@/lib/marketplace/agent-types";
import { cn } from "@/lib/utils/cn";

export function PillarAssistantPanel(props: {
  config: PillarAssistantFloatMeta;
  businessId: string;
  initialStatus: PillarAssistantStatus;
  gate: ReactNode;
  children: (ctx: {
    chatRef: React.RefObject<PillarAssistantChatHandle | null>;
    seed?: string;
    onStatusChange: (status: PillarAssistantStatus) => void;
  }) => ReactNode;
  fabClassName: string;
}) {
  return (
    <Suspense fallback={null}>
      <PillarAssistantPanelInner {...props} />
    </Suspense>
  );
}

function PillarAssistantPanelInner({
  config,
  businessId,
  initialStatus,
  gate,
  children,
  fabClassName,
}: {
  config: PillarAssistantFloatMeta;
  businessId: string;
  initialStatus: PillarAssistantStatus;
  gate: ReactNode;
  children: (ctx: {
    chatRef: React.RefObject<PillarAssistantChatHandle | null>;
    seed?: string;
    onStatusChange: (status: PillarAssistantStatus) => void;
  }) => ReactNode;
  fabClassName: string;
}) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<string | undefined>();
  const [status, setStatus] = useState(initialStatus);
  const [creditBalance, setCreditBalance] = useState<number | null>(
    initialStatus.credit_balance ?? null,
  );
  const chatRef = useRef<PillarAssistantChatHandle>(null);

  useEffect(() => {
    if (searchParams.get(config.queryParam) === "open") {
      setOpen(true);
      const urlSeed =
        searchParams.get("seed")?.trim() ??
        searchParams.get("q")?.trim();
      if (urlSeed) {
        setSeed(urlSeed.slice(0, 2000));
      }
    }
  }, [searchParams, config.queryParam]);

  const displayName = status.display_name || config.defaultName;
  const chatCost = status.credit_cost_chat ?? HR_CREDIT_COST_CHAT;
  const creditsPaused =
    creditBalance !== null && creditBalance < chatCost;

  const onStatusChange = (next: PillarAssistantStatus) => {
    setStatus(next);
    if (typeof next.credit_balance === "number") {
      setCreditBalance(next.credit_balance);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-6 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg",
          MOBILE_FLOAT_ABOVE_NAV,
          fabClassName,
        )}
      >
        <Sparkles className="h-4 w-4" />
        Ask {displayName}
      </button>
    );
  }

  return (
    <div className={cn("fixed right-6 z-40 flex h-[min(520px,80vh)] w-[min(400px,92vw)] flex-col overflow-hidden rounded-2xl border border-cream-300 bg-white shadow-2xl dark:border-hairline-dark dark:bg-panel-dark", MOBILE_FLOAT_ABOVE_NAV)}>
      <header className="flex items-center justify-between border-b border-cream-300 bg-cream-50 px-4 py-3 dark:border-hairline-dark dark:bg-surface-dark">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink dark:text-cream-100">
            <Sparkles className="h-4 w-4 shrink-0 text-brand-600" />
            {displayName}
          </p>
          <p className="truncate text-[11px] text-ink-muted dark:text-cream-400">
            {config.roleTitle}
            {creditBalance !== null ? (
              <span
                className={cn(
                  "ml-1",
                  creditsPaused
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-ink-muted",
                )}
              >
                ·{" "}
                {creditsPaused ? (
                  <>
                    <PauseCircle className="mr-0.5 inline h-3 w-3" />
                    paused
                  </>
                ) : (
                  <>⚡ {creditBalance} credits</>
                )}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {status.addon_active && status.assistant_enabled ? (
            <button
              type="button"
              onClick={() => chatRef.current?.newChat()}
              className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-cream-200 dark:hover:bg-hairline-dark"
              aria-label="New chat"
              title="New chat"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
          ) : null}
          <Link
            href="/settings/ai-agents"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-cream-200 dark:hover:bg-hairline-dark"
            aria-label={`Configure ${displayName}`}
          >
            <Settings2 className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-cream-200 dark:hover:bg-hairline-dark"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {!status.addon_active ? (
          <div className="flex flex-1 flex-col justify-center p-4">{gate}</div>
        ) : !status.assistant_enabled ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ink-muted dark:text-cream-400">
            {displayName} is turned off. Enable in{" "}
            <Link
              href="/settings/ai-agents"
              className="font-semibold text-brand-700"
            >
              Settings → AI Agents
            </Link>
            .
          </div>
        ) : (
          children({ chatRef, seed, onStatusChange })
        )}
      </div>
    </div>
  );
}
