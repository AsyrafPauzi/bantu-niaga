"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { buildCustomersExportUrl } from "@/lib/marketing/customers-export-url";
import { formatMyr } from "@/lib/marketing/metrics";
import {
  MODULE_LIST_TABLE_HEAD_CLASS,
  MODULE_LIST_TABLE_BODY_CLASS,
  MODULE_LIST_TABLE_ROW_CLASS,
} from "@/components/dashboard/module-list-panel";
import { cn } from "@/lib/utils/cn";

export interface CustomerListSelectableRow {
  id: string;
  name: string;
  phone_e164: string | null;
  auto_tags: string[];
  manual_tags: string[];
  total_spend_myr: number;
  order_count: number;
  last_purchase_at: string | null;
}

interface CustomerListSelectableProps {
  rows: CustomerListSelectableRow[];
  sort: {
    field: string;
    order: string;
    hrefs: {
      name: string;
      total_spend_myr: string;
      last_purchase_at: string;
    };
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function segmentFromTags(autoTags: string[]): {
  label: string;
  tone: "accent" | "brand" | "success" | "warning" | "neutral";
} {
  if (autoTags.includes("vip")) return { label: "VIP", tone: "accent" };
  if (autoTags.includes("at-risk")) return { label: "At-risk", tone: "warning" };
  if (autoTags.includes("repeat")) return { label: "Repeat", tone: "brand" };
  if (autoTags.includes("new")) return { label: "New", tone: "success" };
  if (autoTags.includes("dormant")) return { label: "Dormant", tone: "neutral" };
  return { label: "—", tone: "neutral" };
}

function fmtRel(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export function CustomerListSelectable({
  rows,
  sort,
}: CustomerListSelectableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setError(null);
  }

  function exportSelected() {
    const ids = [...selected];
    const href = buildCustomersExportUrl({ ids: ids.join(",") });
    window.location.href = href;
  }

  async function removeSelected() {
    const ids = [...selected];
    const ok = confirm(
      `Remove ${ids.length} customer${ids.length === 1 ? "" : "s"} from your CRM?\n\nThey will be hidden from lists and exports. Linked invoices and sales stay intact.`,
    );
    if (!ok) return;

    setError(null);
    try {
      const res = await fetch("/api/marketing/customers/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = (await res.json().catch(() => null)) as
        | {
            deleted?: number;
            failed?: number;
            error?: string;
            failures?: Array<{ id: string; error: string }>;
          }
        | null;

      if (!res.ok && (body?.deleted ?? 0) === 0) {
        setError(body?.error ?? `Could not remove (HTTP ${res.status})`);
        return;
      }

      const deleted = body?.deleted ?? 0;
      const failed = body?.failed ?? 0;

      startTransition(() => {
        clearSelection();
        router.refresh();
      });

      if (failed > 0) {
        setError(
          `Removed ${deleted}. ${failed} could not be removed (already deleted or not found).`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }

  if (rows.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400">
        No customers match the current filters.
      </p>
    );
  }

  return (
    <>
      {someSelected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-200 bg-violet-50/80 px-4 py-3 dark:border-violet-900/40 dark:bg-violet-950/30 sm:px-5">
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
            {selected.size} selected
            <button
              type="button"
              onClick={clearSelection}
              className="ml-2 text-xs font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
            >
              Clear
            </button>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={exportSelected}
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Export selected
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={removeSelected}
              disabled={pending}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              {pending ? "Removing…" : "Remove selected"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 sm:px-5"
        >
          {error}
        </p>
      ) : null}

      <div className="hidden lg:block">
        <table className="min-w-full text-sm">
          <thead className={MODULE_LIST_TABLE_HEAD_CLASS}>
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={togglePage}
                  aria-label="Select all on this page"
                  className="h-4 w-4 rounded border-cream-300 text-violet-600 focus:ring-violet-500"
                />
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader
                  label="Customer"
                  active={sort.field === "name"}
                  order={sort.order}
                  href={sort.hrefs.name}
                />
              </th>
              <th className="px-3 py-3 text-left">Segment</th>
              <th className="px-3 py-3 text-left">Tags</th>
              <th className="px-3 py-3 text-left">Phone</th>
              <th className="px-3 py-3 text-right">
                <SortHeader
                  label="Spend"
                  active={sort.field === "total_spend_myr"}
                  order={sort.order}
                  href={sort.hrefs.total_spend_myr}
                  align="right"
                />
              </th>
              <th className="px-3 py-3 text-right">Orders</th>
              <th className="px-5 py-3 text-right">
                <SortHeader
                  label="Last purchase"
                  active={sort.field === "last_purchase_at"}
                  order={sort.order}
                  href={sort.hrefs.last_purchase_at}
                  align="right"
                />
              </th>
            </tr>
          </thead>
          <tbody className={MODULE_LIST_TABLE_BODY_CLASS}>
            {rows.map((row) => {
              const seg = segmentFromTags(row.auto_tags);
              const tags = [
                ...row.manual_tags.slice(0, 2),
                ...row.auto_tags
                  .filter(
                    (t) =>
                      !["vip", "repeat", "new", "dormant", "at-risk"].includes(
                        t,
                      ),
                  )
                  .slice(0, 1),
              ].slice(0, 2);
              const isSelected = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "bg-panel-light dark:bg-panel-dark",
                    isSelected
                      ? "bg-violet-50/60 dark:bg-violet-950/20"
                      : "hover:bg-cream-100/60 dark:hover:bg-hairline-dark/40",
                  )}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.name}`}
                      className="h-4 w-4 rounded border-cream-300 text-violet-600 focus:ring-violet-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/marketing/customers/${row.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                        {initialsOf(row.name)}
                      </span>
                      <span className="font-semibold text-ink hover:text-brand-700 dark:text-cream-100">
                        {row.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill tone={seg.tone}>{seg.label}</StatusPill>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {tags.length === 0 ? (
                        <span className="text-xs text-ink-subtle">—</span>
                      ) : (
                        tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-ink-muted dark:bg-hairline-dark dark:text-cream-400"
                          >
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-ink-muted dark:text-cream-400">
                    {row.phone_e164 ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                    {formatMyr(row.total_spend_myr)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-muted dark:text-cream-400">
                    {row.order_count}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                    {fmtRel(row.last_purchase_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-cream-200 lg:hidden dark:divide-hairline-dark">
        {rows.map((row) => {
          const seg = segmentFromTags(row.auto_tags);
          const isSelected = selected.has(row.id);
          return (
            <div
              key={row.id}
              className={cn(
                "flex items-center gap-2 px-3 py-3",
                isSelected && "bg-violet-50/60 dark:bg-violet-950/20",
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOne(row.id)}
                aria-label={`Select ${row.name}`}
                className="h-4 w-4 shrink-0 rounded border-cream-300 text-violet-600 focus:ring-violet-500"
              />
              <Link
                href={`/marketing/customers/${row.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  {initialsOf(row.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                    {row.name}
                  </p>
                  <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                    {row.phone_e164 ?? "no phone"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
                    {formatMyr(row.total_spend_myr)}
                  </p>
                  <StatusPill tone={seg.tone}>{seg.label}</StatusPill>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SortHeader({
  label,
  active,
  order,
  href,
  align = "left",
}: {
  label: string;
  active: boolean;
  order: string;
  href: string;
  align?: "left" | "right";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 hover:text-brand-700 dark:hover:text-brand-200",
        align === "right" && "justify-end",
        active && "text-brand-700 dark:text-brand-200",
      )}
    >
      {label}
      {active ? (
        <span className="text-[10px] font-bold" aria-hidden>
          {order === "asc" ? "↑" : "↓"}
        </span>
      ) : null}
    </Link>
  );
}
