"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrEmployeeRow } from "@/lib/hr/load";

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export function HrPayslipGenerateForm({
  employees,
}: {
  employees: HrEmployeeRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeEmployees = employees.filter((e) => e.status === "active");
  const defaultMonth = new Date().toISOString().slice(0, 7);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch("/api/hr/payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: String(fd.get("employee_id") ?? ""),
          month: String(fd.get("month") ?? ""),
        }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setMessage(json.message ?? json.error ?? "Could not generate payslip.");
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
        Add an active employee before generating payslips.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-ink-muted dark:text-cream-400">
        Auto-calculates Malaysia statutory deductions: EPF (KWSP), SOCSO,
        EIS, and PCB/MTD estimate from base salary.
      </p>
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
              {employee.base_salary_myr != null
                ? ` · RM ${employee.base_salary_myr.toLocaleString("en-MY")}`
                : " · no salary set"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-muted dark:text-cream-400">
          Month
        </label>
        <input
          type="month"
          name="month"
          required
          defaultValue={defaultMonth}
          className={`${inputClass} mt-1`}
        />
      </div>
      {message ? (
        <p className="text-sm text-status-danger" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Generating…" : "Generate payslip"}
      </button>
    </form>
  );
}
