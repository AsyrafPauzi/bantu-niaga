"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CsvSampleDownload } from "@/components/marketing/CsvSampleDownload";
import { CsvPreviewTable } from "@/components/marketing/CsvPreviewTable";
import {
  parseCsv,
  type ParsedRow,
  type ParseResult,
} from "@/lib/marketing/csv";
import type {
  CreateOutcome,
  MergeOutcome,
  RejectOutcome,
} from "@/lib/marketing/csv-classify";
import { cn } from "@/lib/utils/cn";

/**
 * <CsvImportWizard> — 3-step upload → preview → confirm flow.
 *
 * Step 1 — Upload
 *   Drag-and-drop area + file picker. On select, the file is parsed
 *   client-side just enough to show a row count + first-5-row sample.
 *   Submit POSTs multipart to /api/marketing/customers/csv-import.
 *
 * Step 2 — Preview
 *   Calls GET /api/marketing/customers/csv-import/[id]/preview, renders
 *   <CsvPreviewTable> with the categorized rows.
 *
 * Step 3 — Confirm
 *   Big "Commit N customers" button. On success, redirects to
 *   /marketing/customers?import=committed.
 */

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Step = "upload" | "preview" | "done";

interface PreviewResponse {
  summary: { total: number; created: number; merged: number; rejected: number };
  created: CreateOutcome[];
  merged: MergeOutcome[];
  rejected: RejectOutcome[];
  parse_errors?: Array<{ row_number: number; reason: string }>;
  delimiter?: string;
}

interface UploadResponse {
  import_id: string;
  file_size_bytes: number;
  uploaded_at: string;
  expires_at: string;
}

interface CommitResponse {
  action: "committed";
  import_id: string;
  created: number;
  merged: number;
  rejected: number;
  total: number;
  created_customer_ids: string[];
}

export function CsvImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [localParse, setLocalParse] = useState<ParseResult | null>(null);
  const [localParseError, setLocalParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setLocalParse(null);
    setLocalParseError(null);
    setError(null);
    setImportId(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    setLocalParseError(null);
    setLocalParse(null);
    if (f.size === 0) {
      setError("That file is empty.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(
        `File is ${(f.size / (1024 * 1024)).toFixed(2)} MB; the cap is 2 MB.`,
      );
      return;
    }
    setFile(f);
    try {
      const text = await f.text();
      const parsed = parseCsv(text);
      if (parsed.errors.length > 0 && parsed.rows.length === 0) {
        setLocalParseError(parsed.errors[0].reason);
      }
      setLocalParse(parsed);
    } catch (e) {
      setLocalParseError(
        e instanceof Error ? e.message : "Could not parse this file.",
      );
    }
  }, []);

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0] ?? null;
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  const submitUpload = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/marketing/customers/csv-import", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json().catch(() => null)) as
        | (UploadResponse & {
            error?: string;
            message?: string;
            in_flight_import_id?: string;
          })
        | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      if (!body?.import_id) {
        setError("Server did not return an import id.");
        return;
      }
      setImportId(body.import_id);
      await fetchPreview(body.import_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error during upload.");
    } finally {
      setBusy(false);
    }
  }, [file]);

  const fetchPreview = useCallback(async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/marketing/customers/csv-import/${id}/preview`,
        { cache: "no-store" },
      );
      const body = (await res.json().catch(() => null)) as
        | (PreviewResponse & { error?: string; message?: string })
        | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setPreview(body);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error during preview.");
    } finally {
      setBusy(false);
    }
  }, []);

  const submitCommit = useCallback(async () => {
    if (!importId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/marketing/customers/csv-import/${importId}/commit`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => null)) as
        | (CommitResponse & { error?: string; message?: string })
        | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setStep("done");
      // Brief pause so the operator sees the "committed" confirmation.
      setTimeout(() => {
        router.push(
          `/marketing/customers?import=committed&created=${body?.created ?? 0}`,
        );
        router.refresh();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error during commit.");
    } finally {
      setBusy(false);
    }
  }, [importId, router]);

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <ol className="flex items-center gap-4 text-sm">
        <StepDot
          active={step === "upload"}
          done={step !== "upload"}
          label="1. Upload"
        />
        <span className="h-px w-8 bg-cream-300 dark:bg-hairline-dark" />
        <StepDot
          active={step === "preview"}
          done={step === "done"}
          label="2. Preview"
        />
        <span className="h-px w-8 bg-cream-300 dark:bg-hairline-dark" />
        <StepDot active={step === "done"} done={false} label="3. Confirm" />
      </ol>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-status-danger/40 bg-[#F8DDD9] px-3 py-2 text-sm text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]"
        >
          {error}
        </div>
      )}

      {step === "upload" && (
        <UploadStep
          file={file}
          localParse={localParse}
          localParseError={localParseError}
          dragOver={dragOver}
          setDragOver={setDragOver}
          fileInput={fileInput}
          onPick={onPick}
          onDrop={onDrop}
          onSubmit={submitUpload}
          onReset={reset}
          busy={busy}
        />
      )}

      {step === "preview" && preview && (
        <PreviewStep
          preview={preview}
          onBack={reset}
          onCommit={submitCommit}
          busy={busy}
        />
      )}

      {step === "done" && (
        <Card>
          <CardBody className="space-y-2 py-6 text-center">
            <p className="text-lg font-semibold text-ink dark:text-cream-100">
              Import committed.
            </p>
            <p className="text-sm text-ink-muted dark:text-cream-400">
              Redirecting to the customer list…
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 1 — Upload
// ─────────────────────────────────────────────────────────────────────

function UploadStep({
  file,
  localParse,
  localParseError,
  dragOver,
  setDragOver,
  fileInput,
  onPick,
  onDrop,
  onSubmit,
  onReset,
  busy,
}: {
  file: File | null;
  localParse: ParseResult | null;
  localParseError: string | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileInput: React.MutableRefObject<HTMLInputElement | null>;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onSubmit: () => void;
  onReset: () => void;
  busy: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Upload your CSV</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragOver
              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/10"
              : "border-cream-300 dark:border-hairline-dark",
          )}
        >
          <p className="text-sm text-ink dark:text-cream-100">
            Drop a CSV file here, or
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            Choose a file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPick}
          />
          <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
            Max 2 MB / 5,000 rows. UTF-8 encoded.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted dark:text-cream-400">
          <span>
            Required columns: <code>name</code>, <code>phone</code>. Optional:{" "}
            <code>email</code>, <code>address</code>, <code>notes</code>,{" "}
            <code>manual_tags</code> (pipe- or semicolon-separated).
          </span>
          <CsvSampleDownload />
        </div>

        {file && (
          <div className="rounded-md border border-cream-200 bg-cream-100 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark">
            <p className="font-medium text-ink dark:text-cream-100">
              {file.name}{" "}
              <span className="text-ink-muted dark:text-cream-400">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </p>
            {localParseError ? (
              <p className="mt-1 text-status-danger">{localParseError}</p>
            ) : localParse ? (
              <p className="mt-1 text-ink-muted dark:text-cream-400">
                {localParse.total_data_rows} data rows detected (delimiter:{" "}
                <code>{localParse.delimiter}</code>).
              </p>
            ) : null}

            {localParse && localParse.rows.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-ink-muted dark:text-cream-400">
                      <th className="px-2 py-1">Row</th>
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Phone</th>
                      <th className="px-2 py-1">Email</th>
                      <th className="px-2 py-1">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localParse.rows.slice(0, 5).map((r: ParsedRow) => (
                      <tr key={r.row_number} className="text-ink dark:text-cream-100">
                        <td className="px-2 py-1 font-mono text-ink-muted dark:text-cream-400">
                          {r.row_number}
                        </td>
                        <td className="px-2 py-1">{r.name || <em>—</em>}</td>
                        <td className="px-2 py-1 font-mono">{r.phone || <em>—</em>}</td>
                        <td className="px-2 py-1">{r.email || <em>—</em>}</td>
                        <td className="px-2 py-1">
                          {r.manual_tags.length > 0 ? r.manual_tags.join(", ") : <em>—</em>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {localParse.rows.length > 5 && (
                  <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                    Showing first 5 of {localParse.rows.length}.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!file || busy || Boolean(localParseError)}
          >
            {busy ? "Uploading…" : "Upload and preview"}
          </Button>
          {file && (
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
              disabled={busy}
            >
              Choose a different file
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 2 — Preview
// ─────────────────────────────────────────────────────────────────────

function PreviewStep({
  preview,
  onBack,
  onCommit,
  busy,
}: {
  preview: PreviewResponse;
  onBack: () => void;
  onCommit: () => void;
  busy: boolean;
}) {
  const { summary } = preview;
  const nothingToCommit = summary.created === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>2. Review the import preview</CardTitle>
          <div className="flex gap-4 text-sm">
            <SummaryStat label="Total" value={summary.total} />
            <SummaryStat
              label="Created"
              value={summary.created}
              tone="success"
            />
            <SummaryStat label="Merged" value={summary.merged} tone="info" />
            <SummaryStat
              label="Rejected"
              value={summary.rejected}
              tone="danger"
            />
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {summary.rejected > 0 && (
          <div className="rounded-md border border-[#F5C97A] bg-[#FDF2DC] px-3 py-2 text-sm text-[#8C5C0A] dark:border-[#8C5C0A] dark:bg-[#3A2A0A] dark:text-[#F5C97A]">
            {summary.rejected} row{summary.rejected === 1 ? "" : "s"} will be
            skipped. Open the <strong>Rejected</strong> tab below for row
            numbers + reasons, then either fix and re-upload or proceed with
            only the <strong>{summary.created}</strong> valid customer
            {summary.created === 1 ? "" : "s"}.
          </div>
        )}

        <CsvPreviewTable
          created={preview.created}
          merged={preview.merged}
          rejected={preview.rejected}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cream-200 pt-4 dark:border-hairline-dark">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={busy}
          >
            ← Cancel and re-upload
          </Button>
          <Button
            type="button"
            onClick={onCommit}
            disabled={busy || nothingToCommit}
            data-action="commit"
          >
            {busy
              ? "Committing…"
              : nothingToCommit
                ? "Nothing to commit"
                : `Commit ${summary.created} customer${
                    summary.created === 1 ? "" : "s"
                  }`}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "info" | "danger";
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "success" && "text-[#1F5E1F] dark:text-[#A6D6A6]",
          tone === "info" && "text-[#1F4E6E] dark:text-[#9CC3DC]",
          tone === "danger" && "text-status-danger",
          !tone && "text-ink dark:text-cream-100",
        )}
      >
        {value}
      </span>
      <span className="text-xs uppercase tracking-wider text-ink-muted dark:text-cream-400">
        {label}
      </span>
    </div>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2",
        active
          ? "text-ink dark:text-cream-100"
          : "text-ink-muted dark:text-cream-400",
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
          active
            ? "border-brand-500 bg-brand-500 text-white"
            : done
              ? "border-brand-500 bg-brand-500/20 text-brand-700 dark:text-brand-300"
              : "border-cream-300 dark:border-hairline-dark",
        )}
      >
        {done ? "✓" : label.charAt(0)}
      </span>
      <span className="font-medium">{label}</span>
    </li>
  );
}
