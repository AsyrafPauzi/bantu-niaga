"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, UserRound } from "lucide-react";
import type { HrEmployeeRow } from "@/lib/hr/load";
import {
  MC_DOCUMENT_MAX_BYTES,
  MC_DOCUMENT_MAX_SIZE_LABEL,
} from "@/lib/hr/mc-document-shared";
import { LEAVE_TYPES, type LeaveTypeKey } from "@/lib/hr/leave-labels";
import { cn } from "@/lib/utils/cn";

const inputClass =
  "w-full rounded-xl border border-[#E5E0D8] bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

const labelClass =
  "block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HrLeaveCreateForm({
  employees,
  redirectTo,
  formId = "hr-leave-create",
  hideSubmit,
  defaultEmployeeId,
}: {
  employees: HrEmployeeRow[];
  redirectTo?: string;
  formId?: string;
  hideSubmit?: boolean;
  defaultEmployeeId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [leaveType, setLeaveType] = useState<LeaveTypeKey>("annual");
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const selectedLeaveMeta = LEAVE_TYPES.find((t) => t.key === leaveType)!;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("leave_type", leaveType);

    if (leaveType === "mc") {
      const file = formData.get("mc_document");
      if (!(file instanceof File) || file.size <= 0) {
        setMessage("Please upload the MC document (PNG, JPEG, or PDF).");
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
      const res = await fetch("/api/hr/leave", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not record leave.");
        return;
      }
      form.reset();
      setLeaveType("annual");
      setEmployeeId(defaultEmployeeId ?? "");
      setMessage("Leave recorded.");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="leave_type" value={leaveType} />

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-ink dark:text-cream-100">
            Leave type
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            Choose the category that best matches this time off.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {LEAVE_TYPES.map((type) => {
            const Icon = type.icon;
            const active = leaveType === type.key;
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => setLeaveType(type.key)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  active
                    ? "border-brand-500 bg-[#EEF3FE] shadow-sm ring-2 ring-brand-400/30 dark:border-brand-400 dark:bg-brand-900/30"
                    : "border-[#E5E0D8] bg-white hover:border-brand-300 dark:border-hairline-dark dark:bg-panel-dark",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      active
                        ? "bg-brand-500 text-white"
                        : "bg-cream-100 text-brand-700 dark:bg-hairline-dark dark:text-brand-200",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      active
                        ? "bg-brand-500 text-white"
                        : "bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
                    )}
                  >
                    {type.short}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-ink dark:text-cream-100">
                  {type.label}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted dark:text-cream-400">
                  {type.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[#E5E0D8] bg-[#FAF7F2] p-4 dark:border-hairline-dark dark:bg-hairline-dark/20">
        <div>
          <h3 className="text-sm font-bold text-ink dark:text-cream-100">
            Who is taking leave?
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            Select the team member this record is for.
          </p>
        </div>
        <label className={labelClass}>
          Employee
          <select
            name="employee_id"
            required
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className={inputClass}
          >
            <option value="">Choose employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name} · {employee.role_title}
              </option>
            ))}
          </select>
        </label>
        {selectedEmployee ? (
          <div className="flex items-center gap-3 rounded-lg border border-[#D5E2FB] bg-white px-3 py-2.5 dark:border-brand-900/50 dark:bg-panel-dark">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <UserRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                {selectedEmployee.full_name}
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {selectedEmployee.role_title}
                {selectedEmployee.phone_e164
                  ? ` · ${selectedEmployee.phone_e164}`
                  : ""}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-ink dark:text-cream-100">
            Dates
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            Single-day leave uses the same start and end date.
          </p>
        </div>
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
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-ink dark:text-cream-100">
            Reason & notes
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            Helps you approve faster later — staff see this on pending requests.
          </p>
        </div>
        <label className={labelClass}>
          Reason
          <textarea
            name="reason"
            maxLength={500}
            rows={4}
            placeholder={`Why is ${selectedEmployee?.full_name ?? "this employee"} taking ${selectedLeaveMeta.label.toLowerCase()}?`}
            className={inputClass}
          />
        </label>
      </section>

      {leaveType === "mc" ? (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              <FileUp className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink dark:text-cream-100">
                MC document
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                Upload the medical certificate or doctor&apos;s note. PNG, JPEG, or
                PDF only. Maximum file size: {MC_DOCUMENT_MAX_SIZE_LABEL}.
              </p>
            </div>
          </div>
          <input
            name="mc_document"
            type="file"
            required
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700 dark:file:bg-panel-dark`}
          />
        </section>
      ) : null}

      {message ? (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            message.includes("recorded")
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200",
          )}
        >
          {message}
        </p>
      ) : null}

      {!hideSubmit ? (
        <button
          type="submit"
          disabled={busy || employees.length === 0}
          className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-600 disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Recording..." : `Record ${selectedLeaveMeta.short} leave`}
        </button>
      ) : null}
    </form>
  );
}
