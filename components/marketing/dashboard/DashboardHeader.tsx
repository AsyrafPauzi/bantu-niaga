/**
 * Brand-saturated dashboard greeting bar.
 *
 * Uses MYT (Asia/Kuala_Lumpur) for the "good morning / afternoon /
 * evening" axis so the greeting matches the operator's local
 * experience even when the server timezone differs.
 */
import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DashboardHeaderProps {
  businessName?: string;
  /** Optional period selector or other right-aligned action chip. */
  action?: React.ReactNode;
  /** Optional override for the current time (used in tests). */
  now?: Date;
  /** Quick numeric summary line ("16 customers · RM 3,420 lifetime spend"). */
  summary?: string;
  className?: string;
}

function greetingForHour(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

function getMytHour(now: Date): number {
  const hourString = now.toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "numeric",
    hour12: false,
  });
  const parsed = Number.parseInt(hourString, 10);
  return Number.isFinite(parsed) ? parsed : now.getHours();
}

export function DashboardHeader({
  businessName,
  action,
  now,
  summary,
  className,
}: DashboardHeaderProps) {
  const moment = now ?? new Date();
  const hour = getMytHour(moment);
  const greeting = greetingForHour(hour);
  const displayBiz = businessName?.trim()
    ? businessName.trim()
    : "your business";

  return (
    <section
      data-testid="marketing-dashboard-header"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-cream-50 to-accent-50 p-5 shadow-card sm:p-6",
        "dark:border-brand-900/60 dark:from-brand-900/40 dark:via-panel-dark dark:to-accent-700/20",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-10 h-44 w-44 rounded-full bg-brand-500/10 blur-3xl dark:bg-brand-400/10"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-10 -left-12 h-32 w-32 rounded-full bg-accent-500/15 blur-3xl dark:bg-accent-500/20"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-200">
            <Megaphone className="h-3.5 w-3.5" strokeWidth={2.25} />
            Marketing dashboard
          </p>
          <h1
            data-testid="dashboard-greeting"
            className="mt-2 text-2xl font-semibold text-ink dark:text-cream-100 sm:text-3xl"
          >
            {greeting},{" "}
            <span className="text-brand-700 underline decoration-accent-500 decoration-[3px] underline-offset-[6px] dark:text-brand-200">
              {displayBiz}
            </span>
          </h1>
          {summary ? (
            <p className="mt-2 max-w-2xl text-sm text-ink dark:text-cream-200">
              {summary}
            </p>
          ) : (
            <p className="mt-2 max-w-2xl text-sm text-ink-muted dark:text-cream-400">
              Here&apos;s how your customer book is moving today. Cards
              refresh whenever Operations / Finance / Sales push events.
            </p>
          )}
        </div>
        {action ? (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        ) : null}
      </div>
    </section>
  );
}
