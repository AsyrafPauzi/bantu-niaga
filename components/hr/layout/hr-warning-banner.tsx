import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface HrWarningBannerProps {
  title: string;
  description: string;
  className?: string;
}

export function HrWarningBanner({
  title,
  description,
  className,
}: HrWarningBannerProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-[14px] border border-[#FED7AA] bg-[#FFF7ED] p-4 dark:border-accent-900/40 dark:bg-accent-900/20",
        className,
      )}
    >
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0 text-[#C2410C] dark:text-accent-400"
        strokeWidth={2}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#C2410C] dark:text-accent-300">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted dark:text-cream-400">
          {description}
        </p>
      </div>
    </div>
  );
}
