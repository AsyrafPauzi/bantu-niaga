"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  History,
  ListTodo,
  Loader2,
  Paperclip,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { ComplianceLicenceUploader } from "@/components/admin/ComplianceLicenceUploader";
import { openAdminFileDownload } from "@/lib/admin/compliance-upload-client";
import {
  ADMIN_COMPLIANCE_CATEGORIES,
  categoryLabel,
  type AdminComplianceCategory,
  type AdminComplianceRenewalEvent,
  type AdminComplianceRow,
} from "@/lib/admin/task-compliance-schemas";
import {
  CATEGORY_STYLE,
  COMPLIANCE_REMIND_DAY_OPTIONS,
  DEFAULT_COMPLIANCE_REMIND_DAYS,
} from "@/lib/admin/compliance-shared";
import { cn } from "@/lib/utils/cn";

interface AdminComplianceDetailModalProps {
  item: AdminComplianceRow;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: Partial<AdminComplianceRow> & { next_expires_on?: string; status?: "renewed" }) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreateTask: () => Promise<{
    task_url?: string;
    message?: string;
    duplicate?: boolean;
  } | void>;
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminComplianceDetailModal({
  item,
  busy,
  onClose,
  onSave,
  onDelete,
  onCreateTask,
}: AdminComplianceDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [authority, setAuthority] = useState(item.authority ?? "");
  const [referenceNumber, setReferenceNumber] = useState(item.reference_number ?? "");
  const [expiresOn, setExpiresOn] = useState(item.expires_on);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [remindDays, setRemindDays] = useState<number[]>(
    item.remind_days?.length ? item.remind_days : [...DEFAULT_COMPLIANCE_REMIND_DAYS],
  );
  const [adminFileId, setAdminFileId] = useState<string | null>(item.admin_file_id);
  const [adminFileName, setAdminFileName] = useState<string | null>(
    item.admin_file_name ?? null,
  );
  const [renewOpen, setRenewOpen] = useState(false);
  const [nextExpiry, setNextExpiry] = useState("");
  const [renewFileId, setRenewFileId] = useState<string | null>(null);
  const [renewFileName, setRenewFileName] = useState<string | null>(null);
  const [renewals, setRenewals] = useState<AdminComplianceRenewalEvent[]>([]);
  const [renewalsLoading, setRenewalsLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [taskNotice, setTaskNotice] = useState<{
    message: string;
    url?: string;
    duplicate?: boolean;
  } | null>(null);

  const style = CATEGORY_STYLE[item.category];
  const Icon = style.icon;
  const days = item.days_until_expiry ?? 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => {
    let cancelled = false;
    setRenewalsLoading(true);
    void fetch(`/api/admin/compliance/${item.id}/renewals`)
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: AdminComplianceRenewalEvent[] }) => {
        if (!cancelled && json.ok && json.data) setRenewals(json.data);
      })
      .finally(() => {
        if (!cancelled) setRenewalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const toggleRemindDay = useCallback((day: number) => {
    setRemindDays((prev) => {
      if (prev.includes(day)) {
        const next = prev.filter((d) => d !== day);
        return next.length > 0 ? next : [day];
      }
      return [...prev, day].sort((a, b) => b - a);
    });
  }, []);

  const handleSave = useCallback(async () => {
    setLocalError(null);
    try {
      await onSave({
        title,
        category,
        authority: authority || null,
        reference_number: referenceNumber || null,
        expires_on: expiresOn,
        notes: notes || null,
        remind_days: remindDays,
        admin_file_id: adminFileId,
      });
      setEditing(false);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Save failed.");
    }
  }, [
    adminFileId,
    authority,
    category,
    expiresOn,
    notes,
    onSave,
    referenceNumber,
    remindDays,
    title,
  ]);

  const handleRenew = useCallback(async () => {
    if (!nextExpiry) {
      setLocalError("Enter the next expiry date.");
      return;
    }
    if (!renewFileId) {
      setLocalError("Upload the renewed certificate or policy before confirming.");
      return;
    }
    setLocalError(null);
    try {
      await onSave({
        status: "renewed",
        next_expires_on: nextExpiry,
        admin_file_id: renewFileId,
      });
      setAdminFileId(renewFileId);
      setAdminFileName(renewFileName);
      setRenewOpen(false);
      setNextExpiry("");
      setRenewFileId(null);
      setRenewFileName(null);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Renewal failed.");
    }
  }, [nextExpiry, onSave, renewFileId, renewFileName]);

  const attachDocument = useCallback(
    async (file: { id: string; file_name: string }) => {
      setLocalError(null);
      try {
        await onSave({ admin_file_id: file.id });
        setAdminFileId(file.id);
        setAdminFileName(file.file_name);
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : "Could not attach file.");
      }
    },
    [onSave],
  );

  const handleCreateTask = useCallback(async () => {
    setLocalError(null);
    try {
      const result = await onCreateTask();
      if (result?.message || result?.task_url) {
        setTaskNotice({
          message: result.message ?? "Task added to your board.",
          url: result.task_url,
          duplicate: result.duplicate,
        });
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Could not create task.");
    }
  }, [onCreateTask]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compliance-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(92vh,760px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-cream-200 bg-white shadow-elevated dark:border-hairline-dark dark:bg-panel-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                item.urgency === "overdue"
                  ? "bg-status-danger/10 text-status-danger"
                  : item.urgency === "soon"
                    ? "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]"
                    : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700/80 dark:text-brand-200/80">
                Licence details
              </p>
              <h2
                id="compliance-detail-title"
                className="mt-1 text-lg font-bold text-ink dark:text-cream-100"
              >
                {item.title}
              </h2>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                {categoryLabel(item.category)}
                {item.authority ? ` · ${item.authority}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/60"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {!editing ? (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-cream-200 bg-cream-50/60 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
                  <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                    <Calendar className="h-3.5 w-3.5" />
                    Expires
                  </dt>
                  <dd
                    className={cn(
                      "mt-1 font-semibold",
                      item.urgency === "overdue"
                        ? "text-status-danger"
                        : item.urgency === "soon"
                          ? "text-[#8C5C0A] dark:text-[#F5C97A]"
                          : "text-ink dark:text-cream-100",
                    )}
                  >
                    {fmtDate(item.expires_on)}
                    {days < 0
                      ? ` · ${Math.abs(days)}d overdue`
                      : days === 0
                        ? " · today"
                        : ` · ${days}d left`}
                  </dd>
                </div>
                <div className="rounded-lg border border-cream-200 bg-cream-50/60 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
                  <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                    <Bell className="h-3.5 w-3.5" />
                    Reminders
                  </dt>
                  <dd className="mt-1 font-semibold text-ink dark:text-cream-100">
                    {(item.remind_days ?? [...DEFAULT_COMPLIANCE_REMIND_DAYS])
                      .sort((a, b) => b - a)
                      .map((d) => `${d}d`)
                      .join(", ")}{" "}
                    before
                  </dd>
                </div>
                {item.reference_number ? (
                  <div className="rounded-lg border border-cream-200 bg-cream-50/60 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                      Reference
                    </dt>
                    <dd className="mt-1 font-semibold text-ink dark:text-cream-100">
                      {item.reference_number}
                    </dd>
                  </div>
                ) : null}
                {item.last_renewed_at ? (
                  <div className="rounded-lg border border-cream-200 bg-cream-50/60 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                      Last renewed
                    </dt>
                    <dd className="mt-1 font-semibold text-ink dark:text-cream-100">
                      {fmtDate(item.last_renewed_at.slice(0, 10))}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {item.notes ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink dark:text-cream-100">
                    {item.notes}
                  </p>
                </div>
              ) : null}

              {adminFileId ? (
                <div className="flex items-center gap-2 rounded-lg border border-cream-200 bg-cream-50/60 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/20">
                  <Paperclip className="h-4 w-4 shrink-0 text-ink-muted" />
                  <span className="min-w-0 truncate font-medium text-ink dark:text-cream-100">
                    {adminFileName ?? "Certificate on file"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void openAdminFileDownload(adminFileId).catch((e) =>
                        setLocalError(
                          e instanceof Error ? e.message : "Download failed.",
                        ),
                      )
                    }
                    className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-status-warning/35 bg-status-warning/10 px-3 py-2.5 text-sm">
                  <p className="flex items-center gap-1.5 font-medium text-[#8C5C0A] dark:text-[#F5C97A]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    No certificate uploaded yet
                  </p>
                  <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                    Upload the SSM cert, policy PDF, or permit scan so you have
                    proof on file.
                  </p>
                  <div className="mt-3">
                    <ComplianceLicenceUploader
                      licenceTitle={item.title}
                      compact
                      disabled={busy}
                      onUploaded={(f) => void attachDocument(f)}
                    />
                  </div>
                </div>
              )}

              {taskNotice ? (
                <p
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    taskNotice.duplicate
                      ? "border-status-warning/35 bg-status-warning/10 text-[#8C5C0A] dark:text-[#F5C97A]"
                      : "border-status-success/30 bg-status-success/10 text-status-success",
                  )}
                >
                  {taskNotice.message}{" "}
                  {taskNotice.url ? (
                    <Link href={taskNotice.url} className="font-semibold underline">
                      View on task board
                    </Link>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink dark:text-cream-100">
                  Name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink dark:text-cream-100">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as AdminComplianceCategory)
                    }
                    className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
                  >
                    {ADMIN_COMPLIANCE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink dark:text-cream-100">
                    Expiry date
                  </label>
                  <input
                    type="date"
                    value={expiresOn}
                    onChange={(e) => setExpiresOn(e.target.value)}
                    className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink dark:text-cream-100">
                    Authority
                  </label>
                  <input
                    type="text"
                    value={authority}
                    onChange={(e) => setAuthority(e.target.value)}
                    className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink dark:text-cream-100">
                    Reference no.
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink dark:text-cream-100">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ink dark:text-cream-100">
                  In-app reminders
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPLIANCE_REMIND_DAY_OPTIONS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleRemindDay(day)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                        remindDays.includes(day)
                          ? "border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-600 dark:bg-brand-900/40 dark:text-brand-100"
                          : "border-cream-300 text-ink-muted dark:border-hairline-dark dark:text-cream-400",
                      )}
                    >
                      {day} days
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ink dark:text-cream-100">
                  Certificate document
                </label>
                {adminFileId ? (
                  <div className="flex items-center gap-2 rounded-lg border border-cream-200 bg-cream-50/60 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-hairline-dark/20">
                    <FileText className="h-4 w-4 text-ink-muted" />
                    <span className="min-w-0 flex-1 truncate">{adminFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminFileId(null);
                        setAdminFileName(null);
                      }}
                      className="text-xs font-semibold text-status-danger"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                <ComplianceLicenceUploader
                  licenceTitle={title}
                  label={adminFileId ? "Replace certificate" : "Upload certificate"}
                  compact
                  disabled={busy}
                  onUploaded={(f) => {
                    setAdminFileId(f.id);
                    setAdminFileName(f.file_name);
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              <History className="h-3.5 w-3.5" />
              Renewal history
            </p>
            {renewalsLoading ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </p>
            ) : renewals.length === 0 ? (
              <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
                No renewals logged yet. Mark renewed to record history.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {renewals.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-cream-200 px-3 py-2 text-xs dark:border-hairline-dark"
                  >
                    <span className="text-ink dark:text-cream-100">
                      {fmtDate(ev.previous_expires_on)} → {fmtDate(ev.new_expires_on)}
                      {ev.admin_file_name ? ` · ${ev.admin_file_name}` : ""}
                    </span>
                    <span className="shrink-0 text-ink-muted dark:text-cream-400">
                      {fmtDateTime(ev.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {renewOpen ? (
            <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-800 dark:bg-brand-700/20">
              <label className="text-xs font-semibold text-ink dark:text-cream-100">
                Next expiry date
              </label>
              <input
                type="date"
                value={nextExpiry}
                onChange={(e) => setNextExpiry(e.target.value)}
                className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
              />
              <ComplianceLicenceUploader
                licenceTitle={item.title}
                label="Upload renewed certificate"
                hint="Required — attach the new SSM cert, policy, or permit scan."
                compact
                disabled={busy}
                onUploaded={(f) => {
                  setRenewFileId(f.id);
                  setRenewFileName(f.file_name);
                }}
              />
              {renewFileName ? (
                <p className="text-xs text-status-success">
                  Ready: {renewFileName}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRenew()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Confirm renewal
                </button>
                <button
                  type="button"
                onClick={() => {
                  setRenewOpen(false);
                  setNextExpiry("");
                  setRenewFileId(null);
                  setRenewFileName(null);
                }}
                  className="rounded-lg border border-cream-300 px-3 py-2 text-xs font-semibold text-ink-muted dark:border-hairline-dark"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {localError ? (
            <p className="text-sm text-status-danger">{localError}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-cream-200 px-5 py-4 dark:border-hairline-dark">
          {editing ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(false)}
                className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-muted dark:border-hairline-dark"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(true);
                  setLocalError(null);
                }}
                className="rounded-lg bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-100"
              >
                Edit licence
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRenewOpen(true);
                  setRenewFileId(null);
                  setRenewFileName(null);
                  setLocalError(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark renewed
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCreateTask()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ListTodo className="h-4 w-4" />
                )}
                Create task
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDelete()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-status-danger hover:bg-status-danger/10"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
