import { cn } from "@/lib/utils/cn";

type PillTone = "success" | "danger" | "warning" | "brand" | "accent" | "neutral";

const PILL_TONE: Record<PillTone, string> = {
  success: "bg-status-success/15 text-status-success",
  danger: "bg-status-danger/15 text-status-danger",
  warning: "bg-status-warning/20 text-[#8C5C0A] dark:text-[#F5C97A]",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  accent: "bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200",
  neutral: "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
};

interface StatusPillProps {
  children: string;
  tone?: PillTone;
  className?: string;
}

/**
 * Tiny status chip — inline equivalent of the Pencil "Status chip" component.
 */
export function StatusPill({
  children,
  tone = "brand",
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
