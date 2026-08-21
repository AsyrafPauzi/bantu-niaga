"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MALAYSIA_STATE_OPTIONS } from "@/lib/settings/state-options";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";
import { FormField, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function HrHolidayCreateForm() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/hr/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.message ?? json?.error ?? "Could not add holiday.");
        return;
      }
      form.reset();
      toast.success("Holiday added.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormField label="Name" htmlFor="holiday-name" required>
        <Input
          id="holiday-name"
          name="name"
          required
          maxLength={160}
          placeholder="e.g. Company anniversary"
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date" htmlFor="holiday-date" required>
          <Input id="holiday-date" name="holiday_date" type="date" required />
        </FormField>
        <FormField label="State" htmlFor="holiday-state" hint="Optional">
          <Select id="holiday-state" name="state_code" defaultValue="">
            <option value="">Nationwide</option>
            {MALAYSIA_STATE_OPTIONS.map((state) => (
              <option key={state.code} value={state.code}>
                {state.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <button
        type="submit"
        disabled={busy}
        className={cn(
          "w-full rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60",
          hrClasses.btnPrimary,
        )}
      >
        {busy ? "Adding..." : "Add holiday"}
      </button>
    </form>
  );
}
