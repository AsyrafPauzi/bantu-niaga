"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrWarningLetterRow } from "@/lib/hr/warning-letters-shared";
import { WARNING_LETTER_SEVERITIES } from "@/lib/hr/warning-letters-shared";
import { HrToast } from "@/components/hr/HrToast";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

function severityLabel(severity: string): string {
  return severity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function HrWarningLettersSection({
  employeeId,
  letters,
}: {
  employeeId: string;
  letters: HrWarningLetterRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "err" } | null>(
    null,
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const issued_at = String(formData.get("issued_at") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    const severity = String(formData.get("severity") ?? "standard");

    try {
      const res = await fetch("/api/hr/warning-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          issued_at,
          reason,
          severity,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          kind: "err",
          message:
            typeof body.message === "string"
              ? body.message
              : "Could not record warning letter.",
        });
        return;
      }
      setToast({ kind: "ok", message: "Warning letter recorded." });
      form.reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-cream-200 bg-white p-5 sm:p-6 dark:border-hairline-dark dark:bg-panel-dark">
      <div>
        <h2 className={hrClasses.sectionTitle}>Warning letters</h2>
        <p className={cn("mt-1", hrClasses.sectionHint)}>
          Record verbal, standard, or final warnings for this employee.
        </p>
      </div>

      {toast ? (
        <HrToast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />
      ) : null}

      {letters.length > 0 ? (
        <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200 dark:divide-hairline-dark dark:border-hairline-dark">
          {letters.map((letter) => (
            <li key={letter.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  {severityLabel(letter.severity)}
                </p>
                <span className="text-xs text-ink-muted dark:text-cream-400">
                  {fmtDate(letter.issued_at)}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
                {letter.reason}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-cream-300 px-4 py-6 text-center text-sm text-ink-muted dark:border-hairline-dark dark:text-cream-400">
          No warning letters on file.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3 border-t border-cream-200 pt-4 dark:border-hairline-dark">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
          Add warning letter
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="warning-issued-at"
              className="mb-1 block text-xs font-semibold text-ink-muted dark:text-cream-400"
            >
              Issued date
            </label>
            <input
              id="warning-issued-at"
              name="issued_at"
              type="date"
              required
              className={cn("w-full rounded-lg border px-3 py-2 text-sm", hrClasses.input)}
            />
          </div>
          <div>
            <label
              htmlFor="warning-severity"
              className="mb-1 block text-xs font-semibold text-ink-muted dark:text-cream-400"
            >
              Severity
            </label>
            <select
              id="warning-severity"
              name="severity"
              defaultValue="standard"
              className={cn("w-full rounded-lg border px-3 py-2 text-sm", hrClasses.input)}
            >
              {WARNING_LETTER_SEVERITIES.map((s) => (
                <option key={s} value={s}>{severityLabel(s)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label
            htmlFor="warning-reason"
            className="mb-1 block text-xs font-semibold text-ink-muted dark:text-cream-400"
          >
            Reason
          </label>
          <textarea
            id="warning-reason"
            name="reason"
            required
            rows={3}
            maxLength={2000}
            className={cn("w-full rounded-lg border px-3 py-2 text-sm", hrClasses.input)}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50",
            hrClasses.btnPrimary,
          )}
        >
          {busy ? "Saving…" : "Record warning"}
        </button>
      </form>
    </div>
  );
}
