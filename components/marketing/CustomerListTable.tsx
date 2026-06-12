import Link from "next/link";
import { Card } from "@/components/ui/card";
import { TagBadge } from "@/components/marketing/TagBadge";
import { cn } from "@/lib/utils/cn";
import type { CustomerListRow, ListSortField, ListSortOrder } from "./types";

/**
 * Desktop dense table of customers.
 *
 * Sortable headers are rendered as `<Link>` to a new query-string URL so
 * the page is a server component and re-renders with the new sort + a
 * fresh DB read. No client state.
 */

interface CustomerListTableProps {
  customers: CustomerListRow[];
  page: number;
  pageSize: number;
  total: number;
  sort: ListSortField;
  order: ListSortOrder;
  /**
   * Pass-through of the current search params except `page` / `sort` /
   * `order`, so we can compose links that preserve filters.
   */
  baseSearchParams: URLSearchParams;
  basePath?: string;
  className?: string;
}

function fmtMyr(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `RM ${n.toFixed(2)}`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function withParams(
  base: URLSearchParams,
  overrides: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams(base.toString());
  for (const [k, v] of Object.entries(overrides)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  }
  const s = next.toString();
  return s ? `?${s}` : "";
}

export function CustomerListTable({
  customers,
  page,
  pageSize,
  total,
  sort,
  order,
  baseSearchParams,
  basePath = "/marketing/customers",
  className,
}: CustomerListTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function sortLink(field: ListSortField, label: string) {
    const nextOrder: ListSortOrder =
      sort === field && order === "desc" ? "asc" : "desc";
    const href = `${basePath}${withParams(baseSearchParams, {
      sort: field,
      order: nextOrder,
      page: "1",
    })}`;
    const indicator = sort === field ? (order === "desc" ? "▼" : "▲") : "";
    return (
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-left font-medium text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        {label}
        {indicator && <span aria-hidden>{indicator}</span>}
      </Link>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-cream-100 text-xs uppercase tracking-wider dark:bg-panel-dark/40">
            <tr>
              <th className="px-4 py-2 text-left">{sortLink("name", "Name")}</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-left">Tags</th>
              <th className="px-4 py-2 text-right">
                {sortLink("total_spend_myr", "Total spend")}
              </th>
              <th className="px-4 py-2 text-right">Orders</th>
              <th className="px-4 py-2 text-right">
                {sortLink("last_purchase_at", "Last purchase")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {customers.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-ink-muted dark:text-cream-400"
                >
                  No customers match the current filters.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-cream-100/60 dark:hover:bg-panel-dark/40"
                >
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={`${basePath}/${c.id}`}
                      className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {c.name}
                    </Link>
                    {c.email && (
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {c.email}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-ink dark:text-cream-100">
                    {c.phone_e164 ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {(c.auto_tags ?? []).map((t) => (
                        <TagBadge key={`a-${t}`} label={t} kind="auto" />
                      ))}
                      {(c.manual_tags ?? []).map((t) => (
                        <TagBadge key={`m-${t}`} label={t} kind="manual" />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-right tabular-nums text-ink dark:text-cream-100">
                    {fmtMyr(c.total_spend_myr)}
                  </td>
                  <td className="px-4 py-3 align-top text-right tabular-nums text-ink-muted dark:text-cream-400">
                    {c.order_count}
                  </td>
                  <td className="px-4 py-3 align-top text-right text-ink-muted dark:text-cream-400">
                    {fmtDate(c.last_purchase_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3 text-sm text-ink-muted dark:border-hairline-dark dark:text-cream-400">
        <span>
          Showing {customers.length === 0 ? 0 : (page - 1) * pageSize + 1}–
          {(page - 1) * pageSize + customers.length} of {total}
        </span>
        <div className="flex gap-1">
          <PaginationLink
            disabled={page <= 1}
            href={`${basePath}${withParams(baseSearchParams, {
              sort,
              order,
              page: String(page - 1),
            })}`}
            label="Previous"
          />
          <PaginationLink
            disabled={page >= totalPages}
            href={`${basePath}${withParams(baseSearchParams, {
              sort,
              order,
              page: String(page + 1),
            })}`}
            label="Next"
          />
        </div>
      </div>
    </Card>
  );
}

function PaginationLink({
  disabled,
  href,
  label,
}: {
  disabled: boolean;
  href: string;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-cream-200 px-3 py-1 text-xs text-ink-muted opacity-50 dark:border-hairline-dark">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-cream-200 px-3 py-1 text-xs text-ink hover:bg-cream-200 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-panel-dark"
    >
      {label}
    </Link>
  );
}
