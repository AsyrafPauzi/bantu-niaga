"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { canShareAdminFileCategory } from "@/lib/admin/share";
import { cn } from "@/lib/utils/cn";

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
  /** Show labels next to icons (desktop table rows). Card view passes false. */
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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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
    setOpen(false);
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
    setOpen(false);
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
    setOpen(false);
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

  const handleShare = async () => {
    setError(null);
    setBusy("share");
    setOpen(false);
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

  const canPreview =
    mimeType.startsWith("image/") || mimeType === "application/pdf";
  const canShare = canShareAdminFileCategory(category);

  /* ── Shared item style ─────────────────────────────────────── */
  const itemCls =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-cream-100 disabled:opacity-50 dark:text-cream-100 dark:hover:bg-hairline-dark/50 transition-colors text-left";
  const dangerCls =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-status-danger hover:bg-status-danger/10 disabled:opacity-50 transition-colors text-left";

  /* ── Compact icon-only trigger + dropdown ──────────────────── */
  return (
    <div className="relative flex items-center gap-1.5" ref={menuRef}>
      {/* Quick-access: Download (always visible) */}
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={busy !== null}
        className="grid h-7 w-7 place-items-center rounded-md border border-cream-300 bg-white text-ink-muted hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-300 dark:hover:bg-hairline-dark/50"
        aria-label="Download file"
        title="Download"
      >
        {busy === "download" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" strokeWidth={2} />
        )}
      </button>

      {/* More actions trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy !== null}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-md border border-cream-300 bg-white text-ink-muted hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-300 dark:hover:bg-hairline-dark/50",
          open && "bg-cream-100 dark:bg-hairline-dark/50",
        )}
        aria-label="More actions"
        title="More"
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className={cn(
            "absolute z-50 w-44 rounded-xl border border-cream-200 bg-white p-1.5 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark",
            showLabels
              ? "right-0 top-full mt-1"   // table row: drop down aligned right
              : "bottom-full right-0 mb-1", // card overlay: pop up
          )}
        >
          {canPreview && (
            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={busy !== null}
              className={itemCls}
            >
              {busy === "preview" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              )}
              {busy === "preview" ? "Opening…" : "Preview"}
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => { setOpen(false); onEdit(); }}
              disabled={busy !== null}
              className={itemCls}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              Edit
            </button>
          )}
          {canShare && (
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={busy !== null}
              className={itemCls}
            >
              {busy === "share" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              )}
              {busy === "share"
                ? "Working…"
                : shareEnabled
                  ? "Revoke link"
                  : "Copy link"}
            </button>
          )}
          <div className="my-1 border-t border-cream-100 dark:border-hairline-dark/60" />
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy !== null}
            className={dangerCls}
          >
            {busy === "delete" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            )}
            {busy === "delete" ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}

      {error ? (
        <span className="text-[11px] text-status-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
