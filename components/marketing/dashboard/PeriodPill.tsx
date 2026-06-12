import { Calendar } from "lucide-react";

/**
 * Read-only visual period indicator. v1 ships with "This month" as the
 * locked period (matches the M6 RPC's `new_this_month` axis). When we
 * upgrade the dashboard helpers to take a period parameter, this chip
 * can swap in a real client-side selector.
 */
export function PeriodPill({ label = "This month" }: { label?: string }) {
  return (
    <span
      data-testid="period-pill"
      className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-panel-light px-3 py-1 text-xs font-medium text-brand-700 shadow-card dark:border-brand-900/60 dark:bg-panel-dark dark:text-brand-200"
    >
      <Calendar className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
      {label}
    </span>
  );
}
