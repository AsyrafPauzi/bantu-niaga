"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function HrHolidayImportButton({ year }: { year?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onImport() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/hr/holidays/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: year ?? new Date().getFullYear() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Import failed.");
        return;
      }
      setMessage(
        `Imported ${json.imported ?? 0} holiday(s)${json.skipped ? ` (${json.skipped} already on file)` : ""}.`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onImport}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Importing…" : `Import ${year ?? new Date().getFullYear()} holidays`}
      </button>
      <p className="text-xs text-ink-muted dark:text-cream-400">
        Fetches federal and state holidays for your business state (free Malaysia calendar API).
      </p>
      {message ? (
        <p className="text-xs font-medium text-ink dark:text-cream-100">{message}</p>
      ) : null}
    </div>
  );
}
