import Link from "next/link";
import { CalendarDays, MapPin, Settings } from "lucide-react";
import { HrHolidayOverridesPanel } from "@/components/hr/HrHolidayOverridesPanel";
import { HrHolidayCreateForm } from "@/components/hr/HrHolidayCreateForm";
import { HrHolidayImportButton } from "@/components/hr/HrHolidayImportButton";
import { HrHolidaysPanel } from "@/components/hr/HrHolidaysPanel";
import { HolidaysNoState } from "@/components/hr/HolidaysNoState";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import type { HrHolidayOverrideRow } from "@/lib/hr/effective-calendar";
import { malaysiaTodayIso } from "@/lib/ai/malaysia-today";
import type { HrHolidayRow } from "@/lib/hr/load";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function fmtShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

export interface HrHolidaysViewProps {
  holidays: HrHolidayRow[];
  overrides: HrHolidayOverrideRow[];
  stateLabel: string | null;
  hasState: boolean;
  year: number;
}

export function HrHolidaysView({
  holidays,
  overrides,
  stateLabel,
  hasState,
  year,
}: HrHolidaysViewProps) {
  const today = malaysiaTodayIso();
  const upcoming = holidays.filter((h) => h.holiday_date >= today);
  const yearHolidays = holidays.filter((h) =>
    h.holiday_date.startsWith(String(year)),
  );
  const nextHoliday = upcoming[0] ?? null;
  const thisYearCount = holidays.filter((h) =>
    h.holiday_date.startsWith(String(year)),
  ).length;

  const heroHeadline =
    upcoming.length === 0
      ? "No holidays ahead"
      : nextHoliday && daysUntil(nextHoliday.holiday_date) <= 7
        ? `${nextHoliday.name} is next`
        : `${upcoming.length} day${upcoming.length === 1 ? "" : "s"} on the calendar`;

  const heroSub =
    upcoming.length === 0
      ? hasState
        ? `Import ${year} holidays for ${stateLabel} or add your own closure days.`
        : "Set your business state in Settings to import the right calendar."
      : nextHoliday
        ? `${fmtShortDate(nextHoliday.holiday_date)}${
            daysUntil(nextHoliday.holiday_date) === 0
              ? " · today"
              : daysUntil(nextHoliday.holiday_date) === 1
                ? " · tomorrow"
                : ` · in ${daysUntil(nextHoliday.holiday_date)} days`
          }`
        : "Used when calculating working days for leave.";

  return (
    <div className="space-y-6">
      <HrMobileSubnav />

      <section
        className={cn(
          "relative overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5",
          hrClasses.heroBorder,
          hrClasses.heroBg,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-widest",
                hrClasses.textMuted,
              )}
            >
              HR · Public holidays
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
              {heroHeadline}
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
              {heroSub}
            </p>
          </div>
          {hasState ? (
            <a
              href="#manage-holidays"
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition",
                hrClasses.btnPrimary,
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Import or add
            </a>
          ) : (
            <Link
              href="/settings/business"
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition",
                hrClasses.btnPrimary,
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              Set business state
            </Link>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: "Upcoming", value: upcoming.length, sub: "on calendar" },
            {
              label: String(year),
              value: thisYearCount,
              sub: "recorded",
            },
            {
              label: "State",
              value: stateLabel ?? "—",
              sub: hasState ? "for imports" : "not set",
              wide: true,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-lg border border-teal-100/80 bg-white/70 px-3 py-2 dark:border-teal-900/30 dark:bg-panel-dark/60",
                stat.wide && "col-span-2 sm:col-span-1",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-500">
                {stat.label}
              </p>
              <p className="mt-0.5 truncate text-lg font-bold text-ink dark:text-cream-100">
                {stat.value}
              </p>
              <p className="text-[10px] text-ink-muted dark:text-cream-400">
                {stat.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <HrHolidaysPanel
          upcoming={upcoming}
          yearHolidays={yearHolidays}
          year={year}
        />

        <aside id="manage-holidays" className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {hasState ? (
            <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-sm dark:border-hairline-dark dark:bg-panel-dark sm:p-5">
              <h2 className={hrClasses.sectionTitle}>Manage calendar</h2>
              <p className={cn("mt-1", hrClasses.sectionHint)}>
                Federal and {stateLabel} holidays for {year}.
              </p>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-cream-200 bg-cream-50/50 px-3 py-2.5 dark:border-hairline-dark dark:bg-hairline-dark/20">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className={cn("h-4 w-4 shrink-0", hrClasses.text)} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink dark:text-cream-100">
                      Business state
                    </p>
                    <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                      {stateLabel}
                    </p>
                  </div>
                </div>
                <Link href="/settings/business" className={cn("shrink-0 text-xs", hrClasses.link)}>
                  Change
                </Link>
              </div>

              <div className="mt-4 space-y-4">
                <HrHolidayImportButton year={year} />
                <div className="border-t border-cream-200 pt-4 dark:border-hairline-dark">
                  <p className="mb-2 text-xs font-semibold text-ink dark:text-cream-100">
                    Add a company day
                  </p>
                  <HrHolidayCreateForm />
                </div>
              </div>
            </div>
          ) : (
            <HolidaysNoState />
          )}

          {hasState ? (
            <HrHolidayOverridesPanel holidays={holidays} overrides={overrides} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
