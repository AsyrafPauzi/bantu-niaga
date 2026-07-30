"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PickerFile {
  id: string;
  file_name: string;
}

interface AdminStorageFileAttachProps {
  fileId: string | null;
  fileName?: string | null;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  className?: string;
  onAttach: (fileId: string | null) => Promise<void>;
}

export function AdminStorageFileAttach({
  fileId,
  fileName,
  disabled = false,
  compact = false,
  label = "Attached file",
  className,
  onAttach,
}: AdminStorageFileAttachProps) {
  const [files, setFiles] = useState<PickerFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickId, setPickId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch("/api/admin/storage/picker?limit=100")
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: { files: PickerFile[] } }) => {
        if (!cancelled && json.ok && json.data) {
          setFiles(json.data.files);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const download = (id: string) => {
    void fetch(`/api/admin/storage/${id}/download`)
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: { download_url: string } }) => {
        if (json.ok && json.data?.download_url) {
          window.location.href = json.data.download_url;
        }
      });
  };

  const attach = async () => {
    if (!pickId) return;
    setError(null);
    setBusy(true);
    try {
      await onAttach(pickId);
      setPickId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not attach file.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      await onAttach(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove file.");
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <div className={cn("min-w-0", className)}>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {fileId && fileName ? (
            <>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => download(fileId)}
                className="inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-md border border-cream-200 bg-cream-50/80 px-2 text-xs font-medium text-brand-700 hover:bg-cream-100 dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-brand-200 sm:max-w-[280px]"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{fileName}</span>
              </button>
              {!disabled ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-status-danger/10 hover:text-status-danger"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </>
          ) : !disabled ? (
            <>
              <select
                value={pickId}
                disabled={busy || loading}
                onChange={(e) => setPickId(e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-md border border-cream-300 bg-white px-2 text-xs dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 sm:max-w-xs"
              >
                <option value="">
                  {loading ? "Loading…" : "From Storage…"}
                </option>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.file_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !pickId}
                onClick={() => void attach()}
                className="inline-flex h-8 shrink-0 items-center rounded-md bg-brand-500 px-2.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Attach"}
              </button>
              <Link
                href="/admin/storage"
                className="inline-flex h-8 shrink-0 items-center text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
              >
                Upload
              </Link>
            </>
          ) : (
            <span className="text-xs text-ink-muted dark:text-cream-400">—</span>
          )}
        </div>
        {error ? <p className="mt-1 text-xs text-status-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
        <Paperclip className="h-3.5 w-3.5" />
        {label}
      </p>

      {fileId && fileName ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-cream-50/80 px-3 py-2 dark:border-hairline-dark dark:bg-hairline-dark/30">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink dark:text-cream-100">
            <FileText className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="truncate">{fileName}</span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => download(fileId)}
              className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
            >
              Download
            </button>
            {!disabled ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="text-xs font-semibold text-status-danger hover:underline"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted dark:text-cream-400">No file attached.</p>
      )}

      {!disabled && !fileId ? (
        <div className="space-y-2">
          <select
            value={pickId}
            disabled={busy || loading}
            onChange={(e) => setPickId(e.target.value)}
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            <option value="">
              {loading ? "Loading files…" : "Choose from Storage…"}
            </option>
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.file_name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !pickId}
              onClick={() => void attach()}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Attach"}
            </button>
            <Link
              href="/admin/storage"
              className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
            >
              Upload
            </Link>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-status-danger">{error}</p> : null}
    </div>
  );
}
