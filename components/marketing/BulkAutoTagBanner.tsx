"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, X } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client-error";

export function BulkAutoTagBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  async function handleRefresh() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/marketing/customers/refresh-auto-tags", {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        updated_count?: number | null;
        error?: { message?: string };
      } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(apiErrorMessage(body, "Could not refresh auto-tags."));
      }
      const count = body.updated_count;
      setMessage(
        count != null
          ? `Done — ${count} customer${count === 1 ? "" : "s"} updated.`
          : "Auto-tags refreshed.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh auto-tags.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            Refresh auto-tags
          </p>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Recompute VIP, repeat, new, at-risk, and dormant tags from your
            latest purchase data.
          </p>
          {message ? (
            <p className="mt-2 text-sm font-medium text-status-success">{message}</p>
          ) : null}
          {error ? (
            <p className="mt-2 text-sm text-status-danger">{error}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-lg p-1 text-ink-muted hover:bg-white/60 dark:text-cream-400"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Run auto-tag refresh
      </button>
    </div>
  );
}
