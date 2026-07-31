"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";

interface SegmentListQuickActionsProps {
  segmentId: string;
  segmentName: string;
}

export function SegmentListQuickActions({
  segmentId,
  segmentName,
}: SegmentListQuickActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function remove() {
    const ok = confirm(
      `Remove segment "${segmentName}"?\n\nIt will be hidden from broadcasts and segment lists.`,
    );
    if (!ok) return;

    setError(null);
    try {
      const res = await fetch(`/api/marketing/segments/${segmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string; error?: string; reason?: string }
          | null;
        setError(
          body?.reason ??
            body?.message ??
            body?.error ??
            `Could not remove (HTTP ${res.status})`,
        );
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/marketing/segments/${segmentId}?edit=1`}
          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
          Edit
        </Link>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
        >
          <Trash2 className="h-3 w-3" strokeWidth={2} />
          {pending ? "Removing…" : "Remove"}
        </button>
      </div>
      {error ? (
        <p className="text-[11px] text-rose-700 dark:text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}
