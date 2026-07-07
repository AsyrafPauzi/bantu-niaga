"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HrLeaveStatusActions({ leaveId }: { leaveId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function update(status: "approved" | "rejected") {
    setBusy(status);
    setWarning(null);
    try {
      const res = await fetch(`/api/hr/leave/${leaveId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        if (json?.warning?.message) {
          setWarning(json.warning.message);
        }
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {warning ? (
        <p className="max-w-xs text-right text-[11px] text-status-warning">{warning}</p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => update("approved")}
          disabled={busy !== null}
          className="rounded-md bg-status-success px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy === "approved" ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => update("rejected")}
          disabled={busy !== null}
          className="rounded-md border border-cream-300 px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-60 dark:border-hairline-dark dark:text-cream-400 dark:hover:text-cream-100"
        >
          {busy === "rejected" ? "Rejecting..." : "Reject"}
        </button>
      </div>
    </div>
  );
}
