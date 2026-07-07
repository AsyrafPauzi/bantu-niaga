import {
  computeOnboardingProgress,
  formatOnboardingProgress,
  type OnboardingProgress,
} from "@/lib/hr/onboarding-progress";
import { cn } from "@/lib/utils/cn";

interface HrOnboardingProgressProps {
  items: ReadonlyArray<{ is_done: boolean }>;
  className?: string;
  showBar?: boolean;
}

export function HrOnboardingProgress({
  items,
  className,
  showBar = true,
}: HrOnboardingProgressProps) {
  const progress = computeOnboardingProgress(items);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-ink dark:text-cream-100">
          {progress.total === 0
            ? "No checklist items"
            : progress.open === 0
              ? "Checklist complete"
              : `${progress.done} of ${progress.total} done`}
        </span>
        <span className="text-xs text-ink-muted dark:text-cream-400">
          {formatOnboardingProgress(progress)}
        </span>
      </div>
      {showBar && progress.total > 0 ? (
        <OnboardingProgressBar progress={progress} />
      ) : null}
    </div>
  );
}

export function OnboardingProgressBar({
  progress,
  className,
}: {
  progress: OnboardingProgress;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-2 overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark",
        className,
      )}
      role="progressbar"
      aria-valuenow={progress.percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Onboarding ${progress.percent}% complete`}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          progress.open === 0
            ? "bg-status-success"
            : "bg-brand-500",
        )}
        style={{ width: `${progress.percent}%` }}
      />
    </div>
  );
}
