"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw, Loader2 } from "lucide-react";

export function InsightsRefreshButton({
  publishId,
}: {
  publishId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (pending) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/social/meta/insights/${publishId}`,
          { method: "GET" },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
          return;
        }
        router.refresh();
      } catch (e) {
        setError((e as Error).message ?? "Network error");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-cream-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        title="Pull fresh metrics from Meta"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
        ) : (
          <RefreshCw className="h-3 w-3" strokeWidth={2} />
        )}
        {pending ? "Refreshing…" : "Refresh"}
      </button>
      {error && (
        <p
          role="alert"
          className="mt-1 text-[10px] text-status-danger"
          title={error}
        >
          {error.length > 80 ? `${error.slice(0, 80)}…` : error}
        </p>
      )}
    </>
  );
}
