"use client";

import { useCallback, useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  Calendar,
  Columns3,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { AdminTaskDetailModal } from "@/components/admin/AdminTaskDetailModal";
import { SimpleRichTextEditor } from "@/components/admin/SimpleRichTextEditor";
import { cn } from "@/lib/utils/cn";
import {
  ADMIN_TASK_COLUMN_MAX,
  columnShellStyle,
  type AdminTaskColumn,
} from "@/lib/admin/task-columns-shared";
import {
  isEmptyTaskDescription,
  plainTextFromTaskDescription,
  sanitizeTaskDescription,
} from "@/lib/admin/task-html";
import type { AdminTaskRow } from "@/lib/admin/task-compliance-schemas";

interface TeamMember {
  id: string;
  label: string;
}

interface AdminTaskBoardProps {
  initialTasks: AdminTaskRow[];
  initialColumns: AdminTaskColumn[];
  teamMembers: TeamMember[];
  canManage: boolean;
  canAttachStorage?: boolean;
  initialOpenTaskId?: string | null;
}

const DRAG_TASK_MIME = "application/x-bantuniaga-admin-task-id";

function fmtDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(iso: string | null, isDoneColumn: boolean): boolean {
  if (!iso || isDoneColumn) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + "T00:00:00") < today;
}

function isDueToday(iso: string | null, isDoneColumn: boolean): boolean {
  if (!iso || isDoneColumn) return false;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return iso === `${y}-${m}-${d}`;
}

export function AdminTaskBoard({
  initialTasks,
  initialColumns,
  teamMembers,
  canManage,
  canAttachStorage = false,
  initialOpenTaskId = null,
}: AdminTaskBoardProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [newColumnIsDone, setNewColumnIsDone] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState("");
  const [columnError, setColumnError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialOpenTaskId,
  );

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const byColumn = useMemo(() => {
    const map = new Map<string, AdminTaskRow[]>();
    for (const col of columns) map.set(col.id, []);
    for (const t of tasks) {
      const list = map.get(t.column_id);
      if (list) list.push(t);
      else map.set(t.column_id, [t]);
    }
    return map;
  }, [columns, tasks]);

  const stats = useMemo(() => {
    const open = tasks.filter((t) => !t.column_is_done);
    const overdue = open.filter((t) =>
      isOverdue(t.due_date, t.column_is_done ?? false),
    ).length;
    const dueToday = open.filter((t) =>
      isDueToday(t.due_date, t.column_is_done ?? false),
    ).length;
    const done = tasks.filter((t) => t.column_is_done).length;
    return { open: open.length, overdue, dueToday, done };
  }, [tasks]);

  const patchTask = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/admin/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: AdminTaskRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Update failed.");
        }
        const col = columns.find((c) => c.id === json.data!.column_id);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...json.data!,
                  column_label: col?.label ?? t.column_label,
                  column_is_done: col?.is_done ?? t.column_is_done,
                }
              : t,
          ),
        );
      } catch (e) {
        throw e;
      } finally {
        setBusyId(null);
      }
    },
    [columns],
  );

  const moveTask = useCallback(
    (taskId: string, columnId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.column_id === columnId) return;
      const col = columns.find((c) => c.id === columnId);
      const snapshot = task;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                column_id: columnId,
                column_label: col?.label ?? t.column_label,
                column_is_done: col?.is_done ?? false,
              }
            : t,
        ),
      );
      void patchTask(taskId, { column_id: columnId }).catch(() => {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? snapshot : t)),
        );
      });
    },
    [columns, patchTask, tasks],
  );

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>, taskId: string) => {
      e.dataTransfer.setData(DRAG_TASK_MIME, taskId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingTaskId(taskId);
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null);
    setDragOverColumnId(null);
  }, []);

  const handleColumnDragOver = useCallback(
    (e: DragEvent<HTMLElement>, columnId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverColumnId((prev) => (prev === columnId ? prev : columnId));
    },
    [],
  );

  const handleColumnDrop = useCallback(
    (e: DragEvent<HTMLElement>, columnId: string) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData(DRAG_TASK_MIME);
      if (taskId) moveTask(taskId, columnId);
      setDraggingTaskId(null);
      setDragOverColumnId(null);
    },
    [moveTask],
  );

  const addColumn = useCallback(async () => {
    if (!canManage || !newColumnLabel.trim()) return;
    setColumnError(null);
    try {
      const res = await fetch("/api/admin/tasks/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newColumnLabel.trim(),
          is_done: newColumnIsDone,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: AdminTaskColumn;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error?.message ?? "Could not add column.");
      }
      setColumns((prev) => {
        const next = newColumnIsDone
          ? prev.map((c) => ({ ...c, is_done: false }))
          : [...prev];
        return [...next, json.data!].sort((a, b) => a.sort_order - b.sort_order);
      });
      setNewColumnLabel("");
      setNewColumnIsDone(false);
      setShowAddColumn(false);
    } catch (e) {
      setColumnError(e instanceof Error ? e.message : "Could not add column.");
    }
  }, [canManage, newColumnIsDone, newColumnLabel]);

  const saveColumnLabel = useCallback(
    async (columnId: string) => {
      if (!canManage || !editingColumnLabel.trim()) return;
      setColumnError(null);
      try {
        const res = await fetch(`/api/admin/tasks/columns/${columnId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: editingColumnLabel.trim() }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: AdminTaskColumn;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not rename column.");
        }
        setColumns((prev) =>
          prev.map((c) => (c.id === columnId ? json.data! : c)),
        );
        setTasks((prev) =>
          prev.map((t) =>
            t.column_id === columnId
              ? { ...t, column_label: json.data!.label }
              : t,
          ),
        );
        setEditingColumnId(null);
      } catch (e) {
        setColumnError(e instanceof Error ? e.message : "Could not rename column.");
      }
    },
    [canManage, editingColumnLabel],
  );

  const removeColumn = useCallback(
    async (column: AdminTaskColumn) => {
      if (!canManage) return;
      const items = byColumn.get(column.id) ?? [];
      let moveToColumnId: string | undefined;
      if (items.length > 0) {
        const others = columns.filter((c) => c.id !== column.id);
        const fallback = others.find((c) => !c.is_done) ?? others[0];
        if (!fallback) return;
        const choice = window.confirm(
          `"${column.label}" has ${items.length} task(s). Move them to "${fallback.label}" and delete this column?`,
        );
        if (!choice) return;
        moveToColumnId = fallback.id;
      } else if (!window.confirm(`Delete column "${column.label}"?`)) {
        return;
      }

      setColumnError(null);
      try {
        const deleteUrl = new URL(
          `/api/admin/tasks/columns/${column.id}`,
          window.location.origin,
        );
        if (moveToColumnId) {
          deleteUrl.searchParams.set("move_to_column_id", moveToColumnId);
        }

        const res = await fetch(deleteUrl, { method: "DELETE" });
        const raw = await res.text();
        let json: {
          ok: boolean;
          data?: AdminTaskColumn[];
          error?: { message?: string };
        };
        try {
          json = raw ? JSON.parse(raw) : { ok: false };
        } catch {
          throw new Error(
            raw.startsWith("Internal")
              ? "Server error while deleting column. Please try again."
              : "Could not delete column.",
          );
        }
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not delete column.");
        }
        setColumns(json.data);
        if (moveToColumnId) {
          const dest = json.data.find((c) => c.id === moveToColumnId);
          setTasks((prev) =>
            prev.map((t) =>
              t.column_id === column.id
                ? {
                    ...t,
                    column_id: moveToColumnId!,
                    column_label: dest?.label ?? t.column_label,
                    column_is_done: dest?.is_done ?? false,
                  }
                : t,
            ),
          );
        } else {
          setTasks((prev) => prev.filter((t) => t.column_id !== column.id));
        }
      } catch (e) {
        setColumnError(e instanceof Error ? e.message : "Could not delete column.");
      }
    },
    [byColumn, canManage, columns],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!canManage) return;
      setBusyId(id);
      try {
        const res = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(json?.error?.message ?? "Delete failed.");
        }
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setSelectedTaskId((prev) => (prev === id ? null : prev));
      } finally {
        setBusyId(null);
      }
    },
    [canManage],
  );

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!canManage) return;
      setFormError(null);
      setCreating(true);
      try {
        const safeDescription = isEmptyTaskDescription(description)
          ? null
          : sanitizeTaskDescription(description);
        if (
          safeDescription &&
          plainTextFromTaskDescription(safeDescription).length > 2000
        ) {
          setFormError("Details must be 2000 characters or fewer.");
          return;
        }

        const res = await fetch("/api/admin/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: safeDescription,
            due_date: dueDate || null,
            assignee_user_id: assigneeId || null,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: AdminTaskRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not create task.");
        }
        setTasks((prev) => [json.data!, ...prev]);
        setTitle("");
        setDescription("");
        setDueDate("");
        setAssigneeId("");
        setShowForm(false);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Create failed.");
      } finally {
        setCreating(false);
      }
    },
    [assigneeId, canManage, description, dueDate, title],
  );

  return (
    <div className="space-y-5">
      <section
        aria-label="Task summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            Open
          </p>
          <p className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
            {stats.open}
          </p>
        </div>
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4 shadow-card dark:bg-status-danger/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-status-danger">
            Overdue
          </p>
          <p className="mt-1 text-2xl font-bold text-status-danger">
            {stats.overdue}
          </p>
        </div>
        <div className="rounded-xl border border-status-warning/35 bg-status-warning/10 p-4 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C5C0A] dark:text-[#F5C97A]">
            Due today
          </p>
          <p className="mt-1 text-2xl font-bold text-[#8C5C0A] dark:text-[#F5C97A]">
            {stats.dueToday}
          </p>
        </div>
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-4 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-status-success">
            Completed
          </p>
          <p className="mt-1 text-2xl font-bold text-status-success">
            {stats.done}
          </p>
        </div>
      </section>

      {canManage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 dark:border-brand-800 dark:from-brand-950/40 dark:to-panel-dark">
          <div>
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Add a task for today
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Due dates and assignees optional — drag cards between columns.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {showForm ? "Close form" : "Add task"}
          </button>
        </div>
      ) : null}

      {showForm && canManage ? (
        <form
          onSubmit={onCreate}
          className="space-y-4 rounded-xl border border-brand-200 bg-white p-5 shadow-card dark:border-brand-800 dark:bg-panel-dark"
        >
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            New task
          </p>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-task-title"
              className="text-xs font-semibold text-ink dark:text-cream-100"
            >
              Task title <span className="text-status-danger">*</span>
            </label>
            <input
              id="admin-task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chase supplier invoice, file SSM renewal"
              required
              className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100 dark:focus:ring-brand-800"
            />
          </div>

          <SimpleRichTextEditor
            id="admin-task-details"
            label="Details"
            value={description}
            onChange={setDescription}
            placeholder="Steps to complete, supplier contact, document links…"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-task-due-date"
                className="text-xs font-semibold text-ink dark:text-cream-100"
              >
                Due date{" "}
                <span className="font-normal text-ink-muted dark:text-cream-400">
                  (optional)
                </span>
              </label>
              <input
                id="admin-task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="admin-task-assignee"
                className="text-xs font-semibold text-ink dark:text-cream-100"
              >
                Assign to{" "}
                <span className="font-normal text-ink-muted dark:text-cream-400">
                  (optional)
                </span>
              </label>
              <select
                id="admin-task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {formError ? (
            <p className="text-sm text-status-danger">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save task
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {columnError ? (
        <p className="text-sm text-status-danger">{columnError}</p>
      ) : null}

      <div
        role="region"
        aria-label="Task board"
        className="-mx-2 flex items-start gap-3 overflow-x-auto overscroll-x-contain px-2 pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-cream-300 dark:[&::-webkit-scrollbar-thumb]:bg-hairline-dark"
      >
        {columns.map((col, index) => {
          const styles = columnShellStyle(index, col.is_done);
          const items = byColumn.get(col.id) ?? [];
          const isEditing = editingColumnId === col.id;

          return (
            <section
              key={col.id}
              className={cn(
                "flex h-[min(70vh,640px)] w-72 shrink-0 flex-col overflow-hidden rounded-2xl border shadow-card transition-shadow",
                styles.shell,
                dragOverColumnId === col.id &&
                  "ring-2 ring-brand-400 ring-offset-2 dark:ring-brand-500 dark:ring-offset-panel-dark",
              )}
              onDragOver={(e) => handleColumnDragOver(e, col.id)}
              onDrop={(e) => handleColumnDrop(e, col.id)}
            >
              <header
                className={cn(
                  "flex items-start justify-between gap-2 border-b px-4 py-3.5",
                  styles.header,
                )}
              >
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      value={editingColumnLabel}
                      onChange={(e) => setEditingColumnLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveColumnLabel(col.id);
                        if (e.key === "Escape") setEditingColumnId(null);
                      }}
                      className="w-full rounded-md border border-cream-300 bg-white px-2 py-1 text-sm font-bold dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                      autoFocus
                    />
                  ) : (
                    <h2 className="text-sm font-bold text-ink dark:text-cream-100">
                      {col.label}
                      {col.is_done ? (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase text-status-success">
                          Done
                        </span>
                      ) : null}
                    </h2>
                  )}
                  <p className="text-[11px] text-ink-muted dark:text-cream-400">
                    Drag cards here
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                      styles.badge,
                    )}
                  >
                    {items.length}
                  </span>
                  {canManage ? (
                    <>
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => void saveColumnLabel(col.id)}
                          className="rounded-md px-2 py-1 text-[11px] font-semibold text-brand-700"
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingColumnId(col.id);
                            setEditingColumnLabel(col.label);
                          }}
                          aria-label={`Rename ${col.label}`}
                          className="rounded-md p-1 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/60"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {columns.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => void removeColumn(col)}
                          aria-label={`Delete ${col.label}`}
                          className="rounded-md p-1 text-status-danger hover:bg-status-danger/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </header>
              <ul
                className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-cream-300 dark:[&::-webkit-scrollbar-thumb]:bg-hairline-dark"
              >
                {items.length === 0 ? (
                  <li
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center transition-colors",
                      dragOverColumnId === col.id
                        ? "border-brand-400 bg-brand-50/80 dark:border-brand-500 dark:bg-brand-900/30"
                        : "border-cream-300/80 bg-white/50 dark:border-hairline-dark dark:bg-panel-dark/30",
                    )}
                  >
                    <Columns3
                      className="h-8 w-8 text-ink-subtle dark:text-cream-500"
                      strokeWidth={1.5}
                    />
                    <p className="text-xs font-medium text-ink-muted dark:text-cream-400">
                      {draggingTaskId ? "Drop task here" : "No tasks here"}
                    </p>
                  </li>
                ) : (
                  items.map((task) => {
                    const isDoneCol = task.column_is_done ?? col.is_done;
                    const overdue = isOverdue(task.due_date, isDoneCol);
                    const dueToday = isDueToday(task.due_date, isDoneCol);
                    const busy = busyId === task.id;
                    const isDragging = draggingTaskId === task.id;
                    const hasDetails = !isEmptyTaskDescription(task.description);

                    return (
                      <li
                        key={task.id}
                        className={cn(
                          "overflow-hidden rounded-xl border border-cream-200/90 bg-white shadow-card transition-all dark:border-hairline-dark dark:bg-panel-dark",
                          "border-l-4",
                          overdue
                            ? "border-l-status-danger"
                            : dueToday
                              ? "border-l-status-warning"
                              : styles.accent,
                          busy && "opacity-60",
                          isDragging && "scale-[0.98] opacity-40",
                          !busy && "hover:shadow-elevated",
                        )}
                      >
                        <div className="flex gap-2 px-3 py-3">
                          <button
                            type="button"
                            draggable={!busy}
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            disabled={busy}
                            aria-label={`Drag ${task.title} to another column`}
                            className="mt-0.5 shrink-0 cursor-grab rounded-md p-0.5 text-ink-subtle active:cursor-grabbing hover:bg-cream-100 disabled:cursor-not-allowed dark:text-cream-500 dark:hover:bg-hairline-dark/60"
                          >
                            <GripVertical className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedTaskId(task.id)}
                            className="min-w-0 flex-1 rounded-lg text-left transition-colors hover:bg-cream-50/80 dark:hover:bg-hairline-dark/30"
                          >
                            <p className="text-sm font-semibold leading-snug text-ink dark:text-cream-100">
                              {task.title}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {task.due_date ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                    overdue
                                      ? "bg-status-danger/10 text-status-danger"
                                      : dueToday
                                        ? "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]"
                                        : "bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
                                  )}
                                >
                                  <Calendar className="h-3 w-3" />
                                  {fmtDue(task.due_date)}
                                  {overdue
                                    ? " · overdue"
                                    : dueToday
                                      ? " · today"
                                      : ""}
                                </span>
                              ) : null}
                              {task.assignee_name ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-100">
                                  <User className="h-3 w-3" />
                                  {task.assignee_name}
                                </span>
                              ) : null}
                            </div>
                            {hasDetails ? (
                              <p className="mt-2 line-clamp-2 text-xs text-ink-muted dark:text-cream-400">
                                {plainTextFromTaskDescription(task.description)}
                              </p>
                            ) : null}
                            <span className="mt-2 inline-block text-[10px] font-semibold text-brand-700 dark:text-brand-200">
                              View task
                            </span>
                          </button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>
          );
        })}

        {canManage && columns.length < ADMIN_TASK_COLUMN_MAX ? (
          <section className="flex h-[min(70vh,640px)] w-72 shrink-0 flex-col rounded-2xl border border-dashed border-cream-300 bg-cream-50/40 p-4 dark:border-hairline-dark dark:bg-panel-dark/30">
            {showAddColumn ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  New column
                </p>
                <input
                  value={newColumnLabel}
                  onChange={(e) => setNewColumnLabel(e.target.value)}
                  placeholder="e.g. Waiting, Review"
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                />
                <label className="flex items-center gap-2 text-xs text-ink dark:text-cream-100">
                  <input
                    type="checkbox"
                    checked={newColumnIsDone}
                    onChange={(e) => setNewColumnIsDone(e.target.checked)}
                  />
                  Counts as completed column
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void addColumn()}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Add column
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddColumn(false)}
                    className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddColumn(true)}
                className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-cream-300 text-ink-muted transition-colors hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700 dark:border-hairline-dark dark:hover:border-brand-600 dark:hover:text-brand-200"
              >
                <Plus className="h-8 w-8" strokeWidth={1.5} />
                <span className="text-sm font-semibold">Add column</span>
              </button>
            )}
          </section>
        ) : null}
      </div>

      {selectedTask ? (
        <AdminTaskDetailModal
          task={selectedTask}
          columns={columns}
          canManage={canManage}
          canAttachStorage={canAttachStorage}
          busy={busyId === selectedTask.id}
          onClose={() => setSelectedTaskId(null)}
          onMove={(columnId) => moveTask(selectedTask.id, columnId)}
          onAttachFile={async (fileId) => {
            await patchTask(selectedTask.id, { admin_file_id: fileId });
          }}
          onDelete={() => {
            if (
              window.confirm(
                `Delete task "${selectedTask.title}"? This cannot be undone.`,
              )
            ) {
              void deleteTask(selectedTask.id);
            }
          }}
          fmtDue={fmtDue}
          overdue={isOverdue(
            selectedTask.due_date,
            selectedTask.column_is_done ?? false,
          )}
          dueToday={isDueToday(
            selectedTask.due_date,
            selectedTask.column_is_done ?? false,
          )}
        />
      ) : null}
    </div>
  );
}
