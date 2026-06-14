import type { ReactNode } from "react";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 py-6 space-y-5 max-w-[1440px] mx-auto">{children}</div>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  subtle,
  trend = "up",
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  subtle?: string;
  trend?: "up" | "down" | "flat";
}) {
  const Icon: LucideIcon | null =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;
  const tone =
    trend === "up"
      ? "text-status-success bg-status-success/10"
      : trend === "down"
        ? "text-status-danger bg-status-danger/10"
        : "text-ink-muted bg-cream-200";

  return (
    <div className="flex-1 rounded-xl border border-cream-300 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "grid h-5 w-5 place-items-center rounded-md",
              tone,
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2.5} />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold text-ink leading-tight">{value}</p>
      {(delta || subtle) && (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {delta ? (
            <span
              className={cn(
                "text-[11px] font-semibold",
                trend === "up"
                  ? "text-status-success"
                  : trend === "down"
                    ? "text-status-danger"
                    : "text-ink-muted",
              )}
            >
              {delta}
            </span>
          ) : null}
          {subtle ? (
            <span className="text-[11px] text-ink-muted">· {subtle}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function StatusPill({
  tone,
  label,
}: {
  tone: "success" | "warning" | "danger" | "info" | "muted" | "brand";
  label: string;
}) {
  const map: Record<typeof tone, string> = {
    success: "bg-status-success/10 text-status-success",
    warning: "bg-status-warning/15 text-status-warning",
    danger: "bg-status-danger/10 text-status-danger",
    info: "bg-status-info/10 text-status-info",
    muted: "bg-cream-200 text-ink-muted",
    brand: "bg-brand-50 text-brand-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        map[tone],
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "success"
            ? "bg-status-success"
            : tone === "warning"
              ? "bg-status-warning"
              : tone === "danger"
                ? "bg-status-danger"
                : tone === "info"
                  ? "bg-status-info"
                  : tone === "brand"
                    ? "bg-brand-500"
                    : "bg-ink-muted",
        )}
      />
      {label}
    </span>
  );
}

export function ToggleVisual({
  on,
  ariaLabel,
}: {
  on: boolean;
  ariaLabel?: string;
}) {
  return (
    <span
      aria-label={ariaLabel}
      role="img"
      className={cn(
        "inline-flex h-6 w-10 items-center rounded-full p-0.5 transition-colors",
        on ? "bg-status-success justify-end" : "bg-cream-300 justify-start",
      )}
    >
      <span className="h-4 w-4 rounded-full bg-white" />
    </span>
  );
}

export function Section({
  title,
  description,
  right,
  children,
  className,
}: {
  title?: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-cream-300 bg-white p-5 shadow-card",
        className,
      )}
    >
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-base font-bold text-ink leading-tight">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs text-ink-muted">{description}</p>
            ) : null}
          </div>
          {right ?? null}
        </div>
      )}
      {children}
    </section>
  );
}

export function formatMyr(amountMyr: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountMyr);
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("en-MY").format(n);
}
