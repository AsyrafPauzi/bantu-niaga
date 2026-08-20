"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HrLeaveDecisionSheet } from "@/components/hr/HrLeaveDecisionSheet";
import { leaveTypeLabel } from "@/lib/hr/leave-labels";
import type { LeaveDecisionStatus } from "@/lib/hr/leave-status-messages";

export function HrLeaveStatusActions({
  leaveId,
  employeeName,
  leaveType,
  startDate,
  endDate,
  phoneE164,
  preferredLocale = "en",
}: {
  leaveId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  phoneE164: string | null;
  preferredLocale?: "en" | "ms";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{
    status: LeaveDecisionStatus;
    reason: string | null;
  } | null>(null);

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
        setSheet({
          status,
          reason:
            typeof json?.leave?.decision_note === "string"
              ? json.leave.decision_note
              : null,
        });
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {warning ? (
        <p className="max-w-xs text-right text-[11px] text-status-warning">
          {warning}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void update("approved")}
          disabled={busy !== null}
          className="rounded-md bg-status-success px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy === "approved" ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => void update("rejected")}
          disabled={busy !== null}
          className="rounded-md border border-cream-300 px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-60 dark:border-hairline-dark dark:text-cream-400 dark:hover:text-cream-100"
        >
          {busy === "rejected" ? "Rejecting..." : "Reject"}
        </button>
      </div>

      {sheet ? (
        <HrLeaveDecisionSheet
          open
          onClose={() => setSheet(null)}
          status={sheet.status}
          employeeName={employeeName}
          leaveTypeLabel={leaveTypeLabel(leaveType)}
          startDate={startDate}
          endDate={endDate}
          reason={sheet.reason}
          phoneE164={phoneE164}
          preferredLocale={preferredLocale}
        />
      ) : null}
    </div>
  );
}
