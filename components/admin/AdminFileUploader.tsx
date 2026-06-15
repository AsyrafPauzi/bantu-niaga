"use client";

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ADMIN_FILE_CATEGORIES,
  ADMIN_FILE_MAX_BYTES,
  type AdminFileCategory,
} from "@/lib/admin/schemas";

/**
 * Client-side upload widget for Admin Digital Storage.
 *
 * Flow per file:
 *   1. POST  /api/admin/storage          → { upload_url, storage_path }
 *   2. PUT   <upload_url>  (raw bytes)   → XHR with progress events
 *   3. POST  /api/admin/storage/confirm  → admin_files row
 *   4. router.refresh()                  → server-rendered list re-fetches
 *
 * The 100 MB cap is enforced client-side as a courtesy; the API rejects
 * oversized requests with HTTP 413 and the DB CHECK is the last line of
 * defense.
 */

interface UploadInitResponse {
  upload_url: string;
  storage_path: string;
  expires_at: string;
  token?: string;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

type Phase = "idle" | "preparing" | "uploading" | "finalising" | "success" | "error";

interface UploaderProps {
  /** When true the user is HR Officer — UI hides the category picker
   *  and the server forces category = 'hr_doc'. */
  hrDocsOnly: boolean;
}

const ACCEPT_HINT = "image/*,application/pdf,.csv,.xlsx,.docx,.txt,.zip";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminFileUploader({ hrDocsOnly }: UploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<AdminFileCategory | "">(
    hrDocsOnly ? "hr_doc" : "",
  );
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const reset = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setFile(null);
    setProgressPct(0);
    setPhase("idle");
    setError(null);
    setDescription("");
    if (!hrDocsOnly) setCategory("");
    if (inputRef.current) inputRef.current.value = "";
  }, [hrDocsOnly]);

  const handleFileSelected = useCallback((nextFile: File) => {
    if (nextFile.size <= 0) {
      setError("That file is empty.");
      return;
    }
    if (nextFile.size > ADMIN_FILE_MAX_BYTES) {
      setError(
        `File too large (${formatBytes(nextFile.size)}). Maximum upload size is 100 MB.`,
      );
      return;
    }
    setError(null);
    setFile(nextFile);
    setPhase("idle");
    setProgressPct(0);
  }, []);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files?.[0];
    if (f) handleFileSelected(f);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const f = event.dataTransfer.files?.[0];
    if (f) handleFileSelected(f);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => setIsDragOver(false);

  const startUpload = useCallback(async () => {
    if (!file) return;

    setError(null);
    setPhase("preparing");
    setProgressPct(0);

    try {
      const initRes = await fetch("/api/admin/storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size_bytes: file.size,
          category: hrDocsOnly ? "hr_doc" : category || null,
          description: description.trim() || null,
        }),
      });

      if (!initRes.ok) {
        const body = (await initRes.json().catch(() => null)) as
          | ApiEnvelope<UploadInitResponse>
          | null;
        const msg =
          body?.error?.message ??
          (initRes.status === 413
            ? "File too large. Maximum upload size is 100 MB."
            : "Could not prepare the upload.");
        setError(msg);
        setPhase("error");
        return;
      }

      const initBody = (await initRes.json()) as ApiEnvelope<UploadInitResponse>;
      const init = initBody.data;
      if (!init) {
        setError("Server did not return an upload URL.");
        setPhase("error");
        return;
      }

      setPhase("uploading");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", init.upload_url, true);
        xhr.setRequestHeader(
          "content-type",
          file.type || "application/octet-stream",
        );
        if (init.token) {
          // Supabase signed upload URLs also accept the token in this
          // header — included for SDK compatibility across versions.
          xhr.setRequestHeader("x-upsert", "false");
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            setProgressPct(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `Upload failed (HTTP ${xhr.status}). Please try again.`,
              ),
            );
          }
        };
        xhr.onerror = () =>
          reject(new Error("Upload failed — network error."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));
        xhr.send(file);
      });
      xhrRef.current = null;

      setPhase("finalising");

      const confirmRes = await fetch("/api/admin/storage/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storage_path: init.storage_path,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size_bytes: file.size,
          category: hrDocsOnly ? "hr_doc" : category || null,
          description: description.trim() || null,
        }),
      });

      if (!confirmRes.ok) {
        const body = (await confirmRes.json().catch(() => null)) as
          | ApiEnvelope<unknown>
          | null;
        setError(body?.error?.message ?? "Could not finalise the upload.");
        setPhase("error");
        return;
      }

      setPhase("success");
      setProgressPct(100);
      // Auto-clear the local form a moment later and refresh the page so
      // the new row shows up in the list.
      setTimeout(() => {
        reset();
        router.refresh();
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setPhase("error");
    }
  }, [file, category, description, hrDocsOnly, reset, router]);

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    reset();
  };

  const isWorking =
    phase === "preparing" || phase === "uploading" || phase === "finalising";

  return (
    <div className="space-y-3">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          isDragOver
            ? "border-brand-500 bg-brand-50/60 dark:bg-brand-900/30"
            : "border-cream-300 bg-cream-100/40 dark:border-hairline-dark dark:bg-hairline-dark/20",
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            <UploadCloud className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="text-sm font-medium text-ink dark:text-cream-100">
            {file ? file.name : "Drag and drop a file here, or click to choose"}
          </p>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            Maximum 100 MB per file.
            {hrDocsOnly ? " HR Officer uploads are tagged as HR documents." : ""}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_HINT}
            className="hidden"
            onChange={onInputChange}
            disabled={isWorking}
          />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isWorking}
              className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={2} />
              Choose file
            </button>
            {file ? (
              <button
                type="button"
                onClick={cancelUpload}
                disabled={isWorking && phase !== "uploading"}
                className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
                {phase === "uploading" ? "Cancel upload" : "Clear"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {file ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {!hrDocsOnly ? (
            <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AdminFileCategory | "")}
                disabled={isWorking}
                className="w-full rounded-md border border-cream-300 bg-white px-3 py-1.5 text-sm font-normal text-ink disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              >
                <option value="">No category</option>
                {ADMIN_FILE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
              Category
              <p className="rounded-md border border-cream-300 bg-cream-100 px-3 py-1.5 text-sm font-normal text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/40 dark:text-cream-400">
                HR document (locked)
              </p>
            </div>
          )}
          <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400 sm:col-span-2">
            Description (optional)
            <input
              type="text"
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isWorking}
              placeholder="What is this file?"
              className="w-full rounded-md border border-cream-300 bg-white px-3 py-1.5 text-sm font-normal text-ink placeholder:text-ink-subtle disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400"
            />
          </label>
        </div>
      ) : null}

      {file && phase !== "success" ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-cream-200 bg-white px-4 py-3 text-sm dark:border-hairline-dark dark:bg-panel-dark">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink dark:text-cream-100">
              {file.name}
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {formatBytes(file.size)}
              {phase === "uploading" ? ` · uploading… ${progressPct}%` : ""}
              {phase === "preparing" ? " · preparing…" : ""}
              {phase === "finalising" ? " · finalising…" : ""}
              {phase === "error" ? " · upload failed" : ""}
            </p>
            {phase === "uploading" || phase === "finalising" ? (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${phase === "finalising" ? 100 : progressPct}%` }}
                />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={startUpload}
            disabled={isWorking}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {isWorking ? "Uploading…" : "Upload"}
          </button>
        </div>
      ) : null}

      {phase === "success" ? (
        <div className="flex items-center gap-2 rounded-md border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          Upload complete.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}
    </div>
  );
}
