import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export type SortOrder = "asc" | "desc";

/* ─── Table wrapper (handles horizontal scroll) ──────────────── */

export function TableWrapper({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("w-full overflow-x-auto overscroll-x-contain scrollbar-thin -mx-0", className)} {...props} />
  );
}

/* ─── Table ──────────────────────────────────────────────────── */

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full caption-bottom text-sm border-collapse", className)}
      {...props}
    />
  );
}

/* ─── TableHead ──────────────────────────────────────────────── */

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("border-b border-hairline-light dark:border-hairline-dark", className)} {...props} />
  );
}

/* ─── TableBody ──────────────────────────────────────────────── */

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-hairline-light dark:divide-hairline-dark", className)}
      {...props}
    />
  );
}

/* ─── TableFooter ────────────────────────────────────────────── */

export function TableFooter({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "border-t border-hairline-light dark:border-hairline-dark",
        "bg-cream-50 dark:bg-panel-dark/50",
        "font-medium text-ink dark:text-cream-100",
        className,
      )}
      {...props}
    />
  );
}

/* ─── TableRow ───────────────────────────────────────────────── */

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  clickable?: boolean;
}

export function TableRow({ clickable, className, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        "transition-colors",
        clickable && "cursor-pointer hover:bg-cream-50 dark:hover:bg-hairline-dark/30",
        className,
      )}
      {...props}
    />
  );
}

/* ─── TableHeaderCell ────────────────────────────────────────── */

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider",
        "text-ink-muted dark:text-cream-400 whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

/* ─── TableDataCell ──────────────────────────────────────────── */

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-4 py-3.5 text-sm text-ink dark:text-cream-100 align-middle",
        className,
      )}
      {...props}
    />
  );
}

/* ─── TableColHide ───────────────────────────────────────────── */
/**
 * Wraps a <Th> or <Td> to hide it on mobile and restore it at the given
 * breakpoint. Use for secondary columns that aren't critical on small screens.
 *
 * Usage: <TableColHide at="sm"><Td>...</Td></TableColHide>
 */
interface TableColHideProps extends HTMLAttributes<HTMLTableCellElement> {
  at?: "sm" | "md" | "lg";
}

export function TableColHide({ at = "sm", className, ...props }: TableColHideProps) {
  const show = at === "sm" ? "hidden sm:table-cell" : at === "md" ? "hidden md:table-cell" : "hidden lg:table-cell";
  return <td className={cn(show, className)} {...props} />;
}

export function ThHide({ at = "sm", className, ...props }: TableColHideProps) {
  const show = at === "sm" ? "hidden sm:table-cell" : at === "md" ? "hidden md:table-cell" : "hidden lg:table-cell";
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider",
        "text-ink-muted dark:text-cream-400 whitespace-nowrap",
        show,
        className,
      )}
      {...props}
    />
  );
}

/* ─── SortableTh ─────────────────────────────────────────────── */
/**
 * A sortable table header cell that builds a URL with `sort` and `order` query
 * params. Integrates with any page that uses URL-driven sorting.
 */
export function SortableTh({
  label,
  field,
  currentSort,
  currentOrder,
  basePath,
  searchParams,
  className,
  align = "left",
}: {
  label: string;
  field: string;
  currentSort: string;
  currentOrder: SortOrder;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  className?: string;
  align?: "left" | "right";
}) {
  const isActive = currentSort === field;
  const nextOrder: SortOrder =
    isActive && currentOrder === "desc" ? "asc" : "desc";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }
  params.set("sort", field);
  params.set("order", nextOrder);
  params.delete("page");

  const Icon = isActive
    ? currentOrder === "desc"
      ? ChevronDown
      : ChevronUp
    : ChevronsUpDown;

  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider",
        "text-ink-muted dark:text-cream-400 whitespace-nowrap",
        className,
      )}
    >
      <Link
        href={`${basePath}?${params.toString()}`}
        className={cn(
          "inline-flex items-center gap-0.5 font-semibold transition-colors hover:text-ink",
          align === "right" && "justify-end",
        )}
        aria-sort={
          isActive
            ? currentOrder === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        {label}
        <Icon
          className={cn("h-3 w-3 shrink-0", !isActive && "opacity-35")}
          aria-hidden
        />
      </Link>
    </th>
  );
}

/* ─── TableCaption ───────────────────────────────────────────── */

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <caption
      className={cn("mt-4 text-sm text-ink-muted dark:text-cream-400", className)}
      {...props}
    />
  );
}
