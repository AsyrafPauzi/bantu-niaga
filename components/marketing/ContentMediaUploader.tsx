"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type ForwardedRef,
  forwardRef,
} from "react";
import {
  FileVideo,
  Image as ImageIcon,
  LayoutGrid,
  Upload as UploadIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  MEDIA_PICKERS,
  formatMediaBytes,
  isImageMime,
  isVideoMime,
  validateMediaFile,
  type MediaPickerKind,
} from "@/lib/marketing/media";

/**
 * Pencil-styled media uploader for the New Post form.
 *
 * Four hidden file inputs (one per picker kind) sit beside four buttons:
 *
 *   Photo     accept=image/*       multiple=false
 *   Video     accept=video/*       multiple=false
 *   Carousel  accept=image/*       multiple=true   (max 10)
 *   Upload    accept=image/*,video/*  multiple=true  (max 10)
 *
 * Per-file lifecycle:
 *   1. Validate locally (size, MIME).
 *   2. POST /api/marketing/media/prepare-upload  → { upload_url, storage_path }
 *   3. PUT bytes to upload_url (XHR for progress).
 *   4. POST /api/marketing/media/confirm        → { id }
 *   5. Mark row as uploaded; parent reads file_ids via the imperative
 *      handle on form submit.
 *
 * Removal: clicking X on an uploaded row calls DELETE
 * /api/marketing/media/[id]; an in-flight row is just dropped from state
 * (no server cleanup needed — the orphaned signed URL expires in 5 min).
 */

export interface ContentMediaUploaderHandle {
  /** All currently-uploaded file IDs, in display order. */
  getUploadedFileIds: () => string[];
  /** True while at least one row is still uploading. */
  isUploading: () => boolean;
  /** Did at least one upload finish OK? */
  hasUploads: () => boolean;
  /** Local blob URL for the first photo (used for the right-pane preview). */
  getFirstImagePreviewUrl: () => string | null;
}

interface UploadRow {
  tempId: string;
  name: string;
  mime: string;
  size: number;
  status: "uploading" | "uploaded" | "failed";
  file_id?: string;
  /** Local object URL for image preview (revoked on remove/unmount). */
  previewUrl?: string;
  error?: string;
  /** 0–100 — only meaningful while status === 'uploading'. */
  progress: number;
}

interface PrepareUploadResponse {
  upload_url: string;
  storage_path: string;
  expires_at: string;
  token?: string;
  temp_id: string;
}

interface ConfirmResponse {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface ContentMediaUploaderProps {
  /** Called whenever the row list changes — parent uses this to
   *  enable/disable the form submit button and refresh the preview. */
  onChange?: (state: {
    uploadingCount: number;
    uploadedCount: number;
    firstImagePreviewUrl: string | null;
  }) => void;
}

const PICKER_BUTTONS: Array<{
  kind: MediaPickerKind;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    kind: "photo",
    icon: ImageIcon,
    tone: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  },
  {
    kind: "video",
    icon: FileVideo,
    tone: "bg-accent-100 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200",
  },
  {
    kind: "carousel",
    icon: LayoutGrid,
    tone: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  },
  {
    kind: "upload",
    icon: UploadIcon,
    tone: "border border-dashed border-cream-300 text-ink-muted dark:border-hairline-dark dark:text-cream-400",
  },
];

function generateTempId(): string {
  // Avoid pulling crypto.randomUUID directly for older browsers; this is
  // good enough for an in-memory dedup key.
  return `tmp_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export const ContentMediaUploader = forwardRef(function ContentMediaUploader(
  { onChange }: ContentMediaUploaderProps,
  ref: ForwardedRef<ContentMediaUploaderHandle>,
) {
  const inputRefs = useRef<Record<MediaPickerKind, HTMLInputElement | null>>({
    photo: null,
    video: null,
    carousel: null,
    upload: null,
  });
  const xhrPool = useRef<Map<string, XMLHttpRequest>>(new Map());
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Revoke any outstanding blob URLs when the component unmounts. The
  // per-row removal handler also revokes; this is the safety net for
  // the page-navigation case.
  useEffect(() => {
    return () => {
      for (const row of rows) {
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
      }
      for (const xhr of xhrPool.current.values()) {
        try {
          xhr.abort();
        } catch {
          // ignore
        }
      }
      xhrPool.current.clear();
    };
    // intentional: we only want this on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify the parent on every row-list change.
  useEffect(() => {
    if (!onChange) return;
    const uploadingCount = rows.filter((r) => r.status === "uploading").length;
    const uploadedCount = rows.filter((r) => r.status === "uploaded").length;
    const firstPhoto =
      rows.find(
        (r) =>
          r.previewUrl &&
          isImageMime(r.mime) &&
          (r.status === "uploaded" || r.status === "uploading"),
      )?.previewUrl ?? null;
    onChange({
      uploadingCount,
      uploadedCount,
      firstImagePreviewUrl: firstPhoto,
    });
  }, [rows, onChange]);

  useImperativeHandle(
    ref,
    () => ({
      getUploadedFileIds: () =>
        rows
          .filter((r) => r.status === "uploaded" && r.file_id)
          .map((r) => r.file_id as string),
      isUploading: () => rows.some((r) => r.status === "uploading"),
      hasUploads: () => rows.some((r) => r.status === "uploaded"),
      getFirstImagePreviewUrl: () =>
        rows.find(
          (r) =>
            r.previewUrl &&
            isImageMime(r.mime) &&
            (r.status === "uploaded" || r.status === "uploading"),
        )?.previewUrl ?? null,
    }),
    [rows],
  );

  const patchRow = useCallback(
    (tempId: string, patch: Partial<UploadRow>) => {
      setRows((prev) =>
        prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const uploadOne = useCallback(
    async (tempId: string, file: File) => {
      try {
        const prepareRes = await fetch("/api/marketing/media/prepare-upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            file_name: file.name,
            mime_type: file.type || "application/octet-stream",
            file_size_bytes: file.size,
          }),
        });
        if (!prepareRes.ok) {
          const body = (await prepareRes
            .json()
            .catch(() => null)) as ApiEnvelope<PrepareUploadResponse> | null;
          const msg =
            body?.error?.message ??
            (prepareRes.status === 413
              ? "File too large. Maximum upload size is 100 MB."
              : "Could not prepare the upload.");
          patchRow(tempId, { status: "failed", error: msg });
          return;
        }
        const prepareBody =
          (await prepareRes.json()) as ApiEnvelope<PrepareUploadResponse>;
        const prep = prepareBody.data;
        if (!prep) {
          patchRow(tempId, {
            status: "failed",
            error: "Server did not return an upload URL.",
          });
          return;
        }

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrPool.current.set(tempId, xhr);
          xhr.open("PUT", prep.upload_url, true);
          xhr.setRequestHeader(
            "content-type",
            file.type || "application/octet-stream",
          );
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) {
              patchRow(tempId, {
                progress: Math.round((e.loaded / e.total) * 100),
              });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else
              reject(
                new Error(
                  `Upload failed (HTTP ${xhr.status}). Please try again.`,
                ),
              );
          };
          xhr.onerror = () =>
            reject(new Error("Upload failed — network error."));
          xhr.onabort = () => reject(new Error("Upload cancelled."));
          xhr.send(file);
        });
        xhrPool.current.delete(tempId);

        const confirmRes = await fetch("/api/marketing/media/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storage_path: prep.storage_path,
            file_name: file.name,
            mime_type: file.type || "application/octet-stream",
            file_size_bytes: file.size,
          }),
        });
        if (!confirmRes.ok) {
          const body = (await confirmRes
            .json()
            .catch(() => null)) as ApiEnvelope<ConfirmResponse> | null;
          patchRow(tempId, {
            status: "failed",
            error: body?.error?.message ?? "Could not finalise the upload.",
          });
          return;
        }
        const confirmBody =
          (await confirmRes.json()) as ApiEnvelope<ConfirmResponse>;
        const confirmed = confirmBody.data;
        if (!confirmed?.id) {
          patchRow(tempId, {
            status: "failed",
            error: "Server did not return a file id.",
          });
          return;
        }
        patchRow(tempId, {
          status: "uploaded",
          file_id: confirmed.id,
          progress: 100,
        });
      } catch (e) {
        xhrPool.current.delete(tempId);
        patchRow(tempId, {
          status: "failed",
          error: e instanceof Error ? e.message : "Upload failed.",
        });
      }
    },
    [patchRow],
  );

  const handleFiles = useCallback(
    (files: FileList | null, kind: MediaPickerKind) => {
      if (!files || files.length === 0) return;
      setGlobalError(null);

      const spec = MEDIA_PICKERS[kind];
      const incoming = Array.from(files).slice(0, spec.maxFiles);

      const fresh: Array<{ row: UploadRow; file: File }> = [];
      for (const file of incoming) {
        const reason = validateMediaFile({ size: file.size, type: file.type });
        if (reason) {
          setGlobalError(reason);
          continue;
        }
        const tempId = generateTempId();
        const previewUrl = isImageMime(file.type)
          ? URL.createObjectURL(file)
          : undefined;
        fresh.push({
          row: {
            tempId,
            name: file.name,
            mime: file.type || "application/octet-stream",
            size: file.size,
            status: "uploading",
            previewUrl,
            progress: 0,
          },
          file,
        });
      }

      if (fresh.length === 0) return;
      setRows((prev) => [...prev, ...fresh.map((f) => f.row)]);
      for (const { row, file } of fresh) {
        void uploadOne(row.tempId, file);
      }
    },
    [uploadOne],
  );

  const onInputChange = useCallback(
    (kind: MediaPickerKind, event: ChangeEvent<HTMLInputElement>) => {
      handleFiles(event.target.files, kind);
      // Reset so re-selecting the same file fires onChange again.
      event.target.value = "";
    },
    [handleFiles],
  );

  const triggerPicker = useCallback((kind: MediaPickerKind) => {
    inputRefs.current[kind]?.click();
  }, []);

  const removeRow = useCallback(async (tempId: string) => {
    const row = await new Promise<UploadRow | null>((resolve) => {
      setRows((prev) => {
        const found = prev.find((r) => r.tempId === tempId) ?? null;
        if (!found) {
          resolve(null);
          return prev;
        }
        // Abort any in-flight XHR first so we don't race the state drop.
        const xhr = xhrPool.current.get(tempId);
        if (xhr) {
          try {
            xhr.abort();
          } catch {
            // ignore
          }
          xhrPool.current.delete(tempId);
        }
        if (found.previewUrl) URL.revokeObjectURL(found.previewUrl);
        resolve(found);
        return prev.filter((r) => r.tempId !== tempId);
      });
    });

    if (row?.status === "uploaded" && row.file_id) {
      // Best-effort soft-delete. Even on failure we still drop the row
      // from local state — the parent should never end up trying to
      // attach a removed file_id.
      try {
        await fetch(`/api/marketing/media/${row.file_id}`, {
          method: "DELETE",
        });
      } catch {
        // ignore — UI already reflects the removal
      }
    }
  }, []);

  const uploadingCount = rows.filter((r) => r.status === "uploading").length;
  const uploadedCount = rows.filter((r) => r.status === "uploaded").length;
  const totalCount = rows.length;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-4 gap-2">
        {PICKER_BUTTONS.map((btn) => {
          const spec = MEDIA_PICKERS[btn.kind];
          const Icon = btn.icon;
          return (
            <div key={btn.kind} className="contents">
              <button
                type="button"
                onClick={() => triggerPicker(btn.kind)}
                className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg transition-colors hover:opacity-90 ${btn.tone}`}
              >
                <Icon className="h-6 w-6" strokeWidth={1.5} />
                <span className="text-[11px] font-semibold">{spec.label}</span>
              </button>
              <input
                ref={(el) => {
                  inputRefs.current[btn.kind] = el;
                }}
                type="file"
                accept={spec.accept}
                multiple={spec.multiple}
                className="hidden"
                onChange={(e) => onInputChange(btn.kind, e)}
              />
            </div>
          );
        })}
      </div>

      {totalCount > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-ink-muted dark:text-cream-400">
            <span>
              {uploadingCount > 0
                ? `Uploading ${uploadedCount + 1}/${totalCount}…`
                : `${uploadedCount}/${totalCount} uploaded`}
            </span>
            <span>{uploadedCount}/{totalCount} ready</span>
          </div>
          {uploadingCount > 0 ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{
                  width: `${
                    totalCount === 0
                      ? 0
                      : Math.round(
                          (rows.reduce(
                            (sum, r) =>
                              sum +
                              (r.status === "uploaded"
                                ? 100
                                : r.status === "uploading"
                                  ? r.progress
                                  : 0),
                            0,
                          ) /
                            (totalCount * 100)) *
                            100,
                        )
                  }%`,
                }}
              />
            </div>
          ) : null}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {rows.map((row) => (
              <div
                key={row.tempId}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-cream-200 bg-cream-100 dark:border-hairline-dark dark:bg-hairline-dark/40"
              >
                {row.previewUrl && isImageMime(row.mime) ? (
                  // Local blob preview — fine to use a plain <img>; not
                  // a next/image candidate (URL is per-session).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.previewUrl}
                    alt={row.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-center">
                    {isVideoMime(row.mime) ? (
                      <FileVideo
                        className="h-6 w-6 text-ink-muted dark:text-cream-400"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <ImageIcon
                        className="h-6 w-6 text-ink-muted dark:text-cream-400"
                        strokeWidth={1.5}
                      />
                    )}
                    <span className="line-clamp-2 text-[9px] leading-tight text-ink-muted dark:text-cream-400">
                      {row.name}
                    </span>
                  </div>
                )}

                {row.status === "uploading" ? (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-cream-200 dark:bg-hairline-dark">
                    <div
                      className="h-full bg-brand-500 transition-all"
                      style={{ width: `${row.progress}%` }}
                    />
                  </div>
                ) : null}

                {row.status === "failed" ? (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-status-danger/15 px-1 text-center text-[9px] font-semibold text-status-danger"
                    title={row.error ?? "Upload failed"}
                  >
                    Failed
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void removeRow(row.tempId)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/80"
                  aria-label={`Remove ${row.name}`}
                  title={`Remove ${row.name}`}
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>

                <span className="absolute bottom-0 left-0 max-w-full truncate rounded-tr-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  {formatMediaBytes(row.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {globalError ? (
        <p className="text-[11px] font-medium text-status-danger">
          {globalError}
        </p>
      ) : null}

      <p className="text-[11px] italic text-ink-subtle">
        Photos + videos up to 100 MB. Stored privately in your business&apos;s
        marketing media bucket.
      </p>
    </div>
  );
});
