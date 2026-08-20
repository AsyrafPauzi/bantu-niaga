"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HrLeaveBalanceStrip } from "@/components/hr/HrLeaveBalanceStrip";
import type { BalanceLine, BalanceLineKey } from "@/lib/hr/leave-balance-display";
import { LEAVE_TYPES, type LeaveTypeKey } from "@/lib/hr/leave-labels";
import { filterLeaveTypesByEnabled } from "@/lib/hr/leave-type-policy";
import {
  MC_DOCUMENT_MAX_BYTES,
  MC_DOCUMENT_MAX_SIZE_LABEL,
} from "@/lib/hr/mc-document-shared";
import { leaveTypeRequiresDocument } from "@/lib/hr/schemas";

interface MeLeaveRequestFormProps {
  employeeName: string;
  attachmentRequired?: Record<string, boolean>;
  enabledLeaveTypes?: LeaveTypeKey[];
  balanceLines?: BalanceLine[];
}

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 disabled:cursor-not-allowed disabled:opacity-70 dark:border-cream-300 dark:bg-white dark:text-ink dark:placeholder:text-ink-subtle";

const labelClass =
  "block space-y-1 text-xs font-semibold text-ink-muted dark:text-ink-muted";

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
  balanceLines = [],
}: MeLeaveRequestFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const typeOptions = filterLeaveTypesByEnabled(
    LEAVE_TYPES,
    enabledLeaveTypes ?? LEAVE_TYPES.map((t) => t.key),
  );
  const [leaveType, setLeaveType] = useState(typeOptions[0]?.key ?? "annual");

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
    <form onSubmit={onSubmit} className="space-y-4">
      {balanceLines.length > 0 ? (
        <HrLeaveBalanceStrip
          lines={balanceLines}
          highlightKey={asBalanceKey(leaveType)}
        />
      ) : null}
      <label className={labelClass}>
        Your name
        <input
          value={employeeName}
          readOnly
          className={`${inputClass} bg-cream-100 font-medium dark:bg-cream-100`}
        />
      </label>
      <label className={labelClass}>
        Leave type
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
            <option key={type.key} value={type.key}>{type.label}</option>
          ))}
        </select>
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
        Reason
        <textarea
          name="reason"
          maxLength={500}
          rows={4}
          className={inputClass}
        />
      </label>
      {typeRequiresAttachment(leaveType) ? (
        <label className={labelClass}>
          Supporting document
          <span className="block text-[11px] font-normal leading-relaxed text-ink-subtle">
            PNG, JPEG, or PDF only. Maximum file size: {MC_DOCUMENT_MAX_SIZE_LABEL}.
          </span>
          <input
            name="mc_document"
            type="file"
            required
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700`}
          />
        </label>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-ink-muted dark:bg-brand-50 dark:text-ink-muted">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Submitting..." : "Submit leave request"}
      </button>
    </form>
  );
}
