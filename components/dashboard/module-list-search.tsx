"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ListFilterAccent =
  | "violet"
  | "teal"
  | "blue"
  | "sky"
  | "emerald"
  | "amber"
  | "brand";

const CHIP_ACTIVE: Record<ListFilterAccent, string> = {
  violet: "border-violet-500 bg-violet-500 text-white shadow-sm",
  teal: "border-[#0D9488] bg-[#0D9488] text-white shadow-sm",
  blue: "border-[#2563EB] bg-[#2563EB] text-white shadow-sm",
  sky: "border-sky-500 bg-sky-500 text-white shadow-sm",
  emerald: "border-emerald-500 bg-emerald-500 text-white shadow-sm",
  amber: "border-amber-500 bg-amber-500 text-white shadow-sm",
  brand: "border-brand-500 bg-brand-500 text-white shadow-sm",
};

const CHIP_IDLE =
  "border-cream-300 bg-white text-ink-muted hover:border-cream-400 hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400";

export function listFilterChipClass(active: boolean, accent: ListFilterAccent = "violet") {
  return cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
    active ? CHIP_ACTIVE[accent] : CHIP_IDLE,
  );
}

export function ModuleListSearchBar({
  value,
  onChange,
  placeholder = "Search…",
  onClear,
  clearLabel = "Clear",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex flex-1 items-center gap-2 rounded-xl border border-cream-300 bg-cream-50/50 px-3 py-2.5 dark:border-hairline-dark dark:bg-panel-dark/60">
        <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2} />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100"
        />
      </div>
      {onClear ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
          >
            {clearLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ModuleListFilterChipButton({
  active,
  accent = "violet",
  onClick,
  label,
  count,
}: {
  active: boolean;
  accent?: ListFilterAccent;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={listFilterChipClass(active, accent)}
    >
      {label}
      {count != null ? (
        <span
          className={cn(
            "tabular-nums",
            active ? "text-white/90" : "text-ink-subtle dark:text-cream-500",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function ModuleListFilterChipLink({
  active,
  accent = "violet",
  href,
  label,
  count,
  className,
}: {
  active: boolean;
  accent?: ListFilterAccent;
  href: string;
  label: string;
  count?: number;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(listFilterChipClass(active, accent), className)}>
      {label}
      {count != null && count > 0 ? (
        <span
          className={cn(
            "tabular-nums",
            active ? "text-white/90" : "text-ink-subtle dark:text-cream-500",
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
