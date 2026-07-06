import Link from "next/link";
import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface HrPageHeaderProps {
  title: string;
  subtitle?: string;
  helpHref?: string;
  action?: ReactNode;
  className?: string;
}

export function HrPageHeader({
  title,
  subtitle,
  helpHref,
  action,
  className,
}: HrPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex shrink-0 flex-col gap-4 border-b border-[#E5E0D8] bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight text-ink dark:text-cream-100">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {helpHref ? (
          <Link
            href={helpHref}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E5E0D8] bg-[#FAF7F2] px-3.5 py-2.5 text-[13px] font-semibold text-[#11328A] transition-colors hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-brand-200"
          >
            <HelpCircle className="h-4 w-4" strokeWidth={2} />
            Get help
          </Link>
        ) : null}
        {action}
      </div>
    </header>
  );
}
