"use client";

import { useState } from "react";

interface StaffLeaveRequestFormProps {
  token: string;
  employeeName: string;
}

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 disabled:cursor-not-allowed disabled:opacity-70 dark:border-cream-300 dark:bg-white dark:text-ink dark:placeholder:text-ink-subtle";

const labelClass =
  "block space-y-1 text-xs font-semibold text-ink-muted dark:text-ink-muted";

export function StaffLeaveRequestForm({
  token,
  employeeName,
}: StaffLeaveRequestFormProps) {
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage(null);
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch(`/api/staff/leave/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not submit leave request.");
        return;
      }
      form.reset();
      setSubmitted(true);
      setMessage("Leave request submitted. Your manager will review it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className={labelClass}>
        Staff name
        <input
          value={employeeName}
          readOnly
          className={`${inputClass} bg-cream-100 font-medium dark:bg-cream-100`}
        />
      </label>
      <label className={labelClass}>
        Leave type
        <select name="leave_type" required disabled={submitted} className={inputClass}>
          <option value="annual">Annual leave</option>
          <option value="emergency">Emergency leave</option>
          <option value="mc">MC</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Start date
          <input
            name="start_date"
            type="date"
            required
            disabled={submitted}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          End date
          <input
            name="end_date"
            type="date"
            required
            disabled={submitted}
            className={inputClass}
          />
        </label>
      </div>
      <label className={labelClass}>
        Reason
        <textarea
          name="reason"
          maxLength={500}
          rows={4}
          disabled={submitted}
          className={inputClass}
        />
      </label>
      {message ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-ink-muted dark:bg-brand-50 dark:text-ink-muted">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || submitted}
        className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Submitting..." : submitted ? "Submitted" : "Submit leave request"}
      </button>
    </form>
  );
}
