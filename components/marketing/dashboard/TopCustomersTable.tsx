import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";
import { TagBadge } from "@/components/marketing/TagBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { TopCustomerRow } from "@/lib/marketing/dashboard-queries";

interface TopCustomersTableProps {
  rows: TopCustomerRow[];
  className?: string;
}

const AVATAR_BG = [
  "bg-brand-500",
  "bg-accent-500",
  "bg-status-success",
  "bg-[#2D6A8A]",
  "bg-[#8C5C0A]",
];

function formatMyr(value: number): string {
  if (!Number.isFinite(value)) return "RM 0";
  if (value >= 10_000) {
    return `RM ${value.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
  }
  return `RM ${value.toFixed(2)}`;
}

function initial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export function TopCustomersTable({
  rows,
  className,
}: TopCustomersTableProps) {
  if (rows.length === 0) {
    return (
      <div className={cn("flex flex-col items-start gap-3 rounded-lg border border-dashed border-hairline-light bg-cream-50 p-5 dark:border-hairline-dark dark:bg-panel-dark/40", className)}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <UserPlus className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink dark:text-cream-100">
            No top customers yet
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            Once Operations / Finance push events, your top spenders will surface here automatically.
          </p>
        </div>
        <Link href="/marketing/customers/new">
          <Button size="sm">Add a customer</Button>
        </Link>
      </div>
    );
  }

  return (
    <ul className={cn("divide-y divide-hairline-light dark:divide-hairline-dark", className)}>
      {rows.map((row, i) => (
        <li key={row.id}>
          <Link
            href={`/marketing/customers/${row.id}`}
            className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-cream-100 dark:hover:bg-hairline-dark/40"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                AVATAR_BG[i % AVATAR_BG.length],
              )}
            >
              {initial(row.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                {row.name}
              </p>
              <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                {row.phone_e164 ?? "no phone"} · {row.order_count.toLocaleString("en-MY")} orders
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold text-ink dark:text-cream-100">
                {formatMyr(row.total_spend_myr)}
              </span>
              <div className="flex flex-wrap justify-end gap-1">
                {row.auto_tags.slice(0, 2).map((t) => (
                  <TagBadge key={t} label={t} kind="auto" />
                ))}
              </div>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-ink-muted dark:text-cream-400"
              strokeWidth={2}
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
