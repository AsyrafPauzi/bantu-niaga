"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Paperclip, Upload, X } from "lucide-react";
import type { AdminFileCategory } from "@/lib/admin/schemas";
import { STORAGE_CATEGORY_LABELS } from "@/lib/admin/storage-shared";
import { uploadAdminStorageFile } from "@/lib/admin/storage-upload-client";
import { cn } from "@/lib/utils/cn";

interface PickerFile {
  id: string;
  file_name: string;
  mime_type: string;
}

interface AdminStorageFileAttachProps {
  fileId: string | null;
  fileName?: string | null;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  className?: string;
  /** Filters the picker and sets the upload category. */
  category?: AdminFileCategory;
  /** Limit picker and upload to image files (e.g. product photos). */
  imagesOnly?: boolean;
  onAttach: (fileId: string | null) => Promise<void>;
}

function buildPickerUrl(category?: AdminFileCategory, imagesOnly?: boolean): string {
  const params = new URLSearchParams({ limit: "100" });
  if (category) params.set("category", category);
  if (imagesOnly) params.set("images_only", "1");
  return `/api/admin/storage/picker?${params.toString()}`;
}

function StorageImageThumb({
  file,
  selected,
  disabled,
  onSelect,
}: {
  file: PickerFile;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/storage/${file.id}/download`)
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: { download_url: string } }) => {
        if (!cancelled && json.ok && json.data?.download_url) {
          setSrc(json.data.download_url);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file.id]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      title={file.file_name}
      className={cn(
        "relative aspect-square overflow-hidden rounded-lg border-2 bg-cream-50 transition dark:bg-hairline-dark/30",
        selected
          ? "border-brand-500 ring-2 ring-brand-500/30"
          : "border-cream-200 hover:border-brand-300 dark:border-hairline-dark",
        disabled && "opacity-50",
      )}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL from our API
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-ink-muted dark:text-cream-400">
          <ImageIcon className="h-6 w-6" />
        </span>
      )}
    </button>
  );
}

export function AdminStorageFileAttach({
  fileId,
  fileName,
  disabled = false,
  compact = false,
  label = "Attached file",
  className,
  category,
  imagesOnly = false,
  onAttach,
}: AdminStorageFileAttachProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PickerFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const [pickId, setPickId] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadFiles = useCallback(() => {
    setLoading(true);
    void fetch(buildPickerUrl(category, imagesOnly))
      .then((r) => r.json())
      .then(
        (json: {
          ok: boolean;
          data?: { files: PickerFile[]; can_upload?: boolean };
        }) => {
          if (json.ok && json.data) {
            setFiles(json.data.files);
            setCanUpload(Boolean(json.data.can_upload));
          }
        },
      )
      .finally(() => setLoading(false));
  }, [category, imagesOnly]);

  useEffect(() => {
    reloadFiles();
  }, [reloadFiles]);

  const download = (id: string) => {
    void fetch(`/api/admin/storage/${id}/download`)
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: { download_url: string } }) => {
        if (json.ok && json.data?.download_url) {
          window.location.href = json.data.download_url;
        }
      });
  };

  const attach = async (id?: string) => {
    const targetId = id ?? pickId;
    if (!targetId) return;
    setError(null);
    setBusy(true);
    try {
      await onAttach(targetId);
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

  const uploadFile = async (file: File) => {
    const uploadCategory = category ?? "other";
    if (imagesOnly && !file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setBusy(true);
    setUploadPct(0);
    try {
      const uploaded = await uploadAdminStorageFile(file, {
        category: uploadCategory,
        onProgress: setUploadPct,
      });
      setFiles((prev) => [
        {
          id: uploaded.id,
          file_name: uploaded.file_name,
          mime_type: file.type || "application/octet-stream",
        },
        ...prev,
      ]);
      await onAttach(uploaded.id);
      setPickId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      setUploadPct(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  };

  const categoryHint = category ? STORAGE_CATEGORY_LABELS[category] : null;
  const imageFiles = files.filter((f) => f.mime_type.startsWith("image/"));
  const showImageGrid = !compact && imagesOnly && imageFiles.length > 0;

  const uploadControl =
    canUpload && !disabled && !fileId ? (
      <>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={imagesOnly ? "image/*" : undefined}
          disabled={busy}
          onChange={onFileInput}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-cream-300 bg-white px-2.5 text-xs font-semibold text-brand-700 hover:bg-cream-50 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-brand-200"
        >
          {busy && uploadPct != null ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {uploadPct}%
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Upload
            </>
          )}
        </button>
      </>
    ) : null;

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
                  {loading
                    ? "Loading…"
                    : category
                      ? `From ${categoryHint}…`
                      : "From Storage…"}
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
              {uploadControl}
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
        {categoryHint ? (
          <span className="font-normal normal-case text-ink-subtle dark:text-cream-500">
            · {categoryHint}
          </span>
        ) : null}
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
          {showImageGrid ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {imageFiles.map((f) => (
                <StorageImageThumb
                  key={f.id}
                  file={f}
                  selected={pickId === f.id}
                  disabled={busy}
                  onSelect={() => {
                    setPickId(f.id);
                    void attach(f.id);
                  }}
                />
              ))}
            </div>
          ) : null}
          <select
            value={pickId}
            disabled={busy || loading}
            onChange={(e) => setPickId(e.target.value)}
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            <option value="">
              {loading
                ? "Loading files…"
                : category
                  ? `Choose from ${categoryHint}…`
                  : "Choose from Storage…"}
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
            {uploadControl ?? (
              <span className="text-xs text-ink-muted dark:text-cream-400">
                {category ? "Upload saves to this module category." : null}
              </span>
            )}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-status-danger">{error}</p> : null}
    </div>
  );
}
