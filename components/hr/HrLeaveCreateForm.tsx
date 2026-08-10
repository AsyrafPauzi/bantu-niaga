"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, UserRound } from "lucide-react";
import { HrToast } from "@/components/hr/HrToast";
import type { HrEmployeeRow } from "@/lib/hr/load";
import {
  MC_DOCUMENT_MAX_BYTES,
  MC_DOCUMENT_MAX_SIZE_LABEL,
} from "@/lib/hr/mc-document-shared";
import { LEAVE_TYPES, type LeaveTypeKey } from "@/lib/hr/leave-labels";
import { filterLeaveTypesByEnabled } from "@/lib/hr/leave-type-policy";
import { leaveTypeRequiresDocument } from "@/lib/hr/schemas";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

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
  attachmentRequired,
  enabledLeaveTypes,
}: {
  employees: HrEmployeeRow[];
  redirectTo?: string;
  formId?: string;
  hideSubmit?: boolean;
  defaultEmployeeId?: string;
  attachmentRequired?: Record<string, boolean>;
  enabledLeaveTypes?: LeaveTypeKey[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "err" } | null>(null);
  const typeOptions = useMemo(
    () =>
      filterLeaveTypesByEnabled(
        LEAVE_TYPES,
        enabledLeaveTypes ?? LEAVE_TYPES.map((t) => t.key),
      ),
    [enabledLeaveTypes],
  );
  const [leaveType, setLeaveType] = useState<LeaveTypeKey>(
    () => typeOptions[0]?.key ?? "annual",
  );
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");

  function typeRequiresAttachment(type: LeaveTypeKey): boolean {
    if (attachmentRequired?.[type] !== undefined) return attachmentRequired[type];
    return leaveTypeRequiresDocument(type);
  }

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const selectedLeaveMeta =
    typeOptions.find((t) => t.key === leaveType) ?? typeOptions[0]!;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setToast(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("leave_type", leaveType);

    if (typeRequiresAttachment(leaveType)) {
      const file = formData.get("mc_document");
      if (!(file instanceof File) || file.size <= 0) {
        setToast({ kind: "err", message: "Upload a supporting document (PNG, JPEG, or PDF)." });
        setBusy(false);
        return;
      }
      if (file.size > MC_DOCUMENT_MAX_BYTES) {
        setToast({
          kind: "err",
          message: `File too large (${formatBytes(file.size)}). Max ${MC_DOCUMENT_MAX_SIZE_LABEL}.`,
        });
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
        setToast({
          kind: "err",
          message: json?.message ?? json?.error ?? "Could not record leave.",
        });
        return;
      }
      form.reset();
      setLeaveType("annual");
      setEmployeeId(defaultEmployeeId ?? "");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        setToast({ kind: "ok", message: "Recorded" });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form id={formId} onSubmit={onSubmit} className="space-y-5">
        <input type="hidden" name="leave_type" value={leaveType} />

        <section className="space-y-2">
          <h3 className={hrClasses.sectionTitle}>Leave type</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {typeOptions.map((type) => {
              const Icon = type.icon;
              const active = leaveType === type.key;
              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setLeaveType(type.key)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition",
                    active
                      ? "border-[#0D9488] bg-teal-50 ring-2 ring-[#0D9488]/20 dark:border-teal-700 dark:bg-teal-950/30"
                      : "border-cream-200 bg-white hover:border-teal-200 dark:border-hairline-dark dark:bg-panel-dark",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        active
                          ? "bg-[#0D9488] text-white"
                          : "bg-teal-50 text-[#0D9488] dark:bg-teal-950/50",
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        active
                          ? "bg-[#0D9488] text-white"
                          : "bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
                      )}
                    >
                      {type.short}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink dark:text-cream-100">
                    {type.label}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3 border-t border-cream-200 pt-4 dark:border-hairline-dark">
          <h3 className={hrClasses.sectionTitle}>Employee</h3>
          <label className={hrClasses.label}>
            Team member
            <select
              name="employee_id"
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={hrClasses.input}
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
            <div className="flex items-center gap-3 rounded-lg border border-teal-200/60 bg-teal-50/50 px-3 py-2 dark:border-teal-900/50 dark:bg-teal-950/20">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  hrClasses.avatar,
                )}
              >
                <UserRound className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  {selectedEmployee.full_name}
                </p>
                <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                  {selectedEmployee.role_title}
                  {selectedEmployee.phone_e164 ? ` · ${selectedEmployee.phone_e164}` : ""}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3 border-t border-cream-200 pt-4 dark:border-hairline-dark">
          <h3 className={hrClasses.sectionTitle}>Dates</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={hrClasses.label}>
              Start date
              <input name="start_date" type="date" required className={hrClasses.input} />
            </label>
            <label className={hrClasses.label}>
              End date
              <input name="end_date" type="date" required className={hrClasses.input} />
            </label>
          </div>
        </section>

        <section className="space-y-3 border-t border-cream-200 pt-4 dark:border-hairline-dark">
          <h3 className={hrClasses.sectionTitle}>Reason</h3>
          <label className={hrClasses.label}>
            Notes <span className="font-normal normal-case text-ink-subtle">(optional)</span>
            <textarea
              name="reason"
              maxLength={500}
              rows={3}
              placeholder={`Why ${selectedEmployee?.full_name ?? "they"} need ${selectedLeaveMeta.label.toLowerCase()}?`}
              className={hrClasses.input}
            />
          </label>
        </section>

        {typeRequiresAttachment(leaveType) ? (
          <section className="space-y-2 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-amber-700 dark:text-amber-300" />
              <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
                Supporting document
              </h3>
            </div>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              PNG, JPEG, or PDF · max {MC_DOCUMENT_MAX_SIZE_LABEL}
            </p>
            <input
              name="mc_document"
              type="file"
              required
              accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              className={cn(
                hrClasses.input,
                "file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#0F766E] dark:file:bg-teal-950/50 dark:file:text-teal-200",
              )}
            />
          </section>
        ) : null}

        {!hideSubmit ? (
          <div className="flex flex-wrap gap-2 border-t border-cream-200 pt-4 dark:border-hairline-dark">
            <button
              type="submit"
              disabled={busy || employees.length === 0}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60",
                hrClasses.btnPrimary,
              )}
            >
              {busy ? "Saving…" : `Record ${selectedLeaveMeta.short} leave`}
            </button>
          </div>
        ) : null}
      </form>

      {toast ? (
        <HrToast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />
      ) : null}
    </>
  );
}
