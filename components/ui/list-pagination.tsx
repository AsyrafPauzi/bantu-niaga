import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { totalPages } from "@/lib/pagination";

interface ListPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
  pageKey?: string;
  className?: string;
  /** Hide when all rows fit on one page (default true). */
  hideOnSinglePage?: boolean;
}

function buildHref(
  basePath: string,
  searchParams: Record<string, string | undefined>,
  pageKey: string,
  nextPage: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && key !== pageKey) {
      params.set(key, value);
    }
  }
  if (nextPage > 1) {
    params.set(pageKey, String(nextPage));
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function visiblePageNumbers(current: number, pages: number): number[] {
  const maxButtons = 5;
  if (pages <= maxButtons) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }
  let start = Math.max(1, current - 2);
  let end = Math.min(pages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function PageLink({
  disabled,
  href,
  label,
  children,
  active,
}: {
  disabled: boolean;
  href: string;
  label: string;
  children?: ReactNode;
  active?: boolean;
}) {
  if (disabled) {
    return (
      <span
        aria-label={label}
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-cream-200 px-2 text-xs text-ink-muted opacity-40 dark:border-hairline-dark"
      >
        {children ?? label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors",
        active
          ? "border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-600 dark:bg-brand-950/40 dark:text-brand-100"
          : "border-cream-300 text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-panel-dark",
      )}
    >
      {children ?? label}
    </Link>
  );
}

export function ListPagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams = {},
  pageKey = "page",
  className,
  hideOnSinglePage = true,
}: ListPaginationProps) {
  const pages = totalPages(total, pageSize);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  if (total === 0 || (hideOnSinglePage && total <= pageSize)) {
    return null;
  }

  const pageNums = visiblePageNumbers(page, pages);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 px-4 py-3 text-xs text-ink-muted dark:border-hairline-dark dark:text-cream-400",
        className,
      )}
    >
      <span>
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <PageLink
          disabled={page <= 1}
          href={buildHref(basePath, searchParams, pageKey, page - 1)}
          label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageLink>
        {pageNums.map((n) => (
          <PageLink
            key={n}
            disabled={false}
            href={buildHref(basePath, searchParams, pageKey, n)}
            label={`Page ${n}`}
            active={n === page}
          >
            {n}
          </PageLink>
        ))}
        <PageLink
          disabled={page >= pages}
          href={buildHref(basePath, searchParams, pageKey, page + 1)}
          label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PageLink>
      </div>
    </div>
  );
}
