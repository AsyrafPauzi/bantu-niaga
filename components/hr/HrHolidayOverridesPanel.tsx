"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { HrHolidayOverrideRow } from "@/lib/hr/effective-calendar";
import type { HrHolidayRow } from "@/lib/hr/load";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

const OVERRIDE_LABELS = {
  add: "Company closure",
  suppress: "Open on gazetted day",
  replace: "Replacement day",
} as const;

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface HrHolidayOverridesPanelProps {
  holidays: HrHolidayRow[];
  overrides: HrHolidayOverrideRow[];
}

export function HrHolidayOverridesPanel({
  holidays,
  overrides: initialOverrides,
}: HrHolidayOverridesPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [overrideType, setOverrideType] = useState<
    "add" | "suppress" | "replace"
  >("add");
  const [replacesHolidayId, setReplacesHolidayId] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [name, setName] = useState("");

  const holidayOptions = useMemo(
    () =>
      [...holidays].sort((a, b) =>
        a.holiday_date.localeCompare(b.holiday_date),
      ),
    [holidays],
  );

  const selectedHoliday = holidayOptions.find((h) => h.id === replacesHolidayId);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const payload = {
      override_type: overrideType,
      holiday_date:
        overrideType === "replace"
          ? holidayDate
          : overrideType === "suppress" && selectedHoliday
            ? selectedHoliday.holiday_date
            : holidayDate,
      replaces_holiday_id:
        overrideType === "add" ? null : replacesHolidayId || null,
      name: overrideType === "add" ? name : name || null,
    };

    try {
      const res = await fetch("/api/hr/holiday-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const issue = json?.issues?.[0]?.message;
        setMessage(issue ?? json?.message ?? json?.error ?? "Could not save.");
        return;
      }
      setMessage("Override saved.");
      setHolidayDate("");
      setName("");
      setReplacesHolidayId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/hr/holiday-overrides/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setMessage("Could not remove override.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-sm dark:border-hairline-dark dark:bg-panel-dark sm:p-5">
      <h2 className={hrClasses.sectionTitle}>Business overrides</h2>
      <p className={cn("mt-1", hrClasses.sectionHint)}>
        Closures, opt-outs, and replacement days feed leave counting and
        Operations bookings.
      </p>

      {initialOverrides.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {initialOverrides.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-cream-200 px-3 py-2 text-sm dark:border-hairline-dark"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink dark:text-cream-100">
                  {OVERRIDE_LABELS[row.override_type]}
                </p>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  {fmtDate(row.holiday_date)}
                  {row.name ? ` · ${row.name}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(row.id)}
                className="shrink-0 rounded p-1 text-ink-muted hover:text-red-600 disabled:opacity-50"
                aria-label="Remove override"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-ink-muted dark:text-cream-400">
          No overrides yet — imported holidays apply as-is.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-cream-200 pt-4 dark:border-hairline-dark">
        <label className={hrClasses.label}>
          <span>Override type</span>
          <select
            value={overrideType}
            onChange={(e) =>
              setOverrideType(e.target.value as typeof overrideType)
            }
            className={hrClasses.input}
          >
            <option value="add">Add company closure</option>
            <option value="suppress">Hide gazetted day (we stay open)</option>
            <option value="replace">Move to replacement day</option>
          </select>
        </label>

        {overrideType !== "add" ? (
          <label className={hrClasses.label}>
            <span>Gazetted holiday</span>
            <select
              required
              value={replacesHolidayId}
              onChange={(e) => setReplacesHolidayId(e.target.value)}
              className={hrClasses.input}
            >
              <option value="">Select holiday…</option>
              {holidayOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {fmtDate(h.holiday_date)} — {h.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {overrideType === "add" || overrideType === "replace" ? (
          <label className={hrClasses.label}>
            <span>{overrideType === "replace" ? "New date" : "Closure date"}</span>
            <input
              type="date"
              required
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              className={hrClasses.input}
            />
          </label>
        ) : null}

        {overrideType === "add" ? (
          <label className={hrClasses.label}>
            <span>Label</span>
            <input
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Year-end shutdown"
              className={hrClasses.input}
            />
          </label>
        ) : overrideType === "replace" ? (
          <label className={hrClasses.label}>
            <span>Label (optional)</span>
            <input
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selectedHoliday?.name ?? "Replacement holiday"}
              className={hrClasses.input}
            />
          </label>
        ) : null}

        {message ? (
          <p
            className={cn(
              "text-xs font-medium",
              message === "Override saved."
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
          {busy ? "Saving…" : "Save override"}
        </button>
      </form>
    </div>
  );
}
