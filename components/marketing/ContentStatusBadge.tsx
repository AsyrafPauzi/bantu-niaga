import { cn } from "@/lib/utils/cn";
import type { ContentStatus } from "./types";

/**
 * Status pill for content_plan rows.
 *
 *   idea       — neutral cream outline (still in someone's head)
 *   drafted    — brand-tinted (real work happening)
 *   scheduled  — accent (locked, calendar-bound)
 *   posted     — status-success (terminal in v1)
 *
 * Pure rendering. Uses existing brand / accent / cream / status tokens —
 * no new tokens introduced.
 */

const STATUS_TONE: Record<ContentStatus, string> = {
  idea:
    "border border-cream-300 bg-transparent text-ink dark:border-hairline-dark dark:text-cream-200",
  drafted: "bg-brand-700 text-white",
  scheduled: "bg-accent-700 text-white",
  posted: "bg-status-success text-white",
};

const STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Idea",
  drafted: "Drafted",
  scheduled: "Scheduled",
  posted: "Posted",
};

interface ContentStatusBadgeProps {
  status: ContentStatus;
  className?: string;
}

export function ContentStatusBadge({
  status,
  className,
}: ContentStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
        STATUS_TONE[status],
        className,
      )}
      data-status={status}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
