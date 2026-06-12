import {
  Activity,
  GitMerge,
  Pencil,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ActivityRow } from "@/lib/marketing/dashboard-queries";

interface RecentActivityFeedProps {
  rows: ActivityRow[];
  className?: string;
}

const EVENT_ICON: Record<string, typeof UserPlus> = {
  "customer.created": UserPlus,
  "customer.updated": Pencil,
  "customer.merged": GitMerge,
  "customer.tag_changed": Sparkles,
  "customer.deleted": Trash2,
};

const EVENT_TONE: Record<string, string> = {
  "customer.created":
    "bg-status-success/10 text-status-success dark:bg-status-success/20",
  "customer.updated":
    "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  "customer.merged":
    "bg-[#DCE9F0] text-[#1F4E66] dark:bg-[#13303D] dark:text-[#A6CFE0]",
  "customer.tag_changed":
    "bg-accent-50 text-accent-700 dark:bg-accent-700/30 dark:text-accent-200",
  "customer.deleted":
    "bg-[#F8DDD9] text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]",
};

function formatRelative(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

export function RecentActivityFeed({
  rows,
  className,
}: RecentActivityFeedProps) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border border-dashed border-hairline-light bg-cream-50 p-5 dark:border-hairline-dark dark:bg-panel-dark/40",
          className,
        )}
      >
        <Activity
          className="mt-0.5 h-5 w-5 shrink-0 text-brand-500"
          strokeWidth={2}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium text-ink dark:text-cream-100">
            Nothing happening yet
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            Customer events from across your business will stream here as they happen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ol className={cn("space-y-3", className)}>
      {rows.map((row) => {
        const Icon = EVENT_ICON[row.event_name] ?? Activity;
        const tone =
          EVENT_TONE[row.event_name] ??
          "bg-cream-200 text-ink dark:bg-hairline-dark dark:text-cream-200";
        return (
          <li
            key={row.id}
            data-event-name={row.event_name}
            className="flex items-start gap-3"
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                tone,
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink dark:text-cream-100">
                {row.summary}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted dark:text-cream-400">
                {formatRelative(row.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
