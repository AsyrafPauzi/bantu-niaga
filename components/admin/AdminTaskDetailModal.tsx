"use client";

import { useEffect } from "react";
import { Calendar, Columns3, Loader2, Trash2, User, X } from "lucide-react";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import { TaskDescriptionHtml } from "@/components/admin/TaskDescriptionHtml";
import type { AdminTaskColumn } from "@/lib/admin/task-columns-shared";
import { isEmptyTaskDescription } from "@/lib/admin/task-html";
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasDetails = !isEmptyTaskDescription(task.description);

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

          <AdminStorageFileAttach
            fileId={task.admin_file_id ?? null}
            fileName={task.admin_file_name}
            disabled={busy || !canManage || !canAttachStorage}
            label="Attached file"
            onAttach={onAttachFile}
          />

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
