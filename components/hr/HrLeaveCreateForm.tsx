"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrEmployeeRow } from "@/lib/hr/load";

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export function HrLeaveCreateForm({
  employees,
}: {
  employees: HrEmployeeRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/hr/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not record leave.");
        return;
      }
      form.reset();
      setMessage("Leave recorded.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Employee
          <select name="employee_id" required className={inputClass}>
            <option value="">Choose employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Leave type
          <select name="leave_type" required className={inputClass}>
            <option value="annual">Annual leave</option>
            <option value="emergency">Emergency leave</option>
            <option value="mc">MC</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Start date
          <input name="start_date" type="date" required className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          End date
          <input name="end_date" type="date" required className={inputClass} />
        </label>
      </div>
      <label className="block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
        Reason
        <textarea name="reason" maxLength={500} rows={3} className={inputClass} />
      </label>
      {message ? (
        <p className="text-xs text-ink-muted dark:text-cream-400">{message}</p>
      ) : null}
      <button
        type="submit"
        disabled={busy || employees.length === 0}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Recording..." : "Record leave"}
      </button>
    </form>
  );
}
