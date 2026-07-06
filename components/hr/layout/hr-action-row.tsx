import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type HrActionTone = "brand" | "accent" | "neutral";

const ICON_BG: Record<HrActionTone, string> = {
  brand: "bg-[#EEF3FE]",
  accent: "bg-[#FFF7ED]",
  neutral: "bg-[#F2EDE3]",
};

interface HrActionRowProps {
  href: string;
  title: string;
  helper: string;
  icon: LucideIcon;
  tone?: HrActionTone;
  className?: string;
}

export function HrActionRow({
  href,
  title,
  helper,
  icon: Icon,
  tone = "brand",
  className,
}: HrActionRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-[#E5E0D8] bg-white p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/30 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-800",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px]",
          ICON_BG[tone],
        )}
      >
        <Icon className="h-6 w-6 text-brand-700 dark:text-brand-200" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-ink dark:text-cream-100">
          {title}
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-ink-muted dark:text-cream-400">
          {helper}
        </span>
      </span>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-ink-subtle dark:text-cream-500"
        strokeWidth={2}
      />
    </Link>
  );
}
