"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MALAYSIA_STATE_OPTIONS } from "@/lib/settings/state-options";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

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
      <label className={hrClasses.label}>
        <span>Name</span>
        <input
          name="name"
          required
          maxLength={160}
          placeholder="e.g. Company anniversary"
          className={hrClasses.input}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={hrClasses.label}>
          <span>Date</span>
          <input name="holiday_date" type="date" required className={hrClasses.input} />
        </label>
        <label className={hrClasses.label}>
          <span>State (optional)</span>
          <select name="state_code" className={hrClasses.input} defaultValue="">
            <option value="">Nationwide</option>
            {MALAYSIA_STATE_OPTIONS.map((state) => (
              <option key={state.code} value={state.code}>
                {state.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message ? (
        <p
          className={cn(
            "text-xs font-medium",
            message === "Holiday added."
              ? "text-[#0D9488] dark:text-teal-400"
              : "text-ink-muted dark:text-cream-400",
          )}
        >
          {message}
        </p>
      ) : null}
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
