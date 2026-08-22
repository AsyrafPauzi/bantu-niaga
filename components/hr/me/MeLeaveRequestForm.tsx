"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { BalanceLine, BalanceLineKey } from "@/lib/hr/leave-balance-display";
import { LEAVE_TYPES, type LeaveTypeKey } from "@/lib/hr/leave-labels";
import { filterLeaveTypesByEnabled } from "@/lib/hr/leave-type-policy";
import {
  MC_DOCUMENT_MAX_BYTES,
  MC_DOCUMENT_MAX_SIZE_LABEL,
} from "@/lib/hr/mc-document-shared";
import { leaveTypeRequiresDocument } from "@/lib/hr/schemas";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

interface MeLeaveRequestFormProps {
  employeeName: string;
  attachmentRequired?: Record<string, boolean>;
  enabledLeaveTypes?: LeaveTypeKey[];
  /** Types with a configured day quota (unpaid is always allowed when enabled). */
  selectableLeaveTypes?: LeaveTypeKey[];
  balanceLines?: BalanceLine[];
}

const inputClass =
  "w-full rounded-xl border border-cream-300 bg-white px-3.5 py-3 text-base text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-teal-500 focus:ring-2 focus:ring-teal-400/30 disabled:cursor-not-allowed disabled:opacity-70 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 sm:py-2.5 sm:text-sm";

const labelClass =
  "block space-y-1.5 text-sm font-semibold text-ink dark:text-cream-100";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function asBalanceKey(type: string): BalanceLineKey | undefined {
  if (
    type === "annual" ||
    type === "mc" ||
    type === "emergency" ||
    type === "hospitalisation"
  ) {
    return type;
  }
  return undefined;
}

export function MeLeaveRequestForm({
  employeeName,
  attachmentRequired,
  enabledLeaveTypes,
  selectableLeaveTypes,
  balanceLines = [],
}: MeLeaveRequestFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const enabledOptions = filterLeaveTypesByEnabled(
    LEAVE_TYPES,
    enabledLeaveTypes ?? LEAVE_TYPES.map((t) => t.key),
  );
  const selectableSet = selectableLeaveTypes
    ? new Set(selectableLeaveTypes)
    : null;
  const typeOptions = selectableSet
    ? enabledOptions.filter((t) => selectableSet.has(t.key))
    : enabledOptions;
  const [leaveType, setLeaveType] = useState(typeOptions[0]?.key ?? "annual");

  const activeBalance = balanceLines.find(
    (l) => l.key === asBalanceKey(leaveType) && l.entitlement != null,
  );

  function typeRequiresAttachment(type: string): boolean {
    if (attachmentRequired?.[type] !== undefined) return attachmentRequired[type];
    return leaveTypeRequiresDocument(type);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage(null);

    const formData = new FormData(form);

    if (typeRequiresAttachment(leaveType)) {
      const file = formData.get("mc_document");
      if (!(file instanceof File) || file.size <= 0) {
        setMessage("Please upload a supporting document (PNG, JPEG, or PDF).");
        setBusy(false);
        return;
      }
      if (file.size > MC_DOCUMENT_MAX_BYTES) {
        setMessage(
          `File too large (${formatBytes(file.size)}). Maximum file size is ${MC_DOCUMENT_MAX_SIZE_LABEL}.`,
        );
        setBusy(false);
        return;
      }
    } else {
      formData.delete("mc_document");
    }

    try {
      const res = await fetch("/api/hr/me/leave", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not submit leave request.");
        return;
      }
      const leaveId = json?.leave?.id;
      if (leaveId) {
        router.push(`/hr/me/leave/${leaveId}`);
        router.refresh();
        return;
      }
      router.push("/hr/me");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-cream-200 bg-white p-4 sm:p-5 dark:border-hairline-dark dark:bg-panel-dark"
    >
      {activeBalance ? (
        <div className="rounded-xl border border-teal-200/80 bg-teal-50/70 px-3.5 py-3 dark:border-teal-900 dark:bg-teal-950/30">
          <p className="text-xs font-semibold text-ink-muted dark:text-cream-400">
            {activeBalance.label}
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
            {activeBalance.remaining} days left
            <span className="text-sm font-semibold text-ink-muted">
              {" "}
              of {activeBalance.entitlement}
            </span>
          </p>
        </div>
      ) : null}

      <label className={labelClass}>
        Your name
        <input
          value={employeeName}
          readOnly
          className={cn(inputClass, "bg-cream-50 dark:bg-hairline-dark/40")}
        />
      </label>

      <label className={labelClass}>
        Leave type
        {typeOptions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-cream-300 px-3 py-3 text-sm font-normal text-ink-muted dark:border-hairline-dark">
            No leave types are available. Ask HR to set your leave quotas.
          </p>
        ) : (
          <select
            name="leave_type"
            required
            value={leaveType}
            onChange={(event) =>
              setLeaveType(event.target.value as LeaveTypeKey)
            }
            className={inputClass}
          >
            {typeOptions.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Start date
          <input name="start_date" type="date" required className={inputClass} />
        </label>
        <label className={labelClass}>
          End date
          <input name="end_date" type="date" required className={inputClass} />
        </label>
      </div>

      <label className={labelClass}>
        Reason{" "}
        <span className="font-normal text-ink-muted">(optional)</span>
        <textarea
          name="reason"
          maxLength={500}
          rows={3}
          placeholder="e.g. Family event, medical appointment…"
          className={inputClass}
        />
      </label>

      {typeRequiresAttachment(leaveType) ? (
        <label className={labelClass}>
          Supporting document
          <span className="block text-xs font-normal leading-relaxed text-ink-muted">
            PNG, JPEG, or PDF. Max {MC_DOCUMENT_MAX_SIZE_LABEL}.
          </span>
          <input
            name="mc_document"
            type="file"
            required
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            className={cn(
              inputClass,
              "file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#0F766E]",
            )}
          />
        </label>
      ) : null}

      {message ? (
        <p
          role="alert"
          className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger"
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || typeOptions.length === 0}
        className={cn(
          "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-semibold disabled:opacity-60 sm:text-sm",
          hrClasses.btnPrimary,
        )}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {busy ? "Submitting…" : "Submit leave request"}
      </button>
    </form>
  );
}
