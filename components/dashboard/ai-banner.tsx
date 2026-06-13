import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AiBannerProps {
  label: string;
  message: string;
  cta?: string;
  href?: string;
  className?: string;
}

/**
 * AI copilot banner — the orange call-to-action strip that appears beneath the
 * KPI row on every pillar overview in the Pencil designs.
 */
export function AiBanner({ label, message, cta, href, className }: AiBannerProps) {
  const button = cta ? (
    <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 active:bg-accent-700">
      {cta}
    </span>
  ) : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
        "dark:border-accent-700/40 dark:bg-accent-700/15",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white">
          <Sparkles className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-200">
            {label}
          </p>
          <p className="mt-1 text-sm text-ink dark:text-cream-100">{message}</p>
        </div>
      </div>
      {button ? (
        href ? (
          <Link href={href} className="self-start sm:self-auto">
            {button}
          </Link>
        ) : (
          button
        )
      ) : null}
    </div>
  );
}
