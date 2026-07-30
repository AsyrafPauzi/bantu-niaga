"use client";

import { sanitizeTaskDescription } from "@/lib/admin/task-html";
import { cn } from "@/lib/utils/cn";

interface TaskDescriptionHtmlProps {
  html: string;
  className?: string;
}

/** Renders sanitized task description HTML. */
export function TaskDescriptionHtml({ html, className }: TaskDescriptionHtmlProps) {
  const safe = sanitizeTaskDescription(html);
  if (!safe) return null;

  return (
    <div
      className={cn(
        "text-xs leading-relaxed text-ink-muted dark:text-cream-400",
        "[&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline dark:[&_a]:text-brand-200",
        "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4",
        "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4",
        "[&_p]:my-1",
        "[&_strong]:font-semibold [&_strong]:text-ink dark:[&_strong]:text-cream-200",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
