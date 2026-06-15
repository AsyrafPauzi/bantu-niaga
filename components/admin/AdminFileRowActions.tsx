"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface DownloadResponse {
  download_url: string;
  expires_at: string;
  file_name: string;
  mime_type: string;
}

interface RowActionsProps {
  id: string;
  fileName: string;
  /** Show labels next to icons (desktop). Mobile cards pass false. */
  showLabels?: boolean;
}

/**
 * Per-row Download + Delete buttons. Both call the corresponding API
 * route and (on delete) router.refresh() so the table re-renders without
 * the soft-deleted row.
 */
export function AdminFileRowActions({
  id,
  fileName,
  showLabels = true,
}: RowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"download" | "delete" | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setError(null);
    setBusy("download");
    try {
      const res = await fetch(`/api/admin/storage/${id}/download`, {
        method: "GET",
      });
      const body = (await res.json().catch(() => null)) as
        | ApiEnvelope<DownloadResponse>
        | null;
      if (!res.ok || !body?.data) {
        setError(body?.error?.message ?? "Could not get a download link.");
        return;
      }
      // Direct navigate triggers the browser download (the signed URL
      // carries a Content-Disposition: attachment hint).
      window.location.href = body.data.download_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${fileName}"? This can't be undone in the UI.`)) {
      return;
    }
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/storage/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | ApiEnvelope<unknown>
          | null;
        setError(body?.error?.message ?? "Could not delete the file.");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
        aria-label="Download file"
      >
        <Download className="h-3.5 w-3.5" strokeWidth={2} />
        {showLabels ? (busy === "download" ? "Preparing…" : "Download") : null}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-status-danger hover:bg-status-danger/10 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:hover:bg-status-danger/15"
        aria-label="Delete file"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        {showLabels ? (busy === "delete" ? "Deleting…" : "Delete") : null}
      </button>
      {error ? (
        <span className="text-[11px] text-status-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
