"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Columns3, FileText, Loader2, Paperclip, Trash2, User, X } from "lucide-react";
import { TaskDescriptionHtml } from "@/components/admin/TaskDescriptionHtml";
import type { AdminTaskColumn } from "@/lib/admin/task-columns-shared";
import { isEmptyTaskDescription } from "@/lib/admin/task-html";
import type { AdminFileListResponse } from "@/lib/admin/schemas";
import type { AdminTaskRow } from "@/lib/admin/task-compliance-schemas";
import { cn } from "@/lib/utils/cn";

interface AdminTaskDetailModalProps {
  task: AdminTaskRow;
  columns: AdminTaskColumn[];
  canManage: boolean;
  canAttachStorage: boolean;
  busy: boolean;
  onClose: () => void;
  onMove: (columnId: string) => void;
  onDelete: () => void;
  onAttachFile: (fileId: string | null) => Promise<void>;
  fmtDue: (iso: string | null) => string | null;
  overdue: boolean;
  dueToday: boolean;
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

export function AdminTaskDetailModal({
  task,
  columns,
  canManage,
  canAttachStorage,
  busy,
  onClose,
  onMove,
  onDelete,
  onAttachFile,
  fmtDue,
  overdue,
  dueToday,
}: AdminTaskDetailModalProps) {
  const [storageFiles, setStorageFiles] = useState<
    Array<{ id: string; file_name: string }>
  >([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [pickFileId, setPickFileId] = useState("");
  const [attachError, setAttachError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!canAttachStorage || !canManage) return;
    let cancelled = false;
    setStorageLoading(true);
    void fetch("/api/admin/storage?limit=100&sort=newest")
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: AdminFileListResponse }) => {
        if (!cancelled && json.ok && json.data) {
          setStorageFiles(
            json.data.data.map((f) => ({ id: f.id, file_name: f.file_name })),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setStorageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAttachStorage, canManage]);

  const hasDetails = !isEmptyTaskDescription(task.description);

  const handleAttach = async () => {
    if (!pickFileId) return;
    setAttachError(null);
    try {
      await onAttachFile(pickFileId);
      setPickFileId("");
    } catch (e) {
      setAttachError(e instanceof Error ? e.message : "Could not attach file.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-task-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-cream-200 bg-white shadow-elevated dark:border-hairline-dark dark:bg-panel-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700/80 dark:text-brand-200/80">
              Task details
            </p>
            <h2
              id="admin-task-detail-title"
              className="mt-1 text-lg font-bold text-ink dark:text-cream-100"
            >
              {task.title}
            </h2>
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
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-cream-200 bg-cream-50/60 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
              <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                <Columns3 className="h-3.5 w-3.5" />
                Column
              </dt>
              <dd className="mt-1 font-semibold text-ink dark:text-cream-100">
                {task.column_label ?? "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-cream-200 bg-cream-50/60 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
              <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                <Calendar className="h-3.5 w-3.5" />
                Due date
              </dt>
              <dd
                className={cn(
                  "mt-1 font-semibold",
                  overdue
                    ? "text-status-danger"
                    : dueToday
                      ? "text-[#8C5C0A] dark:text-[#F5C97A]"
                      : "text-ink dark:text-cream-100",
                )}
              >
                {task.due_date ? fmtDue(task.due_date) : "Not set"}
                {overdue ? " · overdue" : dueToday ? " · today" : ""}
              </dd>
            </div>
            <div className="rounded-lg border border-cream-200 bg-cream-50/60 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
              <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                <User className="h-3.5 w-3.5" />
                Assignee
              </dt>
              <dd className="mt-1 font-semibold text-ink dark:text-cream-100">
                {task.assignee_name ?? "Unassigned"}
              </dd>
            </div>
            <div className="rounded-lg border border-cream-200 bg-cream-50/60 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                Created
              </dt>
              <dd className="mt-1 font-semibold text-ink dark:text-cream-100">
                {fmtDateTime(task.created_at)}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              <Paperclip className="h-3.5 w-3.5" />
              Attached file
            </h3>
            {task.admin_file_id && task.admin_file_name ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-cream-50/80 px-3 py-2.5 dark:border-hairline-dark dark:bg-hairline-dark/30">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink dark:text-cream-100">
                  <FileText className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="truncate">{task.admin_file_name}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void fetch(`/api/admin/storage/${task.admin_file_id}/download`)
                        .then((r) => r.json())
                        .then((json: { ok: boolean; data?: { download_url: string } }) => {
                          if (json.ok && json.data?.download_url) {
                            window.location.href = json.data.download_url;
                          }
                        })
                    }
                    className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
                  >
                    Download
                  </button>
                  {canManage && canAttachStorage ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onAttachFile(null)}
                      className="text-xs font-semibold text-status-danger hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
                No file attached.
              </p>
            )}
            {canManage && canAttachStorage && !task.admin_file_id ? (
              <div className="mt-3 space-y-2">
                <select
                  value={pickFileId}
                  disabled={busy || storageLoading}
                  onChange={(e) => setPickFileId(e.target.value)}
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                >
                  <option value="">
                    {storageLoading ? "Loading files…" : "Choose from Storage…"}
                  </option>
                  {storageFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.file_name}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !pickFileId}
                    onClick={() => void handleAttach()}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    Attach file
                  </button>
                  <Link
                    href="/admin/storage"
                    className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
                  >
                    Upload in Storage
                  </Link>
                </div>
                {attachError ? (
                  <p className="text-xs text-status-danger">{attachError}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              Details
            </h3>
            {hasDetails ? (
              <TaskDescriptionHtml
                html={task.description!}
                className="mt-2 rounded-lg border border-cream-200 bg-cream-50/80 p-4 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30"
              />
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-cream-300 px-4 py-6 text-center text-sm text-ink-muted dark:border-hairline-dark dark:text-cream-400">
                No details added for this task.
              </p>
            )}
          </div>

          {canManage ? (
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-cream-200 pt-4 dark:border-hairline-dark">
              <div className="min-w-[180px] flex-1">
                <label
                  htmlFor="admin-task-move-column"
                  className="text-xs font-semibold text-ink dark:text-cream-100"
                >
                  Move to column
                </label>
                <select
                  id="admin-task-move-column"
                  value={task.column_id}
                  disabled={busy}
                  onChange={(e) => onMove(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-status-danger/30 px-3 py-2 text-sm font-semibold text-status-danger hover:bg-status-danger/10 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete task
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
