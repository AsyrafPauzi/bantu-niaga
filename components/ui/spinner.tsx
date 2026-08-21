import { cn } from "@/lib/utils/cn";

/* ─── Spinner ────────────────────────────────────────────────── */

type SpinnerSize = "xs" | "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const sizeMap: Record<SpinnerSize, string> = {
  xs: "w-3 h-3 border",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-[3px]",
};

export function Spinner({ size = "md", className, label = "Loading…" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block rounded-full animate-spin",
        "border-brand-200 border-t-brand-500 dark:border-brand-800 dark:border-t-brand-400",
        sizeMap[size],
        className,
      )}
    />
  );
}

/* ─── LoadingOverlay (fills a positioned parent) ─────────────── */

interface LoadingOverlayProps {
  label?: string;
  className?: string;
}

export function LoadingOverlay({ label = "Loading…", className }: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
        "bg-panel-light/80 dark:bg-panel-dark/80 backdrop-blur-[2px] rounded-inherit",
        className,
      )}
    >
      <Spinner size="lg" />
      <p className="text-sm text-ink-muted dark:text-cream-400">{label}</p>
    </div>
  );
}

/* ─── PageLoader (full viewport) ─────────────────────────────── */

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex h-dvh w-full flex-col items-center justify-center gap-4"
    >
      <Spinner size="lg" />
      <p className="text-sm text-ink-muted dark:text-cream-400 animate-pulse">{label}</p>
    </div>
  );
}
