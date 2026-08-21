"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrEmployeeRow } from "@/lib/hr/load";
import { FormField, Input, Textarea, Select, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function HrAppraisalCreateForm({
  employees,
}: {
  employees: HrEmployeeRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);

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
        setError(json.message ?? json.error ?? "Could not schedule appraisal.");
        return;
      }
      form.reset();
      toast.success("Appraisal scheduled.");
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
      <FormField label="Employee" htmlFor="appraisal-employee" required>
        <Select
          id="appraisal-employee"
          name="employee_id"
          required
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
        </Select>
      </FormField>
      <FormField label="Review period" htmlFor="appraisal-period" required>
        <Input
          id="appraisal-period"
          name="period_label"
          required
          maxLength={80}
          placeholder={`${currentYear} Annual review`}
          defaultValue={`${currentYear} Annual review`}
        />
      </FormField>
      <FormField label="Due date" htmlFor="appraisal-due" required>
        <Input
          id="appraisal-due"
          type="date"
          name="due_date"
          required
          defaultValue={defaultDueIso}
        />
      </FormField>
      <FormField label="Notes" htmlFor="appraisal-notes" hint="Optional">
        <Textarea
          id="appraisal-notes"
          name="notes"
          rows={2}
          maxLength={1000}
          placeholder="Goals, probation review, etc."
        />
      </FormField>
      {error ? <FieldError>{error}</FieldError> : null}
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
