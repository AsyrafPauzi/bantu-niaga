"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  Calendar,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { AdminTaskDetailModal } from "@/components/admin/AdminTaskDetailModal";
import { SimpleRichTextEditor } from "@/components/admin/SimpleRichTextEditor";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
} from "@/components/dashboard/module-list-panel";
import { useQuickCreate } from "@/hooks/use-quick-create";
import { cn } from "@/lib/utils/cn";
import {
  ADMIN_TASK_COLUMN_MAX,
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

function columnTone(
  col: AdminTaskColumn,
  index: number,
): "neutral" | "brand" | "success" | "accent" {
  if (col.is_done) return "success";
  if (index === 0) return "neutral";
  return "brand";
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
  const { open: showForm, toggle: toggleForm, close: closeForm } =
    useQuickCreate({ listenForCreateParam: false });

  useEffect(() => {
    const handler = () => toggleForm();
    window.addEventListener("admin:add-task", handler);
    return () => window.removeEventListener("admin:add-task", handler);
  }, [toggleForm]);
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
  const [targetColumnId, setTargetColumnId] = useState(() => initialColumns[0]?.id ?? "");
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
    (e: DragEvent<HTMLDivElement>, taskId: string) => {
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
            column_id: targetColumnId || null,
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
        setTargetColumnId(columns[0]?.id ?? "");
        closeForm();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Create failed.");
      } finally {
        setCreating(false);
      }
    },
    [assigneeId, canManage, columns, description, dueDate, targetColumnId, title],
  );

  return (
    <div className="space-y-5">
      {/* Add task modal */}
      {showForm && canManage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-cream-200 bg-white shadow-2xl dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                <p className="text-sm font-bold text-ink dark:text-cream-100">New task</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={onCreate} className="space-y-4 p-5">
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
                  autoFocus
                  className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100 dark:focus:ring-brand-800"
                />
              </div>
              {columns.length > 1 ? (
                <div className="space-y-1.5">
                  <label htmlFor="admin-task-column" className="text-xs font-semibold text-ink dark:text-cream-100">
                    Add to column
                  </label>
                  <select
                    id="admin-task-column"
                    value={targetColumnId}
                    onChange={(e) => setTargetColumnId(e.target.value)}
                    className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>{col.label}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <SimpleRichTextEditor
                id="admin-task-details"
                label="Details"
                value={description}
                onChange={setDescription}
                placeholder="Steps to complete, supplier contact, document links…"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="admin-task-due-date" className="text-xs font-semibold text-ink dark:text-cream-100">
                    Due date <span className="font-normal text-ink-muted dark:text-cream-400">(optional)</span>
                  </label>
                  <input
                    id="admin-task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-[38px] w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-task-assignee" className="text-xs font-semibold text-ink dark:text-cream-100">
                    Assign to <span className="font-normal text-ink-muted dark:text-cream-400">(optional)</span>
                  </label>
                  <select
                    id="admin-task-assignee"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {formError ? <p className="text-sm text-status-danger">{formError}</p> : null}
              <div className="flex justify-end gap-2 border-t border-cream-200 pt-4 dark:border-hairline-dark">
                <button type="button" onClick={closeForm} className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-hairline-dark/40">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save task
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {columnError ? (
        <p className="text-sm text-status-danger">{columnError}</p>
      ) : null}

      <ModuleListPanel>
        <ModuleListPanelFilters>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            Drag cards between columns to move tasks.
          </p>
        </ModuleListPanelFilters>

        <div
          role="region"
          aria-label="Task board"
          className="flex gap-3 overflow-x-auto px-4 pb-4 sm:px-5"
        >
          {columns.map((col, index) => {
            const items = byColumn.get(col.id) ?? [];
            const isEditing = editingColumnId === col.id;
            const isDropTarget = dragOverColumnId === col.id;

            return (
              <section
                key={col.id}
                onDragOver={(e) => handleColumnDragOver(e, col.id)}
                onDragLeave={() => setDragOverColumnId(null)}
                onDrop={(e) => handleColumnDrop(e, col.id)}
                className={cn(
                  "w-64 shrink-0 rounded-xl border border-cream-200 bg-cream-50/50 transition dark:border-hairline-dark dark:bg-panel-dark/50",
                  isDropTarget &&
                    "border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800",
                )}
              >
                <header className="flex items-center justify-between gap-2 border-b border-cream-200 px-3 py-2 dark:border-hairline-dark">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {isEditing ? (
                      <input
                        value={editingColumnLabel}
                        onChange={(e) => setEditingColumnLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveColumnLabel(col.id);
                          if (e.key === "Escape") setEditingColumnId(null);
                        }}
                        className="w-full rounded-md border border-cream-300 bg-white px-2 py-1 text-xs font-semibold dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                        autoFocus
                      />
                    ) : (
                      <StatusPill tone={columnTone(col, index)}>
                        {col.label}
                      </StatusPill>
                    )}
                    {canManage && !isEditing ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingColumnId(col.id);
                            setEditingColumnLabel(col.label);
                          }}
                          aria-label={`Rename ${col.label}`}
                          className="rounded-md p-1 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/60"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {columns.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => void removeColumn(col)}
                            aria-label={`Delete ${col.label}`}
                            className="rounded-md p-1 text-status-danger hover:bg-status-danger/10"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => void saveColumnLabel(col.id)}
                        className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-200"
                      >
                        Save
                      </button>
                    ) : null}
                  </div>
                  <span className="text-xs font-semibold text-ink-muted dark:text-cream-400">
                    {items.length}
                  </span>
                </header>
                <ul className="max-h-[28rem] space-y-2 overflow-y-auto p-2">
                  {items.length === 0 ? (
                    <li className="px-2 py-4 text-center text-xs text-ink-muted dark:text-cream-400">
                      Drop here
                    </li>
                  ) : (
                    items.map((task) => {
                      const isDoneCol = task.column_is_done ?? col.is_done;
                      const overdue = isOverdue(task.due_date, isDoneCol);
                      const dueToday = isDueToday(task.due_date, isDoneCol);
                      const busy = busyId === task.id;
                      const isDragging = draggingTaskId === task.id;
                      const hasDetails = !isEmptyTaskDescription(
                        task.description,
                      );

                      return (
                        <li key={task.id}>
                          <div
                            draggable={!busy}
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "rounded-lg border border-cream-200 bg-white text-sm shadow-sm transition dark:border-hairline-dark dark:bg-panel-dark",
                              isDragging && "opacity-40",
                              overdue &&
                                "border-amber-300 dark:border-amber-800",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (!draggingTaskId) setSelectedTaskId(task.id);
                              }}
                              draggable={false}
                              className="block w-full p-3 text-left hover:border-blue-300"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 font-semibold text-ink dark:text-cream-100">
                                  {task.title}
                                </p>
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-muted" />
                                ) : null}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {task.due_date ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]",
                                      overdue
                                        ? "font-semibold text-amber-700 dark:text-amber-300"
                                        : dueToday
                                          ? "font-semibold text-amber-900 dark:text-amber-100"
                                          : "text-ink-muted dark:text-cream-400",
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
                                  <span className="text-[10px] text-ink-muted dark:text-cream-400">
                                    {task.assignee_name}
                                  </span>
                                ) : null}
                              </div>
                              {hasDetails ? (
                                <p className="mt-1 line-clamp-2 text-xs text-ink-muted dark:text-cream-400">
                                  {plainTextFromTaskDescription(
                                    task.description,
                                  )}
                                </p>
                              ) : null}
                              {overdue ? (
                                <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                  Overdue
                                </p>
                              ) : null}
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
            <section className="w-64 shrink-0 rounded-xl border border-dashed border-cream-300 bg-cream-50/40 dark:border-hairline-dark dark:bg-panel-dark/30">
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
                className="flex min-h-[12rem] w-full flex-col items-center justify-center gap-2 px-4 py-8 text-ink-muted transition-colors hover:text-brand-700 dark:hover:text-brand-200"
              >
                <Plus className="h-6 w-6" strokeWidth={1.5} />
                <span className="text-xs font-semibold">Add column</span>
              </button>
            )}
          </section>
        ) : null}
        </div>
      </ModuleListPanel>

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
