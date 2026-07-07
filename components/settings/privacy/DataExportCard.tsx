"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileJson, Loader2 } from "lucide-react";

interface ExportResult {
  exportId: string;
  byteSize: number;
  expiresAt: string;
  downloadUrl: string;
}

export function DataExportCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport() {
    if (!result?.downloadUrl) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(result.downloadUrl);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(
          (json as { error?: { message?: string } })?.error?.message ??
            "Download failed.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bantuniaga-data-export-${result.exportId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(false);
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
            Export your profile, consent history, audit actions, and records you
            created — as one JSON file (PDPA right of access).
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-1 text-xs text-ink-muted dark:text-cream-400">
        <li>· Ready in a few seconds.</li>
        <li>· Download link expires after 7 days.</li>
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
          <button
            type="button"
            onClick={downloadExport}
            disabled={downloading}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={2} />
            )}
            Download JSON
          </button>
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
