"use client";

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import {
  type ComplianceUploadedFile,
  uploadComplianceLicenceDocument,
} from "@/lib/admin/compliance-upload-client";
import { cn } from "@/lib/utils/cn";

const ACCEPT_HINT = "image/*,application/pdf,.docx,.txt";

interface ComplianceLicenceUploaderProps {
  licenceTitle: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  compact?: boolean;
  onUploaded: (file: ComplianceUploadedFile) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComplianceLicenceUploader({
  licenceTitle,
  label = "Certificate or policy document",
  hint = "PDF or image — saved to Admin Storage under Compliance.",
  disabled = false,
  compact = false,
  onUploaded,
}: ComplianceLicenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setUploading(false);
    setProgressPct(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleFile = useCallback((next: File) => {
    setError(null);
    setDoneName(null);
    setFile(next);
  }, []);

  const startUpload = useCallback(async () => {
    if (!file || uploading || disabled) return;
    setUploading(true);
    setError(null);
    setProgressPct(0);
    try {
      const uploaded = await uploadComplianceLicenceDocument(
        file,
        licenceTitle,
        setProgressPct,
      );
      setDoneName(uploaded.file_name);
      onUploaded(uploaded);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [disabled, file, licenceTitle, onUploaded, reset, uploading]);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-ink dark:text-cream-100">{label}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-lg border-2 border-dashed text-center transition-colors",
          compact ? "p-3" : "p-4",
          isDragOver
            ? "border-brand-500 bg-brand-50/60 dark:bg-brand-900/30"
            : "border-cream-300 bg-cream-50/40 dark:border-hairline-dark dark:bg-hairline-dark/20",
          disabled && "opacity-60",
        )}
      >
        <div className="flex flex-col items-center gap-1.5">
          <UploadCloud className="h-5 w-5 text-brand-600 dark:text-brand-300" />
          <p className="text-xs font-medium text-ink dark:text-cream-100">
            {file ? file.name : "Drop file here or choose"}
          </p>
          <p className="text-[11px] text-ink-muted dark:text-cream-400">{hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_HINT}
            className="hidden"
            disabled={disabled || uploading}
            onChange={onInputChange}
          />
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <FileText className="h-3 w-3" />
              Choose file
            </button>
            {file ? (
              <button
                type="button"
                disabled={uploading}
                onClick={reset}
                className="inline-flex items-center gap-1 rounded-md border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-ink-muted dark:border-hairline-dark"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {file ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-cream-200 bg-white px-3 py-2 text-xs dark:border-hairline-dark dark:bg-panel-dark">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink dark:text-cream-100">
              {file.name}
            </p>
            <p className="text-ink-muted dark:text-cream-400">
              {formatBytes(file.size)}
              {uploading ? ` · ${progressPct}%` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={uploading || disabled}
            onClick={() => void startUpload()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : null}
            Upload
          </button>
        </div>
      ) : null}

      {doneName ? (
        <p className="flex items-center gap-1.5 text-xs text-status-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Uploaded {doneName}
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-status-danger">{error}</p>
      ) : null}
    </div>
  );
}
