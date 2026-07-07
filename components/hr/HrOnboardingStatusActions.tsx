"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HrOnboardingStatusActions({
  itemId,
  isDone,
  onUpdated,
}: {
  itemId: string;
  isDone: boolean;
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function updateStatus(nextDone: boolean) {
    setBusy(true);
    try {
      await fetch(`/api/hr/onboarding/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done: nextDone }),
      });
      router.refresh();
      onUpdated?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => updateStatus(!isDone)}
      className="rounded-md border border-cream-300 px-2 py-1 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-60 dark:border-hairline-dark dark:text-cream-400"
    >
      {isDone ? "Reopen" : "Mark done"}
    </button>
  );
}
