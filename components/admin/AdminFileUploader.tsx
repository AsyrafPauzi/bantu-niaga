"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ADMIN_FILE_CATEGORIES,
  ADMIN_FILE_MAX_BYTES,
  type AdminFileCategory,
} from "@/lib/admin/schemas";
import { STORAGE_CATEGORY_LABELS } from "@/lib/admin/storage-shared";

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

interface QueuedFile {
  file: File;
  phase: Phase;
  progressPct: number;
  error: string | null;
}

interface ConfirmResponse {
  id: string;
}

export interface AdminStorageEmployeeOption {
  id: string;
  full_name: string;
  role_title: string;
}

interface UploaderProps {
  hrDocsOnly: boolean;
  defaultCategory?: AdminFileCategory | "";
  variant?: "default" | "hero";
  multiple?: boolean;
  employees?: AdminStorageEmployeeOption[];
  /** document types already on file per employee (with linked storage file). */
  employeeDocumentTypesByEmployeeId?: Record<string, string[]>;
}

const HR_DOCUMENT_TYPES = [
  { value: "ic", label: "IC" },
  { value: "passport", label: "Passport" },
  { value: "bank", label: "Bank" },
  { value: "medical", label: "Medical" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" },
] as const;

const ACCEPT_HINT = "image/*,application/pdf,.csv,.xlsx,.docx,.txt,.zip";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (file.size <= 0) return "That file is empty.";
  if (file.size > ADMIN_FILE_MAX_BYTES) {
    return `File too large (${formatBytes(file.size)}). Maximum upload size is 100 MB.`;
  }
  return null;
}

export function AdminFileUploader({
  hrDocsOnly,
  defaultCategory = "",
  variant = "default",
  multiple = false,
  employees = [],
  employeeDocumentTypesByEmployeeId = {},
}: UploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef(false);

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [category, setCategory] = useState<AdminFileCategory | "">(
    hrDocsOnly ? "hr_doc" : defaultCategory,
  );
  const [description, setDescription] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [documentType, setDocumentType] = useState<string>("other");
  const [isDragOver, setIsDragOver] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const needsHrLink = hrDocsOnly || category === "hr_doc";
  const activeEmployees = employees.filter((e) => e.id);

  const takenDocumentTypes = useMemo(() => {
    if (!employeeId) return new Set<string>();
    return new Set(employeeDocumentTypesByEmployeeId[employeeId] ?? []);
  }, [employeeId, employeeDocumentTypesByEmployeeId]);

  const availableDocumentTypes = useMemo(
    () => HR_DOCUMENT_TYPES.filter((type) => !takenDocumentTypes.has(type.value)),
    [takenDocumentTypes],
  );

  useEffect(() => {
    if (!needsHrLink || !employeeId) return;
    if (availableDocumentTypes.length === 0) return;
    if (!availableDocumentTypes.some((type) => type.value === documentType)) {
      setDocumentType(availableDocumentTypes[0]!.value);
    }
  }, [needsHrLink, employeeId, availableDocumentTypes, documentType]);

  const reset = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    abortRef.current = false;
    setQueue([]);
    setBatchBusy(false);
    setBatchError(null);
    setDescription("");
    setEmployeeId("");
    setDocumentType("other");
    if (!hrDocsOnly) setCategory("");
    if (inputRef.current) inputRef.current.value = "";
  }, [hrDocsOnly]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: QueuedFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const err = validateFile(file);
      if (err) {
        errors.push(`${file.name}: ${err}`);
        continue;
      }
      next.push({ file, phase: "idle", progressPct: 0, error: null });
    }
    if (errors.length > 0) setBatchError(errors.join(" "));
    else setBatchError(null);
    if (next.length === 0) return;
    setQueue((prev) => (multiple ? [...prev, ...next] : next));
  }, [multiple]);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) addFiles(event.target.files);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files?.length) {
      addFiles(
        multiple
          ? event.dataTransfer.files
          : [event.dataTransfer.files[0]!],
      );
    }
  };

  const uploadOne = async (
    item: QueuedFile,
    index: number,
  ): Promise<boolean> => {
    const updateItem = (patch: Partial<QueuedFile>) => {
      setQueue((prev) =>
        prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
      );
    };

    updateItem({ phase: "preparing", progressPct: 0, error: null });

    const fileLabel =
      description.trim() ||
      `${documentType.toUpperCase()} - ${item.file.name}`;

    try {
      const initRes = await fetch("/api/admin/storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          file_name: item.file.name,
          mime_type: item.file.type || "application/octet-stream",
          file_size_bytes: item.file.size,
          category: hrDocsOnly ? "hr_doc" : category || null,
          description: needsHrLink ? fileLabel : description.trim() || null,
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
        updateItem({ phase: "error", error: msg });
        return false;
      }

      const initBody = (await initRes.json()) as ApiEnvelope<UploadInitResponse>;
      const init = initBody.data;
      if (!init) {
        updateItem({ phase: "error", error: "Server did not return an upload URL." });
        return false;
      }

      updateItem({ phase: "uploading" });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", init.upload_url, true);
        xhr.setRequestHeader(
          "content-type",
          item.file.type || "application/octet-stream",
        );
        if (init.token) xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            updateItem({
              progressPct: Math.round((e.loaded / e.total) * 100),
            });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error("Upload failed — network error."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));
        xhr.send(item.file);
      });
      xhrRef.current = null;

      if (abortRef.current) return false;

      updateItem({ phase: "finalising", progressPct: 100 });

      const confirmRes = await fetch("/api/admin/storage/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storage_path: init.storage_path,
          file_name: item.file.name,
          mime_type: item.file.type || "application/octet-stream",
          file_size_bytes: item.file.size,
          category: hrDocsOnly ? "hr_doc" : category || null,
          description: needsHrLink ? fileLabel : description.trim() || null,
        }),
      });

      if (!confirmRes.ok) {
        const body = (await confirmRes.json().catch(() => null)) as
          | ApiEnvelope<unknown>
          | null;
        updateItem({
          phase: "error",
          error: body?.error?.message ?? "Could not finalise the upload.",
        });
        return false;
      }

      const confirmBody = (await confirmRes.json()) as ApiEnvelope<ConfirmResponse>;
      const adminFileId = confirmBody?.data?.id;

      if (needsHrLink && employeeId && adminFileId) {
        const linkRes = await fetch("/api/hr/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeId,
            document_type: documentType,
            label: fileLabel.slice(0, 160),
            admin_file_id: adminFileId,
          }),
        });
        if (!linkRes.ok) {
          const linkBody = (await linkRes.json().catch(() => null)) as {
            message?: string;
            error?: string;
          } | null;
          updateItem({
            phase: "error",
            error:
              linkBody?.message ??
              linkBody?.error ??
              "File uploaded but could not link to employee.",
          });
          return false;
        }
      }

      updateItem({ phase: "success", progressPct: 100 });
      return true;
    } catch (e) {
      if (abortRef.current) return false;
      updateItem({
        phase: "error",
        error: e instanceof Error ? e.message : "Upload failed.",
      });
      return false;
    }
  };

  const startUpload = useCallback(async () => {
    if (queue.length === 0) return;
    if (needsHrLink && !employeeId) {
      setBatchError("Choose which staff member this HR document belongs to.");
      return;
    }
    if (needsHrLink && activeEmployees.length === 0) {
      setBatchError("Add employees in HR first, then link HR documents here.");
      return;
    }
    if (needsHrLink && employeeId && availableDocumentTypes.length === 0) {
      setBatchError("This staff member already has all document types on file.");
      return;
    }
    setBatchError(null);
    setBatchBusy(true);
    abortRef.current = false;

    let anySuccess = false;
    for (let i = 0; i < queue.length; i++) {
      if (abortRef.current) break;
      const item = queue[i];
      if (item.phase === "success") {
        anySuccess = true;
        continue;
      }
      const ok = await uploadOne(item, i);
      if (ok) anySuccess = true;
    }

    setBatchBusy(false);
    if (anySuccess && !abortRef.current) {
      setTimeout(() => {
        reset();
        router.refresh();
      }, 600);
    }
  }, [
    queue,
    category,
    description,
    documentType,
    employeeId,
    needsHrLink,
    activeEmployees.length,
    availableDocumentTypes.length,
    hrDocsOnly,
    reset,
    router,
  ]);

  const cancelUpload = () => {
    abortRef.current = true;
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setBatchBusy(false);
    reset();
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const isWorking = batchBusy;
  const isHero = variant === "hero";
  const primaryFile = queue[0]?.file ?? null;
  const successCount = queue.filter((q) => q.phase === "success").length;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border-2 border-dashed text-center transition-all",
          isHero ? "p-8" : "rounded-lg p-6",
          isDragOver
            ? "scale-[1.01] border-brand-500 bg-brand-50/80 shadow-md dark:bg-brand-900/40"
            : isHero
              ? "border-brand-300/60 bg-white/70 dark:border-brand-700 dark:bg-panel-dark/50"
              : "border-cream-300 bg-cream-100/40 dark:border-hairline-dark dark:bg-hairline-dark/20",
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <span
            className={cn(
              "flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-violet-100 text-brand-700 dark:from-brand-900/60 dark:to-violet-900/40 dark:text-brand-200",
              isHero ? "h-14 w-14" : "h-12 w-12 rounded-full bg-brand-50 dark:bg-brand-900/40",
            )}
          >
            <UploadCloud className={isHero ? "h-7 w-7" : "h-6 w-6"} strokeWidth={2} />
          </span>
          <p
            className={cn(
              "font-medium text-ink dark:text-cream-100",
              isHero ? "text-base" : "text-sm",
            )}
          >
            {queue.length > 0
              ? multiple
                ? `${queue.length} file${queue.length === 1 ? "" : "s"} queued`
                : primaryFile?.name
              : multiple
                ? "Drag and drop files here, or click to choose"
                : "Drag and drop a file here, or click to choose"}
          </p>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            Maximum 100 MB per file.
            {multiple ? " Bulk upload supported." : ""}
            {hrDocsOnly ? " HR Officer uploads are tagged as HR documents." : ""}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_HINT}
            multiple={multiple}
            className="hidden"
            onChange={onInputChange}
            disabled={isWorking}
          />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isWorking}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold disabled:opacity-50",
                isHero
                  ? "border-brand-400 bg-brand-500 text-white shadow-sm hover:bg-brand-600"
                  : "border-cream-300 bg-white text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
              )}
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={2} />
              {multiple ? "Choose files" : "Choose file"}
            </button>
            {queue.length > 0 ? (
              <button
                type="button"
                onClick={cancelUpload}
                disabled={isWorking && !batchBusy}
                className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
                {batchBusy ? "Cancel upload" : "Clear"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

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
                  {STORAGE_CATEGORY_LABELS[c]}
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

        {needsHrLink ? (
          <>
            <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
              Staff member
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={isWorking || activeEmployees.length === 0}
                required
                className="w-full rounded-md border border-cream-300 bg-white px-3 py-1.5 text-sm font-normal text-ink disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              >
                <option value="">Choose staff…</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                    {employee.role_title ? ` · ${employee.role_title}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
              Document type
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={
                  isWorking ||
                  !employeeId ||
                  availableDocumentTypes.length === 0
                }
                className="w-full rounded-md border border-cream-300 bg-white px-3 py-1.5 text-sm font-normal text-ink disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              >
                {availableDocumentTypes.length === 0 ? (
                  <option value="">All types on file</option>
                ) : (
                  availableDocumentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))
                )}
              </select>
            </label>
            {employeeId && availableDocumentTypes.length === 0 ? (
              <p className="sm:col-span-2 text-xs text-ink-muted dark:text-cream-400">
                This staff member already has IC, passport, bank, medical, contract,
                and other documents on file.
              </p>
            ) : null}
            {activeEmployees.length === 0 ? (
              <p className="sm:col-span-2 text-xs text-amber-800 dark:text-amber-200">
                No employees found. Add staff in{" "}
                <Link href="/hr/employees" className="font-semibold underline">
                  HR → Employees
                </Link>{" "}
                first.
              </p>
            ) : null}
          </>
        ) : null}

        {queue.length > 0 ? (
          <label className="space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400 sm:col-span-2">
            Description (optional{multiple ? ", applies to all" : ""})
            <input
              type="text"
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isWorking}
              placeholder={
                needsHrLink
                  ? "Optional label — defaults to document type + file name"
                  : "What are these files?"
              }
              className="w-full rounded-md border border-cream-300 bg-white px-3 py-1.5 text-sm font-normal text-ink placeholder:text-ink-subtle disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400"
            />
          </label>
        ) : null}
      </div>

      {queue.length > 0 ? (
        <ul className="space-y-2">
          {queue.map((item, index) => (
            <li
              key={`${item.file.name}-${index}`}
              className="flex items-center justify-between gap-3 rounded-md border border-cream-200 bg-white px-4 py-3 text-sm dark:border-hairline-dark dark:bg-panel-dark"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink dark:text-cream-100">
                  {item.file.name}
                </p>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  {formatBytes(item.file.size)}
                  {item.phase === "uploading"
                    ? ` · uploading… ${item.progressPct}%`
                    : ""}
                  {item.phase === "preparing" ? " · preparing…" : ""}
                  {item.phase === "finalising" ? " · finalising…" : ""}
                  {item.phase === "success" ? " · done" : ""}
                  {item.phase === "error" ? ` · ${item.error}` : ""}
                </p>
                {item.phase === "uploading" || item.phase === "finalising" ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
                    <div
                      className="h-full bg-brand-500 transition-all"
                      style={{
                        width: `${item.phase === "finalising" ? 100 : item.progressPct}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
              {!batchBusy && item.phase !== "success" ? (
                <button
                  type="button"
                  onClick={() => removeFromQueue(index)}
                  className="shrink-0 text-xs font-semibold text-ink-muted hover:text-ink"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {queue.length > 0 && successCount < queue.length ? (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => void startUpload()}
            disabled={isWorking}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {isWorking
              ? `Uploading… (${successCount}/${queue.length})`
              : `Upload ${queue.length} file${queue.length === 1 ? "" : "s"}`}
          </button>
        </div>
      ) : null}

      {successCount === queue.length && queue.length > 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          {queue.length === 1 ? "Upload complete." : `All ${queue.length} uploads complete.`}
        </div>
      ) : null}

      {batchError ? (
        <div className="rounded-md border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {batchError}
        </div>
      ) : null}
    </div>
  );
}
