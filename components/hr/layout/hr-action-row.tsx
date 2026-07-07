import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";

type HrActionTone = "brand" | "accent" | "neutral";

const ICON_BG: Record<HrActionTone, string> = {
  brand: "bg-[#EEF3FE]",
  accent: "bg-[#FFF7ED]",
  neutral: "bg-[#F2EDE3]",
};

interface HrActionRowProps {
  href?: string;
  title: string;
  helper: string;
  icon: LucideIcon;
  tone?: HrActionTone;
  className?: string;
  /** When true, row is not clickable (e.g. marketplace add-on coming soon). */
  disabled?: boolean;
  badge?: string;
}

export function HrActionRow({
  href,
  title,
  helper,
  icon: Icon,
  tone = "brand",
  className,
  disabled = false,
  badge,
}: HrActionRowProps) {
  const content = (
    <>
      <span
        className={cn(
          "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px]",
          ICON_BG[tone],
          disabled && "opacity-60",
        )}
      >
        <Icon className="h-6 w-6 text-brand-700 dark:text-brand-200" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-base font-bold text-ink dark:text-cream-100",
              disabled && "text-ink-muted dark:text-cream-400",
            )}
          >
            {title}
          </span>
          {badge ? (
            <Badge tone="neutral" className="text-[10px] uppercase tracking-wide">
              {badge}
            </Badge>
          ) : null}
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-ink-muted dark:text-cream-400">
          {helper}
        </span>
      </span>
      {!disabled ? (
        <ChevronRight
          className="h-5 w-5 shrink-0 text-ink-subtle dark:text-cream-500"
          strokeWidth={2}
        />
      ) : null}
    </>
  );

  const shellClass = cn(
    "flex items-center gap-4 rounded-2xl border border-[#E5E0D8] bg-white p-5 dark:border-hairline-dark dark:bg-panel-dark",
    disabled
      ? "cursor-not-allowed opacity-75"
      : "transition-colors hover:border-brand-300 hover:bg-brand-50/30 dark:hover:border-brand-800",
    className,
  );

  if (disabled || !href) {
    return (
      <div className={shellClass} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={shellClass}>
      {content}
    </Link>
  );
}
