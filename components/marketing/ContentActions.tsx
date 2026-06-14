"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";

/**
 * Two header-row actions for the Content Detail page:
 *   - Duplicate  → POST /api/marketing/content/[id]/duplicate, redirects
 *                  to the new entry's edit page.
 *   - Mark as Posted → PATCH /api/marketing/content/[id] with
 *                      status='posted'. Hidden when already posted.
 */
export function ContentActions({
  contentId,
  isPosted,
}: {
  contentId: string;
  isPosted: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"duplicate" | "post" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        action?: string;
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
        action?: string;
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleDuplicate}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
      >
        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
        {busy === "duplicate" ? "Duplicating…" : "Duplicate"}
      </button>

      {!isPosted ? (
        <button
          type="button"
          onClick={handleMarkPosted}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-status-success px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-status-success/90 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
          {busy === "post" ? "Marking…" : "Mark as Posted"}
        </button>
      ) : null}

      {error ? (
        <span
          role="alert"
          className="text-[11px] font-medium text-status-danger"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
