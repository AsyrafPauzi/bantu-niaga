"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function ContentActions({
  contentId,
  isPosted,
  variant = "default",
}: {
  contentId: string;
  isPosted: boolean;
  variant?: "default" | "hero";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"duplicate" | "post" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHero = variant === "hero";

  async function handleDuplicate() {
    if (busy) return;
    setBusy("duplicate");
    setError(null);
    try {
      const res = await fetch(
        `/api/marketing/content/${contentId}/duplicate`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => null)) as {
        entry_id?: string;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok || !body?.entry_id) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push(`/marketing/content/${body.entry_id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  async function handleMarkPosted() {
    if (busy) return;
    setBusy("post");
    setError(null);
    try {
      const res = await fetch(`/api/marketing/content/${contentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "posted" }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  const btnBase = cn(
    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50",
    isHero
      ? "shadow-sm"
      : "shadow-card",
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={busy !== null}
          className={cn(
            btnBase,
            isHero
              ? "bg-white/15 text-white hover:bg-white/25"
              : "border border-cream-300 bg-white text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
          )}
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          {busy === "duplicate" ? "Duplicating…" : "Duplicate"}
        </button>

        {!isPosted ? (
          <button
            type="button"
            onClick={handleMarkPosted}
            disabled={busy !== null}
            className={cn(
              btnBase,
              isHero
                ? "bg-white text-violet-800 hover:bg-violet-50"
                : "bg-emerald-600 text-white hover:bg-emerald-700",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            {busy === "post" ? "Marking…" : "Mark posted"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className={cn(
            "text-[11px] font-medium",
            isHero ? "text-rose-200" : "text-status-danger",
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
