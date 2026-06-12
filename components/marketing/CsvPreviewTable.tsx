"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type {
  CreateOutcome,
  MergeOutcome,
  RejectOutcome,
} from "@/lib/marketing/csv-classify";

/**
 * <CsvPreviewTable> — three-tab view of the dry-run outcomes.
 *
 * Tabs: Created | Merged | Rejected. Each tab shows a filterable
 * table sorted by row_number. Per-row reason is rendered for the
 * rejected tab; existing-name is rendered for the merged tab.
 */

export interface CsvPreviewTableProps {
  created: readonly CreateOutcome[];
  merged: readonly MergeOutcome[];
  rejected: readonly RejectOutcome[];
}

type Tab = "created" | "merged" | "rejected";

export function CsvPreviewTable({
  created,
  merged,
  rejected,
}: CsvPreviewTableProps) {
  const [tab, setTab] = useState<Tab>(
    rejected.length > 0 ? "rejected" : "created",
  );
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filterFn = (text: string) =>
      q.length === 0 || text.toLowerCase().includes(q);
    if (tab === "created") {
      return created.filter((r) =>
        filterFn(`${r.row_number} ${r.name} ${r.phone_e164}`),
      );
    }
    if (tab === "merged") {
      return merged.filter((r) =>
        filterFn(`${r.row_number} ${r.name} ${r.phone_e164} ${r.existing_name}`),
      );
    }
    return rejected.filter((r) =>
      filterFn(`${r.row_number} ${r.name} ${r.phone} ${r.reason}`),
    );
  }, [tab, filter, created, merged, rejected]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-cream-200 dark:border-hairline-dark">
        <TabButton
          active={tab === "created"}
          onClick={() => setTab("created")}
          label="Created"
          count={created.length}
          tone="success"
        />
        <TabButton
          active={tab === "merged"}
          onClick={() => setTab("merged")}
          label="Merged"
          count={merged.length}
          tone="info"
        />
        <TabButton
          active={tab === "rejected"}
          onClick={() => setTab("rejected")}
          label="Rejected"
          count={rejected.length}
          tone="danger"
        />
        <input
          type="search"
          placeholder="Filter by row, name, phone, reason…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="ml-auto rounded-md border border-cream-300 bg-panel-light px-3 py-1.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-cream-200 bg-cream-100 px-3 py-4 text-center text-sm text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400">
          {filter
            ? "No rows match that filter."
            : tab === "rejected"
              ? "No rejected rows. 🎉"
              : "Nothing in this category."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-cream-200 dark:border-hairline-dark">
          <table className="min-w-full text-sm">
            <thead className="bg-cream-100 text-left text-xs uppercase tracking-wider text-ink-muted dark:bg-panel-dark dark:text-cream-400">
              <tr>
                <th className="px-3 py-2 w-20">Row</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                {tab === "merged" && <th className="px-3 py-2">Merges into</th>}
                {tab === "rejected" && <th className="px-3 py-2">Reason</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {rows.map((r) => (
                <tr
                  key={`${tab}-${r.row_number}`}
                  className="text-ink dark:text-cream-100"
                >
                  <td className="px-3 py-2 font-mono tabular-nums text-ink-muted dark:text-cream-400">
                    {r.row_number}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.name || <em>—</em>}</td>
                  <td className="px-3 py-2 font-mono">
                    {tab === "rejected"
                      ? (r as RejectOutcome).phone || <em>—</em>
                      : (r as CreateOutcome | MergeOutcome).phone_e164}
                  </td>
                  {tab === "merged" && (
                    <td className="px-3 py-2 text-ink-muted dark:text-cream-400">
                      {(r as MergeOutcome).existing_name}
                    </td>
                  )}
                  {tab === "rejected" && (
                    <td className="px-3 py-2 text-status-danger">
                      {(r as RejectOutcome).reason}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: "success" | "info" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand-500 text-ink dark:text-cream-100"
          : "border-transparent text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100",
      )}
    >
      {label}
      <span
        className={cn(
          "ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
          tone === "success" &&
            "bg-[#D5EBD5] text-[#1F5E1F] dark:bg-[#1B3A1B] dark:text-[#A6D6A6]",
          tone === "info" &&
            "bg-[#DCE9F5] text-[#1F4E6E] dark:bg-[#1A2E3F] dark:text-[#9CC3DC]",
          tone === "danger" &&
            "bg-[#F8DDD9] text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]",
        )}
      >
        {count}
      </span>
    </button>
  );
}
