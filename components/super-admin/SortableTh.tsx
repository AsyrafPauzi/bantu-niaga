import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SortOrder } from "@/lib/super-admin/table-sort";

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
    <th className={className}>
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
