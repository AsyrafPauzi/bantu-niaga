"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

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
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60",
          hrClasses.btnPrimary,
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Importing…" : `Import ${year ?? new Date().getFullYear()} holidays`}
      </button>
      {message ? (
        <p className="text-xs font-medium text-[#0D9488] dark:text-teal-400">{message}</p>
      ) : null}
    </div>
  );
}
