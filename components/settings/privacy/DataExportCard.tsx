"use client";

import { useState } from "react";
import { Download, FileJson, Loader2 } from "lucide-react";

interface ExportResult {
  exportId: string;
  byteSize: number;
  expiresAt: string;
  downloadUrl: string;
}

export function DataExportCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  async function requestExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: ExportResult;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error?.message ?? "Could not generate export.");
        return;
      }
      setResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-cream-200 bg-white p-6 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
        >
          <FileJson className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink dark:text-cream-100">
            Download my data
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            We&apos;ll bundle every personal-data field we hold for you — profile,
            consents, audit log, social connections, content drafts — into a
            single JSON file. PDPA s.30 (Right to Access).
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-1 text-xs text-ink-muted dark:text-cream-400">
        <li>· Generation typically takes under 5 seconds.</li>
        <li>· Bundles are available for 7 days, then auto-purged.</li>
        <li>· Limit: 3 exports per hour.</li>
      </ul>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-md border border-status-success/30 bg-status-success/10 p-3">
          <p className="text-sm font-semibold text-status-success">
            Export ready
          </p>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            {formatBytes(result.byteSize)} · expires{" "}
            {new Date(result.expiresAt).toLocaleString("en-MY")}
          </p>
          <a
            href={result.downloadUrl}
            download
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            Download JSON
          </a>
        </div>
      ) : (
        <button
          type="button"
          onClick={requestExport}
          disabled={busy}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Download className="h-4 w-4" strokeWidth={2} />
          )}
          Generate export
        </button>
      )}
    </section>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
