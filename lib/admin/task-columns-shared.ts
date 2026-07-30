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
        "border-status-success/30 bg-gradient-to-b from-status-success/10 to-status-success/5 dark:border-status-success/25 dark:from-status-success/15 dark:to-transparent",
      header:
        "border-status-success/25 bg-status-success/10 dark:border-status-success/20 dark:bg-status-success/10",
      badge:
        "bg-status-success/15 text-status-success dark:bg-status-success/20 dark:text-status-success",
      accent: "border-l-status-success",
    };
  }
  if (index === 0) {
    return {
      shell:
        "border-cream-300/80 bg-gradient-to-b from-cream-100/90 to-cream-50/50 dark:border-hairline-dark dark:from-panel-dark/80 dark:to-panel-dark/40",
      header:
        "border-cream-300/80 bg-white/80 dark:border-hairline-dark dark:bg-panel-dark/90",
      badge:
        "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-300",
      accent: "border-l-ink-subtle",
    };
  }
  return {
    shell:
      "border-brand-300/70 bg-gradient-to-b from-brand-50 to-brand-50/30 dark:border-brand-800 dark:from-brand-950/50 dark:to-brand-900/20",
    header:
      "border-brand-200 bg-brand-50/90 dark:border-brand-800 dark:bg-brand-900/40",
    badge: "bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-100",
    accent: "border-l-brand-500",
  };
}
