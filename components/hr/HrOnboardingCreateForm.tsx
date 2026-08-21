"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HrEmployeeRow } from "@/lib/hr/load";
import { FormField, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function HrOnboardingCreateForm({
  employees = [],
  employeeId,
  onCreated,
}: {
  employees?: HrEmployeeRow[];
  employeeId?: string;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    const payload = employeeId
      ? { employee_id: employeeId, label: String(formData.get("label") ?? "") }
      : Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/hr/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.message ?? json?.error ?? "Could not add checklist item.");
        return;
      }
      form.reset();
      toast.success("Checklist item added.");
      onCreated?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {!employeeId ? (
        <FormField label="Employee" htmlFor="onboarding-employee" required>
          <Select id="onboarding-employee" name="employee_id" required defaultValue="">
            <option value="">Choose employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
      <FormField label="Checklist item" htmlFor="onboarding-label" required>
        <Input
          id="onboarding-label"
          name="label"
          required
          maxLength={160}
          placeholder="e.g. Collect signed contract"
        />
      </FormField>
      <button
        type="submit"
        disabled={busy || (!employeeId && employees.length === 0)}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Adding..." : "Add checklist item"}
      </button>
    </form>
  );
}
