"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ADMIN_TASK_STATUSES,
  type AdminTaskRow,
  type AdminTaskStatus,
} from "@/lib/admin/task-compliance-schemas";

interface TeamMember {
  id: string;
  label: string;
}

interface AdminTaskBoardProps {
  initialTasks: AdminTaskRow[];
  teamMembers: TeamMember[];
  canManage: boolean;
}

const COLUMNS: Array<{ status: AdminTaskStatus; label: string }> = [
  { status: "todo", label: "To do" },
  { status: "doing", label: "Doing" },
  { status: "done", label: "Done" },
];

function fmtDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(iso: string | null, status: AdminTaskStatus): boolean {
  if (!iso || status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + "T00:00:00") < today;
}

export function AdminTaskBoard({
  initialTasks,
  teamMembers,
  canManage,
}: AdminTaskBoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const byStatus = useMemo(() => {
    const map: Record<AdminTaskStatus, AdminTaskRow[]> = {
      todo: [],
      doing: [],
      done: [],
    };
    for (const t of tasks) {
      map[t.status].push(t);
    }
    return map;
  }, [tasks]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

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
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...json.data! } : t)),
        );
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const advanceStatus = useCallback(
    (task: AdminTaskRow) => {
      const next: AdminTaskStatus =
        task.status === "todo"
          ? "doing"
          : task.status === "doing"
            ? "done"
            : "todo";
      void patchTask(task.id, { status: next });
    },
    [patchTask],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!canManage) return;
      setBusyId(id);
      try {
        const res = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed.");
        setTasks((prev) => prev.filter((t) => t.id !== id));
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [canManage, refresh],
  );

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!canManage) return;
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch("/api/admin/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
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
        setDueDate("");
        setAssigneeId("");
        setShowForm(false);
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Create failed.");
      } finally {
        setCreating(false);
      }
    },
    [assigneeId, canManage, dueDate, refresh, title],
  );

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add task
          </button>
        </div>
      ) : null}

      {showForm && canManage ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-lg border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            required
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {formError ? (
            <p className="text-sm text-status-danger">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save task
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <section
            key={col.status}
            className="rounded-lg border border-cream-200 bg-cream-50/50 dark:border-hairline-dark dark:bg-panel-dark/40"
          >
            <header className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                {col.label}
                <span className="ml-2 text-xs font-normal text-ink-muted dark:text-cream-400">
                  {byStatus[col.status].length}
                </span>
              </h2>
            </header>
            <ul className="space-y-2 p-3">
              {byStatus[col.status].length === 0 ? (
                <li className="py-6 text-center text-xs text-ink-muted dark:text-cream-400">
                  No tasks
                </li>
              ) : (
                byStatus[col.status].map((task) => {
                  const overdue = isOverdue(task.due_date, task.status);
                  const busy = busyId === task.id;
                  return (
                    <li
                      key={task.id}
                      className="rounded-lg border border-cream-200 bg-white p-3 shadow-card dark:border-hairline-dark dark:bg-panel-dark"
                    >
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => advanceStatus(task)}
                        className="w-full text-left"
                      >
                        <p className="text-sm font-medium text-ink dark:text-cream-100">
                          {task.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted dark:text-cream-400">
                          {task.due_date ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                overdue && "font-semibold text-status-danger",
                              )}
                            >
                              <Calendar className="h-3 w-3" />
                              {fmtDue(task.due_date)}
                              {overdue ? " · overdue" : ""}
                            </span>
                          ) : null}
                          {task.assignee_name ? (
                            <span>· {task.assignee_name}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-brand-600 dark:text-brand-300">
                          Tap to move →{" "}
                          {col.status === "todo"
                            ? "Doing"
                            : col.status === "doing"
                              ? "Done"
                              : "To do"}
                        </p>
                      </button>
                      {canManage ? (
                        <div className="mt-2 flex justify-end border-t border-cream-100 pt-2 dark:border-hairline-dark">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteTask(task.id)}
                            className="inline-flex items-center gap-1 text-xs text-status-danger hover:underline disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
