import type { BalanceLine } from "@/lib/hr/leave-balance-display";
import { cn } from "@/lib/utils/cn";

export function HrLeaveBalanceStrip({
  lines,
  className,
  highlightKey,
}: {
  lines: BalanceLine[];
  className?: string;
  highlightKey?: BalanceLine["key"];
}) {
  return (
    <div
      className={cn(
        "grid gap-2 grid-cols-2 md:grid-cols-4",
        className,
      )}
    >
      {lines.map((line) => {
        const configured = line.entitlement != null;
        const active = highlightKey === line.key;
        return (
          <div
            key={line.key}
            className={cn(
              "rounded-lg border px-3 py-2",
              active
                ? "border-teal-300 bg-teal-50/80 dark:border-teal-800 dark:bg-teal-950/30"
                : "border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-500">
              {line.label}
            </p>
            {configured ? (
              <p className="mt-0.5 text-sm font-bold tabular-nums text-ink dark:text-cream-100">
                {line.remaining} left
                <span className="text-xs font-semibold text-ink-muted dark:text-cream-400">
                  {" "}
                  / {line.entitlement}
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm font-semibold text-ink-subtle dark:text-cream-500">
                Not configured
              </p>
            )}
            {configured && line.used != null ? (
              <p className="text-[11px] text-ink-muted dark:text-cream-500">
                {line.used} used
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
