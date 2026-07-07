"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrEmployeeRow } from "@/lib/hr/load";

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export function HrAppraisalCreateForm({
  employees,
}: {
  employees: HrEmployeeRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeEmployees = employees.filter((e) => e.status === "active");
  const defaultDue = new Date();
  defaultDue.setMonth(defaultDue.getMonth() + 1);
  const defaultDueIso = defaultDue.toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch("/api/hr/appraisals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: String(fd.get("employee_id") ?? ""),
          period_label: String(fd.get("period_label") ?? "").trim(),
          due_date: String(fd.get("due_date") ?? ""),
          notes: String(fd.get("notes") ?? "").trim() || undefined,
        }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setMessage(json.message ?? json.error ?? "Could not schedule appraisal.");
        return;
      }
      form.reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (activeEmployees.length === 0) {
    return (
      <p className="text-sm text-ink-muted dark:text-cream-400">
        Add an active employee before scheduling appraisals.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-ink-muted dark:text-cream-400">
          Employee
        </label>
        <select
          name="employee_id"
          required
          className={`${inputClass} mt-1`}
          defaultValue=""
        >
          <option value="" disabled>
            Select staff member
          </option>
          {activeEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name} · {employee.role_title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-muted dark:text-cream-400">
          Review period
        </label>
        <input
          name="period_label"
          required
          maxLength={80}
          placeholder={`${currentYear} Annual review`}
          defaultValue={`${currentYear} Annual review`}
          className={`${inputClass} mt-1`}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-muted dark:text-cream-400">
          Due date
        </label>
        <input
          type="date"
          name="due_date"
          required
          defaultValue={defaultDueIso}
          className={`${inputClass} mt-1`}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-muted dark:text-cream-400">
          Notes (optional)
        </label>
        <textarea
          name="notes"
          rows={2}
          maxLength={1000}
          placeholder="Goals, probation review, etc."
          className={`${inputClass} mt-1 resize-y`}
        />
      </div>
      {message ? (
        <p className="text-xs text-status-danger">{message}</p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Saving..." : "Schedule appraisal"}
      </button>
    </form>
  );
}
