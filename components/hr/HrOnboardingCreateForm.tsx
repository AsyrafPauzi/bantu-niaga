"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrEmployeeRow } from "@/lib/hr/load";

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export function HrOnboardingCreateForm({
  employees,
}: {
  employees: HrEmployeeRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage(null);
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/hr/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not add checklist item.");
        return;
      }
      form.reset();
      setMessage("Checklist item added.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <select name="employee_id" required className={inputClass}>
        <option value="">Choose employee</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.full_name}
          </option>
        ))}
      </select>
      <input
        name="label"
        required
        maxLength={160}
        placeholder="Checklist item, e.g. Collect signed contract"
        className={inputClass}
      />
      {message ? <p className="text-xs text-ink-muted dark:text-cream-400">{message}</p> : null}
      <button
        type="submit"
        disabled={busy || employees.length === 0}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Adding..." : "Add checklist item"}
      </button>
    </form>
  );
}
