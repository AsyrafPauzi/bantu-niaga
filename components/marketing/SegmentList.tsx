import Link from "next/link";
import { ChevronRight, Lock, Send, Sparkles, Users } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  ModuleListPanel,
  ModuleListPanelHeader,
} from "@/components/dashboard/module-list-panel";
import { SegmentListQuickActions } from "@/components/marketing/SegmentListQuickActions";
import {
  AUTO_KEY_LABEL,
  type AutoSegmentKey,
} from "@/lib/marketing/segments-rules";
import {
  AUTO_SEGMENT_BLURB,
  broadcastNewHref,
  fmtSegmentRel,
  segmentCustomersHref,
} from "@/lib/marketing/segment-display";
import { formatCount } from "@/lib/marketing/metrics";
import { cn } from "@/lib/utils/cn";

export interface SegmentListRow {
  id: string;
  name: string;
  kind: "auto" | "custom";
  auto_key: AutoSegmentKey | null;
  member_count: number;
  member_count_at: string | null;
}

interface SegmentListProps {
  autoRows: SegmentListRow[];
  customRows: SegmentListRow[];
}

const AUTO_TONE: Record<
  AutoSegmentKey,
  "accent" | "brand" | "success" | "warning" | "neutral"
> = {
  vip: "accent",
  repeat: "brand",
  new: "success",
  at_risk: "warning",
  dormant: "neutral",
};

function SegmentCard({ row }: { row: SegmentListRow }) {
  const blurb =
    row.kind === "auto" && row.auto_key
      ? AUTO_SEGMENT_BLURB[row.auto_key]
      : "Custom rules you defined";
  const tone =
    row.kind === "auto" && row.auto_key
      ? AUTO_TONE[row.auto_key]
      : "accent";

  return (
    <article className="group rounded-2xl border border-cream-200 bg-white p-4 shadow-card transition-colors hover:border-violet-300 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-violet-800">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            row.kind === "auto"
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200"
              : "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200",
          )}
        >
          {row.kind === "auto" ? (
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Users className="h-4 w-4" strokeWidth={2} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/marketing/segments/${row.id}`}
              className="text-sm font-semibold text-ink hover:text-violet-700 dark:text-cream-100 dark:hover:text-violet-300"
            >
              {row.name}
            </Link>
            <StatusPill tone={tone}>
              {row.kind === "auto" && row.auto_key
                ? AUTO_KEY_LABEL[row.auto_key]
                : "Custom"}
            </StatusPill>
          </div>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            {blurb}
          </p>
          {row.kind === "auto" ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              <Lock className="h-3 w-3 shrink-0" strokeWidth={2} />
              System segment — not editable
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-semibold tabular-nums text-ink dark:text-cream-100">
              {formatCount(row.member_count)} member
              {row.member_count === 1 ? "" : "s"}
            </span>
            <span className="text-ink-muted dark:text-cream-400">
              Updated {fmtSegmentRel(row.member_count_at)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.member_count > 0 ? (
              <Link
                href={broadcastNewHref(row.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-700"
              >
                <Send className="h-3 w-3" strokeWidth={2} />
                Broadcast
              </Link>
            ) : null}
            {row.kind === "auto" && row.auto_key ? (
              <Link
                href={segmentCustomersHref(row.auto_key)}
                className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:text-cream-400 dark:hover:text-cream-100"
              >
                View in CRM
              </Link>
            ) : (
              <Link
                href={`/marketing/segments/${row.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:text-cream-400 dark:hover:text-cream-100"
              >
                View members
              </Link>
            )}
          </div>
          {row.kind === "custom" ? (
            <div className="mt-3 border-t border-cream-200 pt-3 dark:border-hairline-dark">
              <SegmentListQuickActions
                segmentId={row.id}
                segmentName={row.name}
              />
            </div>
          ) : null}
        </div>
        <Link
          href={`/marketing/segments/${row.id}`}
          className="shrink-0 self-center text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Open ${row.name}`}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </article>
  );
}

export function SegmentList({ autoRows, customRows }: SegmentListProps) {
  if (autoRows.length === 0 && customRows.length === 0) {
    return (
      <ModuleListPanel>
        <ModuleListPanelHeader
          title="Segments"
          subtitle="Group customers for targeted broadcasts"
          action={
            <Link
              href="/marketing/segments/new"
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700"
            >
              New segment
            </Link>
          }
        />
        <div className="px-4 py-12 text-center sm:px-5">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            No segments yet
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            Built-in segments appear once your CRM has customers with auto-tags.
          </p>
        </div>
      </ModuleListPanel>
    );
  }

  return (
    <ModuleListPanel>
      <ModuleListPanelHeader
        title="Segments"
        subtitle={`${autoRows.length + customRows.length} total · ${autoRows.length} built-in`}
        action={
          <Link
            href="/marketing/segments/new"
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700"
          >
            New segment
          </Link>
        }
      />
      <div className="space-y-8 p-4 sm:p-5">
      {autoRows.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Built-in segments
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Mirror VIP, repeat, new, at-risk, and dormant auto-tags. These
                update from your CRM — you can&apos;t edit or delete them.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {autoRows.map((row) => (
              <SegmentCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              {customRows.length > 0 ? "Your segments" : "Custom segments"}
            </h2>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Rule-based groups — edit or remove anytime from each card.
            </p>
          </div>
          {customRows.length === 0 ? (
            <Link
              href="/marketing/segments/new"
              className="text-xs font-semibold text-violet-700 hover:text-violet-800 dark:text-violet-300"
            >
              Create one
            </Link>
          ) : null}
        </div>
        {customRows.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {customRows.map((row) => (
              <SegmentCard key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 px-5 py-8 text-center dark:border-violet-900/40 dark:bg-violet-950/20">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              No custom segments yet — combine tags, spend, or inactivity rules.
            </p>
            <Link
              href="/marketing/segments/new"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
            >
              New segment
            </Link>
          </div>
        )}
      </section>
      </div>
    </ModuleListPanel>
  );
}
