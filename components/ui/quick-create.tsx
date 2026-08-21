"use client";

import type { LucideIcon } from "lucide-react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const PANEL_ACCENT: Record<
  string,
  { border: string; gradient: string; iconBg: string }
> = {
  sky: {
    border: "border-sky-200/80 dark:border-sky-900/40",
    gradient:
      "bg-gradient-to-br from-sky-50/80 via-white to-white dark:from-sky-950/20 dark:via-panel-dark dark:to-panel-dark",
    iconBg: "bg-brand-500",
  },
  brand: {
    border: "border-brand-200/80 dark:border-brand-900/40",
    gradient:
      "bg-gradient-to-br from-brand-50/80 via-white to-white dark:from-brand-700/10 dark:via-panel-dark dark:to-panel-dark",
    iconBg: "bg-brand-500",
  },
  emerald: {
    border: "border-emerald-200/80 dark:border-emerald-900/40",
    gradient:
      "bg-gradient-to-br from-emerald-50/80 via-white to-white dark:from-emerald-950/20 dark:via-panel-dark dark:to-panel-dark",
    iconBg: "bg-emerald-600",
  },
  rose: {
    border: "border-rose-200/80 dark:border-rose-900/40",
    gradient:
      "bg-gradient-to-br from-rose-50/80 via-white to-white dark:from-rose-950/20 dark:via-panel-dark dark:to-panel-dark",
    iconBg: "bg-rose-600",
  },
  violet: {
    border: "border-violet-200/80 dark:border-violet-900/40",
    gradient:
      "bg-gradient-to-br from-violet-50/80 via-white to-white dark:from-violet-950/20 dark:via-panel-dark dark:to-panel-dark",
    iconBg: "bg-violet-600",
  },
  amber: {
    border: "border-amber-200/80 dark:border-amber-900/40",
    gradient:
      "bg-gradient-to-br from-amber-50/80 via-white to-white dark:from-amber-950/20 dark:via-panel-dark dark:to-panel-dark",
    iconBg: "bg-amber-600",
  },
};

export type QuickCreateAccent = keyof typeof PANEL_ACCENT;

interface QuickActionBarProps {
  open: boolean;
  onToggle: () => void;
  actionLabel: string;
  closeLabel?: string;
  hint?: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  children?: React.ReactNode;
  className?: string;
  /** When false, hide the primary toggle (use children to open instead). */
  showPrimaryButton?: boolean;
}

export function QuickActionBar({
  open,
  onToggle,
  actionLabel,
  closeLabel = "Close",
  hint,
  search,
  children,
  className,
  showPrimaryButton = true,
}: QuickActionBarProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-cream-200/80 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-md dark:border-hairline-dark dark:bg-panel-dark/90",
        className,
      )}
    >
      {search ? (
        <div className="relative min-w-[10rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Search…"}
            className="w-full rounded-lg border border-cream-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
        </div>
      ) : null}
      {hint ? (
        <p className="hidden text-xs text-ink-muted dark:text-cream-400 sm:block">
          {hint}
        </p>
      ) : null}
      {children}
      {showPrimaryButton || open ? (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-brand-600 active:scale-[0.98]"
        >
          {open ? (
            <X className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2} />
          )}
          {open ? closeLabel : actionLabel}
        </button>
      ) : null}
    </div>
  );
}

interface QuickCreatePanelProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: QuickCreateAccent;
  open: boolean;
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
  className?: string;
}

export function QuickCreatePanel({
  title,
  subtitle,
  icon: Icon,
  accent = "brand",
  open,
  onSubmit,
  children,
  className,
}: QuickCreatePanelProps) {
  if (!open) return null;

  const styles = PANEL_ACCENT[accent] ?? PANEL_ACCENT.brand;
  const inner = (
    <>
      <div className="flex items-center gap-2">
        {Icon ? (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl text-white",
              styles.iconBg,
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div>
          <h2 className="text-sm font-bold text-ink dark:text-cream-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </>
  );

  const shell = cn(
    "space-y-4 rounded-2xl border p-5 shadow-card",
    styles.border,
    styles.gradient,
    className,
  );

  if (onSubmit) {
    return (
      <form onSubmit={onSubmit} className={shell}>
        {inner}
      </form>
    );
  }

  return <div className={shell}>{inner}</div>;
}

interface QuickCreateActionsProps {
  submitLabel: string;
  loading?: boolean;
  onCancel: () => void;
  cancelLabel?: string;
}

export function QuickCreateActions({
  submitLabel,
  loading = false,
  onCancel,
  cancelLabel = "Cancel",
}: QuickCreateActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={onCancel}
        className="rounded-xl border border-cream-300 px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-hairline-dark/40"
      >
        {cancelLabel}
      </button>
    </div>
  );
}
