import { cn } from "@/lib/utils/cn";

interface OperationsPageHeroProps {
  title: string;
  description: string;
  accent?: "sky" | "violet" | "emerald" | "amber" | "indigo";
  stats?: Array<{ label: string; value: string | number; hint?: string }>;
}

const ACCENT_CLASS: Record<NonNullable<OperationsPageHeroProps["accent"]>, string> = {
  sky: "border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-teal-50 dark:border-sky-900/40 dark:from-sky-950/30 dark:via-panel-dark dark:to-teal-950/20",
  violet:
    "border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-purple-950/20",
  emerald:
    "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-panel-dark dark:to-teal-950/20",
  amber:
    "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-panel-dark dark:to-orange-950/20",
  indigo:
    "border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:via-panel-dark dark:to-violet-950/20",
};

export function OperationsPageHero({
  title,
  description,
  accent = "sky",
  stats,
}: OperationsPageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 shadow-card sm:p-6",
        ACCENT_CLASS[accent],
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">
        Operations
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted dark:text-cream-300">
        {description}
      </p>
      {stats && stats.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                {stat.label}
              </p>
              <p className="text-lg font-bold tabular-nums text-ink dark:text-cream-100">
                {stat.value}
              </p>
              {stat.hint ? (
                <p className="text-[10px] text-ink-muted dark:text-cream-500">
                  {stat.hint}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
