/**
 * Client-safe admin task column types, constants, and UI helpers.
 * Server DB loaders live in `lib/admin/task-columns.ts`.
 */

import { z } from "zod";

export const ADMIN_TASK_COLUMN_MAX = 8;
export const ADMIN_TASK_COLUMN_MIN = 1;
export const ADMIN_TASK_COLUMN_LABEL_MAX = 40;

export const DEFAULT_TASK_COLUMNS = [
  { label: "To do", slug: "todo", sort_order: 0, is_done: false },
  { label: "Doing", slug: "doing", sort_order: 1, is_done: false },
  { label: "Done", slug: "done", sort_order: 2, is_done: true },
] as const;

export interface AdminTaskColumn {
  id: string;
  business_id: string;
  label: string;
  slug: string;
  sort_order: number;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export const adminTaskColumnCreateSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Column name is required.")
      .max(ADMIN_TASK_COLUMN_LABEL_MAX),
    is_done: z.boolean().optional().default(false),
  })
  .strict();

export const adminTaskColumnUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(ADMIN_TASK_COLUMN_LABEL_MAX).optional(),
    sort_order: z.number().int().min(0).max(100).optional(),
    is_done: z.boolean().optional(),
  })
  .strict();

export const adminTaskColumnDeleteSchema = z
  .object({
    move_to_column_id: z.string().uuid().optional(),
  })
  .strict();

export function slugifyTaskColumnLabel(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `col-${suffix}`;
}

export function columnShellStyle(
  index: number,
  isDone: boolean,
): {
  shell: string;
  header: string;
  badge: string;
  accent: string;
} {
  if (isDone) {
    return {
      shell:
        "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-panel-dark",
      header:
        "border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-transparent dark:border-emerald-900/40 dark:from-emerald-950/40",
      badge:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
      accent: "border-l-emerald-500",
    };
  }
  if (index === 0) {
    return {
      shell:
        "border-slate-200 bg-gradient-to-b from-slate-50 to-white dark:border-hairline-dark dark:from-slate-950/40 dark:to-panel-dark",
      header:
        "border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-transparent dark:border-hairline-dark dark:from-slate-950/40",
      badge:
        "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
      accent: "border-l-slate-400",
    };
  }
  return {
    shell:
      "border-violet-200 bg-gradient-to-b from-violet-50 to-white dark:border-violet-900/40 dark:from-violet-950/30 dark:to-panel-dark",
    header:
      "border-violet-200/80 bg-gradient-to-b from-violet-50/90 to-transparent dark:border-violet-900/40 dark:from-violet-950/40",
    badge:
      "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-100",
    accent: "border-l-violet-500",
  };
}
