import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Card, CardBody } from "@/components/ui/card";
import { ContentPlatformBadge } from "./ContentPlatformBadge";
import { ContentStatusBadge } from "./ContentStatusBadge";
import type { ContentEntryRow } from "./types";

/**
 * Mobile-first vertical list, grouped by scheduled day (MYT).
 *
 * Entries without `scheduled_at` are bundled under a "No date yet" group
 * sorted by created_at so the owner sees their backlog of ideas.
 *
 * Pure rendering — server-component safe.
 */

interface ContentListMobileProps {
  entries: ContentEntryRow[];
  entryHref: (entryId: string) => string;
  newEntryHref: string;
  className?: string;
}

const MYT_OFFSET_MS = 8 * 3_600_000;

function isoLocalDateFromUtc(utcMs: number): string {
  const myt = new Date(utcMs + MYT_OFFSET_MS);
  const y = myt.getUTCFullYear();
  const m = String(myt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(myt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMytDay(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00+08:00`);
    return new Intl.DateTimeFormat("en-MY", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kuala_Lumpur",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatMytTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-MY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function ContentListMobile({
  entries,
  entryHref,
  newEntryHref,
  className,
}: ContentListMobileProps) {
  // Group: scheduled entries by MYT date; unscheduled bundled at the end.
  const scheduled: Record<string, ContentEntryRow[]> = {};
  const unscheduled: ContentEntryRow[] = [];
  for (const e of entries) {
    if (e.scheduled_at) {
      const t = Date.parse(e.scheduled_at);
      if (Number.isNaN(t)) {
        unscheduled.push(e);
        continue;
      }
      const iso = isoLocalDateFromUtc(t);
      (scheduled[iso] ??= []).push(e);
    } else {
      unscheduled.push(e);
    }
  }
  const sortedKeys = Object.keys(scheduled).sort();

  if (entries.length === 0) {
    return (
      <Card className={className}>
        <CardBody className="space-y-3 py-6 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            No posts planned. Tap below to capture an idea.
          </p>
          <Link
            href={newEntryHref}
            className="inline-flex items-center justify-center rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            + New entry
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-end">
        <Link
          href={newEntryHref}
          className="inline-flex items-center justify-center rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          + New entry
        </Link>
      </div>

      {sortedKeys.map((iso) => (
        <section key={iso} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
            {formatMytDay(iso)}
          </h3>
          <ul className="space-y-2">
            {scheduled[iso].map((e) => (
              <li key={e.id}>
                <ContentEntryCard entry={e} entryHref={entryHref} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {unscheduled.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
            No date yet
          </h3>
          <ul className="space-y-2">
            {unscheduled.map((e) => (
              <li key={e.id}>
                <ContentEntryCard entry={e} entryHref={entryHref} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ContentEntryCard({
  entry,
  entryHref,
}: {
  entry: ContentEntryRow;
  entryHref: (id: string) => string;
}) {
  return (
    <Link
      href={entryHref(entry.id)}
      className="block rounded-lg border border-cream-200 bg-panel-light p-3 hover:border-brand-400 dark:border-hairline-dark dark:bg-panel-dark"
      data-entry-id={entry.id}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ContentPlatformBadge channel={entry.channel} size="xs" />
          <ContentStatusBadge status={entry.status} />
        </div>
        {entry.scheduled_at && (
          <span className="text-xs text-ink-muted dark:text-cream-400">
            {formatMytTime(entry.scheduled_at)}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-ink dark:text-cream-100">
        {entry.hook || entry.caption || "(untitled)"}
      </p>
      {entry.media && entry.media.length > 0 && (
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
          📎 {entry.media.length} attachment{entry.media.length === 1 ? "" : "s"}
        </p>
      )}
    </Link>
  );
}
