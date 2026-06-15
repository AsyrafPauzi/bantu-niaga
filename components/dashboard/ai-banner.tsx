import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AiBannerProps {
  label: string;
  message: string;
  cta?: string;
  href?: string;
  className?: string;
  /**
   * When true, render the CTA as a non-interactive "Coming soon" button with
   * a tooltip. Use for actions whose backing flow has not shipped yet.
   */
  disabled?: boolean;
  /** Tooltip + aria-label text for the disabled state. */
  disabledLabel?: string;
}

/**
 * AI copilot banner — the orange call-to-action strip that appears beneath the
 * KPI row on every pillar overview in the Pencil designs.
 */
export function AiBanner({
  label,
  message,
  cta,
  href,
  className,
  disabled = false,
  disabledLabel = "Coming soon",
}: AiBannerProps) {
  const enabledButton = cta ? (
    <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 active:bg-accent-700">
      {cta}
    </span>
  ) : null;

  const disabledButton = cta ? (
    <button
      type="button"
      disabled
      title={disabledLabel}
      aria-label={`${cta} — ${disabledLabel}`}
      className="inline-flex shrink-0 cursor-not-allowed items-center justify-center rounded-md border border-cream-300 bg-cream-100 px-4 py-2 text-sm font-medium text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/40 dark:text-cream-400"
    >
      {disabledLabel}
    </button>
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
      {disabled ? (
        disabledButton
      ) : enabledButton ? (
        href ? (
          <Link href={href} className="self-start sm:self-auto">
            {enabledButton}
          </Link>
        ) : (
          enabledButton
        )
      ) : null}
    </div>
  );
}
