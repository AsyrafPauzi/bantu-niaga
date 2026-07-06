import { Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface HrInfoBannerProps {
  title: string;
  description: string;
  className?: string;
}

export function HrInfoBanner({ title, description, className }: HrInfoBannerProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-[14px] border border-[#D5E2FB] bg-[#EEF3FE] p-4 dark:border-brand-900/60 dark:bg-brand-900/20",
        className,
      )}
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-200" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink dark:text-cream-100">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted dark:text-cream-400">
          {description}
        </p>
      </div>
    </div>
  );
}
