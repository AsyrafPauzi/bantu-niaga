"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrEmployeeRow } from "@/lib/hr/load";

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export function HrEmployeeUpdateForm({ employee }: { employee: HrEmployeeRow }) {
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
      const res = await fetch(`/api/hr/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not save changes.");
        return;
      }
      setMessage("Changes saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Full name
          <input
            name="full_name"
            required
            maxLength={160}
            defaultValue={employee.full_name}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Role
          <input
            name="role_title"
            required
            maxLength={120}
            defaultValue={employee.role_title}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Employment type
          <select
            name="employment_type"
            required
            defaultValue={employee.employment_type}
            className={inputClass}
          >
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Status
          <select
            name="status"
            required
            defaultValue={employee.status}
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Phone
          <input
            name="phone_e164"
            maxLength={24}
            defaultValue={employee.phone_e164 ?? ""}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Email
          <input
            name="email"
            type="email"
            maxLength={160}
            defaultValue={employee.email ?? ""}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Emergency contact
          <input
            name="emergency_contact_name"
            maxLength={160}
            defaultValue={employee.emergency_contact_name ?? ""}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Emergency phone
          <input
            name="emergency_contact_phone"
            maxLength={24}
            defaultValue={employee.emergency_contact_phone ?? ""}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Bank name
          <input
            name="bank_name"
            maxLength={120}
            defaultValue={employee.bank_name ?? ""}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Annual leave entitlement (days)
          <input
            name="annual_leave_entitlement_days"
            type="number"
            min={0}
            max={365}
            step={0.5}
            defaultValue={employee.annual_leave_entitlement_days ?? 8}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Identity type
          <select
            name="identity_type"
            defaultValue={(employee as { identity_type?: string }).identity_type ?? ""}
            className={inputClass}
          >
            <option value="">Not set</option>
            <option value="ic">IC</option>
            <option value="passport">Passport</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Identity number
          <input
            name="identity_number"
            maxLength={80}
            defaultValue={(employee as { identity_number?: string }).identity_number ?? ""}
            placeholder={
              (employee as { identity_number_masked?: string }).identity_number_masked ??
              "IC or passport number"
            }
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Bank account no.
          <input
            name="bank_account_no"
            maxLength={80}
            defaultValue={(employee as { bank_account_no?: string }).bank_account_no ?? ""}
            placeholder={
              (employee as { bank_account_no_masked?: string }).bank_account_no_masked ??
              "Account number"
            }
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400 sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={3}
            maxLength={500}
            defaultValue={employee.notes ?? ""}
            className={inputClass}
          />
        </label>
      </div>
      {message ? (
        <p className="text-xs text-ink-muted dark:text-cream-400">{message}</p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
