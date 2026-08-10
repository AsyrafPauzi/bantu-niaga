"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrEmployeeRow } from "@/lib/hr/load";
import { HrToast } from "@/components/hr/HrToast";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

export function HrAttendanceClockInForm({
  employees,
}: {
  employees: HrEmployeeRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "err" } | null>(
    null,
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const employee_id = String(formData.get("employee_id") ?? "");
    const notes = String(formData.get("notes") ?? "").trim();

    try {
      const res = await fetch("/api/hr/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id,
          notes: notes || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          kind: "err",
          message:
            typeof body.message === "string"
              ? body.message
              : "Could not clock in employee.",
        });
        return;
      }
      setToast({ kind: "ok", message: "Clocked in." });
      form.reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {toast ? (
        <HrToast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />
      ) : null}
      <div>
        <label
          htmlFor="attendance-employee"
          className="mb-1 block text-xs font-semibold text-ink-muted dark:text-cream-400"
        >
          Employee
        </label>
        <select
          id="attendance-employee"
          name="employee_id"
          required
          className={cn("w-full rounded-lg border px-3 py-2 text-sm", hrClasses.input)}
        >
          <option value="">Select employee</option>
          {employees
            .filter((e) => e.status === "active")
            .map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} · {emp.role_title}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="attendance-notes"
          className="mb-1 block text-xs font-semibold text-ink-muted dark:text-cream-400"
        >
          Notes (optional)
        </label>
        <input
          id="attendance-notes"
          name="notes"
          type="text"
          maxLength={500}
          className={cn("w-full rounded-lg border px-3 py-2 text-sm", hrClasses.input)}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className={cn(
          "w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50",
          hrClasses.btnPrimary,
        )}
      >
        {busy ? "Clocking in…" : "Clock in"}
      </button>
    </form>
  );
}
