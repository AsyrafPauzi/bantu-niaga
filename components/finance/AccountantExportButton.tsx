"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function downloadAccountantExportPack(month: string): Promise<void> {
  const res = await fetch(
    `/api/finance/export-pack?month=${encodeURIComponent(month)}`,
    { credentials: "same-origin" },
  );
  if (!res.ok) {
    let message = "Export failed";
    try {
      const json = (await res.json()) as { message?: string };
      message = json.message ?? message;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bantuniaga-accountant-pack-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface AccountantExportButtonProps {
  /** Sync with Finance overview month picker when provided. */
  defaultMonth?: string;
  compact?: boolean;
}

export function AccountantExportButton({
  defaultMonth,
  compact = false,
}: AccountantExportButtonProps) {
  const [month, setMonth] = useState(defaultMonth ?? currentMonth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultMonth) setMonth(defaultMonth);
  }, [defaultMonth]);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      await downloadAccountantExportPack(month);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void download()}
        disabled={loading}
        className="group relative w-full overflow-hidden rounded-xl border border-cream-200 bg-white p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-elevated disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-700"
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-sm">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" strokeWidth={2} />
          )}
        </span>
        <p className="mt-3 text-sm font-semibold text-ink dark:text-cream-100">
          Export pack
        </p>
        <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
          CSV for your accountant
        </p>
        {error ? (
          <p className="mt-2 text-xs text-status-danger">{error}</p>
        ) : null}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div>
        <p className="text-sm font-semibold text-ink dark:text-cream-100">
          Accountant export pack
        </p>
        <p className="text-xs text-ink-muted dark:text-cream-400">
          Monthly CSV — summary, invoices, and ledger transactions. Included in
          Finance core.
        </p>
      </div>
      <label className="text-xs font-medium text-ink-muted">
        Month
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="ml-2 rounded-md border border-cream-300 px-2 py-1 text-sm dark:border-hairline-dark dark:bg-panel-dark"
        />
      </label>
      <button
        type="button"
        onClick={() => void download()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Download pack
      </button>
      {error ? (
        <p className="w-full text-xs text-status-danger">{error}</p>
      ) : null}
    </div>
  );
}
