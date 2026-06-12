import Link from "next/link";
import { CalendarPlus, Instagram, Music2, Facebook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { UpcomingContentRow } from "@/lib/marketing/dashboard-queries";

interface UpcomingContentListProps {
  rows: UpcomingContentRow[];
  className?: string;
}

const CHANNEL_ICON: Record<UpcomingContentRow["channel"], typeof Music2> = {
  tiktok: Music2,
  instagram: Instagram,
  facebook: Facebook,
};

const CHANNEL_LABEL: Record<UpcomingContentRow["channel"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
};

const STATUS_TONE = {
  scheduled: "brand",
  drafted: "accent",
} as const;

function formatDay(value: string | null): {
  short: string;
  weekday: string;
  time: string;
} {
  if (!value) return { short: "—", weekday: "TBD", time: "—" };
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return { short: "—", weekday: "TBD", time: "—" };
  return {
    short: d.toLocaleDateString("en-MY", {
      day: "2-digit",
      timeZone: "Asia/Kuala_Lumpur",
    }),
    weekday: d
      .toLocaleDateString("en-MY", {
        weekday: "short",
        timeZone: "Asia/Kuala_Lumpur",
      })
      .toUpperCase(),
    time: d.toLocaleTimeString("en-MY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kuala_Lumpur",
    }),
  };
}

export function UpcomingContentList({
  rows,
  className,
}: UpcomingContentListProps) {
  if (rows.length === 0) {
    return (
      <div className={cn("flex flex-col items-start gap-3 rounded-lg border border-dashed border-hairline-light bg-cream-50 p-5 dark:border-hairline-dark dark:bg-panel-dark/40", className)}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-700 dark:bg-accent-700/30 dark:text-accent-200">
          <CalendarPlus className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink dark:text-cream-100">
            Nothing on the calendar
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            Plan a TikTok / IG / FB post for the week ahead so you stay top-of-mind.
          </p>
        </div>
        <Link href="/marketing/content/new">
          <Button size="sm" variant="accent">
            Plan a post
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {rows.map((row) => {
        const Icon = CHANNEL_ICON[row.channel];
        const date = formatDay(row.scheduled_at);
        return (
          <li key={row.id}>
            <Link
              href={`/marketing/content`}
              className="flex items-start gap-3 rounded-md border border-hairline-light bg-cream-50/50 p-3 transition-colors hover:border-brand-200 hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark/30 dark:hover:bg-hairline-dark/40"
            >
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <span className="text-[9px] font-semibold tracking-wider">
                  {date.weekday}
                </span>
                <span className="text-base font-semibold leading-none">
                  {date.short}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-ink-muted dark:text-cream-400">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  <span className="font-medium text-ink dark:text-cream-100">
                    {CHANNEL_LABEL[row.channel]}
                  </span>
                  <span>·</span>
                  <span>{date.time}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-ink dark:text-cream-100">
                  {row.hook?.trim() || "Untitled hook"}
                </p>
              </div>
              <Badge
                tone={
                  row.status === "scheduled"
                    ? STATUS_TONE.scheduled
                    : row.status === "drafted"
                      ? STATUS_TONE.drafted
                      : "neutral"
                }
                className="shrink-0 capitalize"
              >
                {row.status}
              </Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
