import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type RowTone = "success" | "danger" | "warning" | "brand" | "neutral";

const TONE_BG: Record<RowTone, string> = {
  success: "bg-status-success/10 text-status-success",
  danger: "bg-status-danger/10 text-status-danger",
  warning: "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  neutral: "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
};

const TONE_AMOUNT: Record<RowTone, string> = {
  success: "text-status-success",
  danger: "text-status-danger",
  warning: "text-[#8C5C0A] dark:text-[#F5C97A]",
  brand: "text-brand-700 dark:text-brand-200",
  neutral: "text-ink dark:text-cream-100",
};

interface TxRowProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  amount: string;
  tone?: RowTone;
  className?: string;
}

/**
 * Icon + 2-line text + right-aligned amount row.
 *
 * Used for "Recent transactions" (Finance), "Recent orders" (Ops), and
 * "Pending approvals" (HR) on each pillar dashboard.
 */
export function TxRow({
  icon: Icon,
  title,
  subtitle,
  amount,
  tone = "brand",
  className,
}: TxRowProps) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5", className)}>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          TONE_BG[tone],
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
          {title}
        </p>
        <p className="truncate text-xs text-ink-muted dark:text-cream-400">
          {subtitle}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          TONE_AMOUNT[tone],
        )}
      >
        {amount}
      </p>
    </div>
  );
}
