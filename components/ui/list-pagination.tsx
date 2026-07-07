import Link from "next/link";
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

function PageLink({
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
      <span className="rounded-md border border-cream-300 px-3 py-1 text-xs text-ink-muted opacity-50 dark:border-hairline-dark">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-cream-300 px-3 py-1 text-xs font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-panel-dark"
    >
      {label}
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
}: ListPaginationProps) {
  const pages = totalPages(total, pageSize);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  if (total <= pageSize) {
    return (
      <div
        className={cn(
          "flex items-center justify-between border-t border-cream-300 px-5 py-3 text-xs text-ink-muted dark:border-hairline-dark",
          className,
        )}
      >
        <span>
          {total === 0 ? "No rows" : `Showing ${total} of ${total}`}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-cream-300 px-5 py-3 text-xs text-ink-muted dark:border-hairline-dark",
        className,
      )}
    >
      <span>
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <span>
          Page {page} of {pages}
        </span>
        <div className="flex gap-1">
          <PageLink
            disabled={page <= 1}
            href={buildHref(basePath, searchParams, pageKey, page - 1)}
            label="Previous"
          />
          <PageLink
            disabled={page >= pages}
            href={buildHref(basePath, searchParams, pageKey, page + 1)}
            label="Next"
          />
        </div>
      </div>
    </div>
  );
}
