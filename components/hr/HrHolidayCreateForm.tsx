"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export function HrHolidayCreateForm() {
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
      const res = await fetch("/api/hr/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not add holiday.");
        return;
      }
      form.reset();
      setMessage("Holiday added.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input name="name" required maxLength={160} placeholder="Holiday name" className={inputClass} />
      <div className="grid grid-cols-2 gap-3">
        <input
          name="holiday_date"
          type="date"
          required
          className={inputClass}
        />
        <input
          name="state_code"
          maxLength={12}
          placeholder="State, e.g. KUL"
          className={inputClass}
        />
      </div>
      {message ? <p className="text-xs text-ink-muted dark:text-cream-400">{message}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Adding..." : "Add holiday"}
      </button>
    </form>
  );
}
