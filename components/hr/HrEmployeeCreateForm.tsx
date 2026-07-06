"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export function HrEmployeeCreateForm({
  redirectTo,
  formId = "hr-employee-create",
  hideSubmit,
}: {
  redirectTo?: string;
  formId?: string;
  hideSubmit?: boolean;
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
      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not add employee.");
        return;
      }
      form.reset();
      setMessage("Employee added.");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Full name
          <input name="full_name" required maxLength={160} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Role
          <input name="role_title" required maxLength={120} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Employment type
          <select name="employment_type" required className={inputClass}>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Start date
          <input name="start_date" type="date" required className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Identity type
          <select name="identity_type" className={inputClass}>
            <option value="">Not set</option>
            <option value="ic">IC</option>
            <option value="passport">Passport</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          IC / Passport no.
          <input name="identity_number" maxLength={80} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Phone
          <input name="phone_e164" maxLength={24} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Email
          <input name="email" type="email" maxLength={160} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Emergency contact
          <input
            name="emergency_contact_name"
            maxLength={160}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Emergency relationship
          <input
            name="emergency_contact_relationship"
            maxLength={80}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Emergency phone
          <input
            name="emergency_contact_phone"
            maxLength={24}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Bank name
          <input name="bank_name" maxLength={120} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
          Bank account no.
          <input name="bank_account_no" maxLength={80} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400 sm:col-span-2">
          Bank account holder
          <input name="bank_account_holder" maxLength={160} className={inputClass} />
        </label>
      </div>
      {message ? (
        <p className="text-xs text-ink-muted dark:text-cream-400">{message}</p>
      ) : null}
      {!redirectTo && !hideSubmit ? (
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? "Adding..." : "Add employee"}
        </button>
      ) : null}
    </form>
  );
}
