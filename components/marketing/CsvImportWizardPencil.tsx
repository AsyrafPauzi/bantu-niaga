"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { CsvSampleDownload } from "@/components/marketing/CsvSampleDownload";
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
 * Pencil-aligned CSV import wizard. Same API contract as
 * <CsvImportWizard> but matches the Pencil layout:
 *   - 4-step stepper (Upload → Map → Preview & dedupe → Import)
 *   - Colored stat cards
 *   - Custom preview table with per-row status pill + action
 *   - "Back to Mapping" / "Import N customers" footer
 */

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Step = "upload" | "preview" | "done";
type Filter = "all" | "ready" | "dup" | "invalid";

interface PreviewResponse {
  summary: {
    total: number;
    created: number;
    merged: number;
    rejected: number;
  };
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

export function CsvImportWizardPencil() {
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
  const [filter, setFilter] = useState<Filter>("all");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setLocalParse(null);
    setLocalParseError(null);
    setError(null);
    setImportId(null);
    setPreview(null);
    setFilter("all");
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
  }, [file, fetchPreview]);

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
    <div className="space-y-5">
      {/* Stepper */}
      <PencilStepper step={step} />

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
          filter={filter}
          setFilter={setFilter}
          onBack={reset}
          onCommit={submitCommit}
          busy={busy}
        />
      )}

      {step === "done" && (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-8 text-center">
          <CheckCircle2
            className="mx-auto mb-2 h-10 w-10 text-status-success"
            strokeWidth={1.5}
          />
          <p className="text-lg font-semibold text-ink dark:text-cream-100">
            Import committed
          </p>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Redirecting to the customer list…
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────

function PencilStepper({ step }: { step: Step }) {
  const steps = [
    { id: "upload", num: 1, label: "Upload" },
    { id: "map", num: 2, label: "Map columns" },
    { id: "preview", num: 3, label: "Preview & dedupe" },
    { id: "import", num: 4, label: "Import" },
  ] as const;

  function stateFor(id: (typeof steps)[number]["id"]): "done" | "active" | "next" {
    if (step === "upload") {
      if (id === "upload") return "active";
      return "next";
    }
    if (step === "preview") {
      if (id === "upload" || id === "map") return "done";
      if (id === "preview") return "active";
      return "next";
    }
    // done
    return id === "import" ? "active" : "done";
  }

  return (
    <ol className="flex items-center gap-1 rounded-xl border border-cream-200 bg-white p-3 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-4">
      {steps.map((s, i) => {
        const state = stateFor(s.id);
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                state === "done"
                  ? "bg-status-success text-white"
                  : state === "active"
                    ? "bg-brand-500 text-white"
                    : "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
              )}
            >
              {state === "done" ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                s.num
              )}
            </span>
            <span
              className={cn(
                "hidden text-xs font-semibold sm:inline",
                state === "active"
                  ? "text-ink dark:text-cream-100"
                  : state === "done"
                    ? "text-status-success"
                    : "text-ink-muted dark:text-cream-400",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "h-0.5 flex-1",
                  state === "done"
                    ? "bg-status-success"
                    : "bg-cream-200 dark:bg-hairline-dark",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Upload step
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
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-ink dark:text-cream-100">
          Upload your CSV
        </h3>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          Up to 2 MB / 5,000 rows. UTF-8 encoded. Required columns:{" "}
          <code className="font-mono text-xs">name</code>,{" "}
          <code className="font-mono text-xs">phone</code>.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors",
          dragOver
            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/10"
            : "border-cream-300 bg-white dark:border-hairline-dark dark:bg-panel-dark",
        )}
      >
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Upload className="h-6 w-6" strokeWidth={2} />
        </span>
        <p className="text-sm font-semibold text-ink dark:text-cream-100">
          Drop a CSV file here, or
        </p>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-600 disabled:opacity-50"
        >
          Choose a file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onPick}
        />
        <p className="mt-3 text-xs text-ink-muted dark:text-cream-400">
          Max 2 MB / 5,000 rows · UTF-8
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted dark:text-cream-400">
        <span>
          Optional columns: <code className="font-mono">email</code>,{" "}
          <code className="font-mono">address</code>,{" "}
          <code className="font-mono">notes</code>,{" "}
          <code className="font-mono">manual_tags</code> (pipe- or
          semicolon-separated).
        </span>
        <CsvSampleDownload />
      </div>

      {file && (
        <div className="rounded-xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-start gap-3">
            <FileText
              className="h-5 w-5 shrink-0 text-brand-700 dark:text-brand-200"
              strokeWidth={2}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                {file.name}{" "}
                <span className="font-normal text-ink-muted dark:text-cream-400">
                  · {(file.size / 1024).toFixed(1)} KB
                </span>
              </p>
              {localParseError ? (
                <p className="mt-1 text-xs text-status-danger">
                  {localParseError}
                </p>
              ) : localParse ? (
                <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                  {localParse.total_data_rows} data rows · delimiter{" "}
                  <code className="font-mono">{localParse.delimiter}</code>
                </p>
              ) : null}
            </div>
          </div>

          {localParse && localParse.rows.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-cream-200 dark:border-hairline-dark">
              <table className="min-w-full text-xs">
                <thead className="bg-cream-100/60 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
                  {localParse.rows.slice(0, 5).map((r: ParsedRow) => (
                    <tr key={r.row_number} className="text-ink dark:text-cream-100">
                      <td className="px-3 py-1.5 font-mono text-ink-muted dark:text-cream-400">
                        {r.row_number}
                      </td>
                      <td className="px-3 py-1.5">{r.name || <em>—</em>}</td>
                      <td className="px-3 py-1.5 font-mono">
                        {r.phone || <em>—</em>}
                      </td>
                      <td className="px-3 py-1.5">{r.email || <em>—</em>}</td>
                      <td className="px-3 py-1.5">
                        {r.manual_tags.length > 0 ? (
                          r.manual_tags.join(", ")
                        ) : (
                          <em>—</em>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {localParse.rows.length > 5 && (
                <p className="border-t border-cream-200 bg-cream-50 px-3 py-1.5 text-[11px] text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400">
                  Showing first 5 of {localParse.rows.length} rows. Click
                  &quot;Upload and preview&quot; to validate the rest.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {file && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            Choose a different file
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!file || busy || Boolean(localParseError)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Upload and preview"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Preview step
// ─────────────────────────────────────────────────────────────────────

interface CombinedRow {
  rowNumber: number;
  name: string;
  phone: string;
  email: string;
  tags: string;
  status: "ready" | "merge" | "reject";
  reason: string;
}

function PreviewStep({
  preview,
  filter,
  setFilter,
  onBack,
  onCommit,
  busy,
}: {
  preview: PreviewResponse;
  filter: Filter;
  setFilter: (f: Filter) => void;
  onBack: () => void;
  onCommit: () => void;
  busy: boolean;
}) {
  const { summary } = preview;
  const dupCount = preview.rejected.filter((r) =>
    r.reason.toLowerCase().includes("duplicate"),
  ).length;
  const invalidCount = preview.rejected.length - dupCount;
  const nothingToCommit = summary.created === 0 && summary.merged === 0;

  // Combine all rows for the table.
  const allRows: CombinedRow[] = [
    ...preview.created.map<CombinedRow>((r) => ({
      rowNumber: r.row_number,
      name: r.name,
      phone: r.phone_e164,
      email: r.email ?? "",
      tags: r.manual_tags.join(", "),
      status: "ready",
      reason: "",
    })),
    ...preview.merged.map<CombinedRow>((r) => ({
      rowNumber: r.row_number,
      name: r.name,
      phone: r.phone_e164,
      email: "",
      tags: "",
      status: "merge",
      reason: `Will merge into existing customer (${r.existing_name})`,
    })),
    ...preview.rejected.map<CombinedRow>((r) => ({
      rowNumber: r.row_number,
      name: r.name,
      phone: r.phone,
      email: "",
      tags: "",
      status: "reject",
      reason: r.reason,
    })),
  ].sort((a, b) => a.rowNumber - b.rowNumber);

  const filtered = allRows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "ready") return r.status === "ready" || r.status === "merge";
    if (filter === "dup")
      return (
        r.status === "merge" ||
        (r.status === "reject" && r.reason.toLowerCase().includes("duplicate"))
      );
    if (filter === "invalid")
      return r.status === "reject" && !r.reason.toLowerCase().includes("duplicate");
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold text-ink dark:text-cream-100">
          Preview &amp; dedupe
        </h3>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          We found {summary.total} customers in your file. Review duplicates
          and validation issues before importing.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Ready to import"
          value={summary.created}
          tone="success"
          icon={CheckCircle2}
        />
        <StatCard
          label="Possible duplicates"
          value={summary.merged + dupCount}
          tone="warning"
          icon={AlertTriangle}
        />
        <StatCard
          label="Invalid phone"
          value={invalidCount}
          tone="danger"
          icon={X}
        />
        <StatCard
          label="Total rows"
          value={summary.total}
          tone="info"
          icon={FileText}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        {/* Filter chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 p-3 dark:border-hairline-dark">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Chip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              count={allRows.length}
            >
              All rows
            </Chip>
            <Chip
              active={filter === "ready"}
              onClick={() => setFilter("ready")}
              count={summary.created + summary.merged}
              tone="success"
            >
              Ready
            </Chip>
            <Chip
              active={filter === "dup"}
              onClick={() => setFilter("dup")}
              count={summary.merged + dupCount}
              tone="warning"
            >
              Duplicates
            </Chip>
            <Chip
              active={filter === "invalid"}
              onClick={() => setFilter("invalid")}
              count={invalidCount}
              tone="danger"
            >
              Invalid
            </Chip>
          </div>
          <button
            type="button"
            disabled
            title="Bulk action ships in M7"
            className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-muted opacity-50 dark:border-hairline-dark dark:bg-panel-dark"
          >
            <Download className="h-3 w-3" strokeWidth={2} />
            Auto-resolve duplicates
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-cream-100/60 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
              <tr>
                <th className="px-4 py-2.5 text-left">Row</th>
                <th className="px-4 py-2.5 text-left">Customer</th>
                <th className="px-4 py-2.5 text-left">Phone</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Note</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-ink-muted dark:text-cream-400"
                  >
                    No rows match this filter.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 50).map((r) => (
                  <tr
                    key={r.rowNumber}
                    className="bg-panel-light dark:bg-panel-dark"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-ink-muted dark:text-cream-400">
                      {r.rowNumber}
                    </td>
                    <td className="px-4 py-2">
                      <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                        {r.name || <em className="font-normal">—</em>}
                      </p>
                      {r.email ? (
                        <p className="truncate text-[11px] text-ink-muted dark:text-cream-400">
                          {r.email}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-ink-muted dark:text-cream-400">
                      {r.phone || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <RowStatus status={r.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-muted dark:text-cream-400">
                      {r.reason || "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <RowAction status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filtered.length > 50 ? (
            <p className="border-t border-cream-200 bg-cream-50 px-4 py-2 text-[11px] text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400">
              Showing first 50 of {filtered.length} rows. Commit imports them
              all.
            </p>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to Upload
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {summary.created} new ·{" "}
            <span className="font-semibold">{summary.merged}</span> merged ·{" "}
            <span className="font-semibold">{summary.rejected}</span> skipped
          </p>
          <button
            type="button"
            onClick={onCommit}
            disabled={busy || nothingToCommit}
            data-action="commit"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
          >
            {busy
              ? "Committing…"
              : nothingToCommit
                ? "Nothing to commit"
                : `Import ${summary.created + summary.merged} customer${
                    summary.created + summary.merged === 1 ? "" : "s"
                  }`}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "info";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const styles = {
    success: {
      bg: "bg-status-success/10",
      border: "border-status-success/30",
      text: "text-status-success",
    },
    warning: {
      bg: "bg-status-warning/15",
      border: "border-status-warning/30",
      text: "text-[#8C5C0A] dark:text-[#F5C97A]",
    },
    danger: {
      bg: "bg-status-danger/10",
      border: "border-status-danger/30",
      text: "text-status-danger",
    },
    info: {
      bg: "bg-brand-50 dark:bg-brand-900/30",
      border: "border-brand-200 dark:border-brand-800",
      text: "text-brand-700 dark:text-brand-200",
    },
  }[tone];
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        styles.bg,
        styles.border,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md bg-white/60 dark:bg-black/20",
            styles.text,
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <p
        className={cn("mt-2.5 text-2xl font-bold tabular-nums", styles.text)}
      >
        {value.toLocaleString("en-MY")}
      </p>
      <p className="text-xs font-semibold text-ink dark:text-cream-100">
        {label}
      </p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  count,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  tone?: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const toneText = tone
    ? tone === "success"
      ? "text-status-success"
      : tone === "warning"
        ? "text-[#8C5C0A] dark:text-[#F5C97A]"
        : "text-status-danger"
    : "text-ink-muted dark:text-cream-400";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-colors",
        active
          ? "bg-brand-500 text-white"
          : "border border-cream-300 bg-white hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:hover:bg-hairline-dark/60",
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          "tabular-nums",
          active ? "text-white/90" : toneText,
        )}
      >
        {count}
      </span>
    </button>
  );
}

function RowStatus({ status }: { status: CombinedRow["status"] }) {
  const map = {
    ready: {
      label: "Ready",
      cx: "bg-status-success/10 text-status-success",
    },
    merge: {
      label: "Merge",
      cx: "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]",
    },
    reject: {
      label: "Skip",
      cx: "bg-status-danger/10 text-status-danger",
    },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        map.cx,
      )}
    >
      {map.label}
    </span>
  );
}

function RowAction({ status }: { status: CombinedRow["status"] }) {
  if (status === "ready")
    return (
      <button
        type="button"
        disabled
        className="text-[11px] font-semibold text-status-success opacity-80"
      >
        Add
      </button>
    );
  if (status === "merge")
    return (
      <button
        type="button"
        disabled
        className="text-[11px] font-semibold text-[#8C5C0A] opacity-80 dark:text-[#F5C97A]"
      >
        Merge
      </button>
    );
  return (
    <button
      type="button"
      disabled
      className="text-[11px] font-semibold text-status-danger opacity-80"
    >
      Skip
    </button>
  );
}
