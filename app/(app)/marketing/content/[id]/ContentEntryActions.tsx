"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ContentStatus } from "@/components/marketing/types";

/**
 * Action strip on the entry detail page:
 *
 *   - Quick status transition buttons (only the legal nexts are shown).
 *   - Delete (irreversible — no soft-delete on content_plan per plan §4).
 *
 * Runs as a client component so the PATCH/DELETE calls + router refresh
 * can happen without a full reload. The submit form on the same page
 * handles edit-field saves; this strip just covers the high-frequency
 * "tap to move it along" path.
 */

const ALL_STATUSES: ContentStatus[] = [
  "idea",
  "drafted",
  "scheduled",
  "posted",
];

const STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Idea",
  drafted: "Drafted",
  scheduled: "Scheduled",
  posted: "Posted",
};

function nextStatuses(current: ContentStatus): ContentStatus[] {
  if (current === "posted") return [];
  return ALL_STATUSES.filter((s) => s !== current);
}

interface ContentEntryActionsProps {
  entryId: string;
  currentStatus: ContentStatus;
}

export function ContentEntryActions({
  entryId,
  currentStatus,
}: ContentEntryActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function moveTo(next: ContentStatus): Promise<void> {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/marketing/content/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setErr(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (busy) return;
    const ok = window.confirm(
      "Delete this content entry? This cannot be undone (no soft-delete in v1).",
    );
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/marketing/content/${entryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        setErr(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push("/marketing/content");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const nexts = nextStatuses(currentStatus);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {nexts.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={s === "posted" ? "primary" : "secondary"}
            onClick={() => moveTo(s)}
            disabled={busy}
            type="button"
          >
            Move to {STATUS_LABEL[s]}
          </Button>
        ))}
        {nexts.length === 0 && (
          <span className="text-xs text-ink-muted dark:text-cream-400">
            Posted entries are terminal in v1.
          </span>
        )}
        <Button
          size="sm"
          variant="danger"
          onClick={handleDelete}
          disabled={busy}
          type="button"
        >
          Delete
        </Button>
      </div>
      {err && (
        <p
          role="alert"
          className="rounded-md bg-[#F8DDD9] px-3 py-1 text-xs text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]"
        >
          {err}
        </p>
      )}
    </div>
  );
}
