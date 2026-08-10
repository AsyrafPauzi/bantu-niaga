"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { HrLeaveRow } from "@/lib/hr/load";
import { LEAVE_TYPES, type LeaveTypeKey } from "@/lib/hr/leave-labels";
import { filterLeaveTypesByEnabled } from "@/lib/hr/leave-type-policy";
import {
  MC_DOCUMENT_MAX_BYTES,
  MC_DOCUMENT_MAX_SIZE_LABEL,
} from "@/lib/hr/mc-document-shared";
import { leaveTypeRequiresDocument } from "@/lib/hr/schemas";
import { hrClasses } from "@/lib/hr/theme";

export function HrLeaveManageActions({
  row,
  enabledLeaveTypes,
  attachmentRequired,
}: {
  row: HrLeaveRow;
  enabledLeaveTypes?: LeaveTypeKey[];
  attachmentRequired?: Record<string, boolean>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveType, setLeaveType] = useState(row.leave_type);
  const [startDate, setStartDate] = useState(row.start_date);
  const [endDate, setEndDate] = useState(row.end_date);
  const [reason, setReason] = useState(row.reason ?? "");
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const typeOptions = filterLeaveTypesByEnabled(
    LEAVE_TYPES,
    enabledLeaveTypes ?? LEAVE_TYPES.map((t) => t.key),
  );

  function typeRequiresAttachment(type: string): boolean {
    if (attachmentRequired?.[type] !== undefined) return attachmentRequired[type];
    return leaveTypeRequiresDocument(type);
  }

  async function saveEdit() {
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (documentFile) {
        if (documentFile.size > MC_DOCUMENT_MAX_BYTES) {
          throw new Error(
            `File too large. Max ${MC_DOCUMENT_MAX_SIZE_LABEL}.`,
          );
        }
        const formData = new FormData();
        formData.set("leave_type", leaveType);
        formData.set("start_date", startDate);
        formData.set("end_date", endDate);
        formData.set("reason", reason.trim());
        formData.set("mc_document", documentFile);
        res = await fetch(`/api/hr/leave/${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          body: formData,
        });
      } else {
        res = await fetch(`/api/hr/leave/${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            reason: reason.trim() || null,
          }),
        });
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message ?? json?.error ?? "Could not update leave.");
      }
      setEditing(false);
      setDocumentFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update leave.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLeave() {
    if (
      !window.confirm(
        "Delete this leave record? Approved annual leave will be restored to the balance.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/hr/leave/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message ?? json?.error ?? "Could not delete leave.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete leave.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-3 space-y-2 rounded-lg border border-cream-200 p-3 dark:border-hairline-dark">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="font-semibold text-ink-muted">Type</span>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveTypeKey)}
              className={hrClasses.input + " mt-1"}
            >
              {typeOptions.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-ink-muted">Start</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={hrClasses.input + " mt-1"}
            />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-ink-muted">End</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={hrClasses.input + " mt-1"}
            />
          </label>
        </div>
        <label className="block text-xs">
          <span className="font-semibold text-ink-muted">Reason</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className={hrClasses.input + " mt-1"}
          />
        </label>
        {typeRequiresAttachment(leaveType) ? (
          <label className="block text-xs">
            <span className="font-semibold text-ink-muted">
              Supporting document{" "}
              <span className="font-normal">(optional replace)</span>
            </span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
              className={hrClasses.input + " mt-1"}
            />
            <span className="mt-1 block text-[10px] text-ink-muted">
              PNG, JPEG, or PDF · max {MC_DOCUMENT_MAX_SIZE_LABEL}
              {row.mc_document_name
                ? ` · current: ${row.mc_document_name}`
                : ""}
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveEdit()}
            className="rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setDocumentFile(null);
            }}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          >
            Cancel
          </button>
        </div>
        {error ? <p className="text-xs text-status-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-ink-muted hover:border-brand-300 dark:border-hairline-dark"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void deleteLeave()}
        className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
      {error ? <p className="text-xs text-status-danger">{error}</p> : null}
    </div>
  );
}
