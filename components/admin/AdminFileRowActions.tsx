"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Link2, Pencil, Trash2 } from "lucide-react";
import { canShareAdminFileCategory } from "@/lib/admin/share";

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
  mimeType: string;
  category?: string | null;
  shareEnabled?: boolean;
  /** Show labels next to icons (desktop). Mobile cards pass false. */
  showLabels?: boolean;
  onEdit?: () => void;
}

export function AdminFileRowActions({
  id,
  fileName,
  mimeType,
  category = null,
  shareEnabled = false,
  showLabels = true,
  onEdit,
}: RowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<
    "download" | "preview" | "delete" | "share" | null
  >(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fetchDownloadUrl = async (inline: boolean) => {
    const res = await fetch(
      `/api/admin/storage/${id}/download${inline ? "?inline=1" : ""}`,
      { method: "GET" },
    );
    const body = (await res.json().catch(() => null)) as
      | ApiEnvelope<DownloadResponse>
      | null;
    if (!res.ok || !body?.data) {
      throw new Error(body?.error?.message ?? "Could not get a download link.");
    }
    return body.data;
  };

  const handleDownload = async () => {
    setError(null);
    setBusy("download");
    try {
      const data = await fetchDownloadUrl(false);
      window.location.href = data.download_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    setError(null);
    setBusy("preview");
    try {
      const data = await fetchDownloadUrl(true);
      window.open(data.download_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
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

  const canPreview =
    mimeType.startsWith("image/") || mimeType === "application/pdf";
  const canShare = canShareAdminFileCategory(category);

  const handleShare = async () => {
    setError(null);
    setBusy("share");
    try {
      const res = await fetch(`/api/admin/storage/${id}/share`, {
        method: shareEnabled ? "DELETE" : "POST",
      });
      const body = (await res.json().catch(() => null)) as
        | ApiEnvelope<{ share_url?: string }>
        | null;
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Could not update share link.");
      }
      if (!shareEnabled && body?.data?.share_url) {
        await navigator.clipboard.writeText(body.data.share_url);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share link failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canShare ? (
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          aria-label={shareEnabled ? "Revoke share link" : "Copy share link"}
        >
          <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
          {showLabels
            ? busy === "share"
              ? "Working…"
              : shareEnabled
                ? "Revoke link"
                : "Share link"
            : null}
        </button>
      ) : null}
      {canPreview ? (
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          aria-label="Preview file"
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
          {showLabels ? (busy === "preview" ? "Opening…" : "Preview") : null}
        </button>
      ) : null}
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          aria-label="Edit file metadata"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          {showLabels ? "Edit" : null}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        aria-label="Download file"
      >
        <Download className="h-3.5 w-3.5" strokeWidth={2} />
        {showLabels ? (busy === "download" ? "Preparing…" : "Download") : null}
      </button>
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-status-danger hover:bg-status-danger/10 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark"
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
