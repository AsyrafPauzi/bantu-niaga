import Link from "next/link";
import { Building2, CalendarDays, MapPin, Palette } from "lucide-react";
import { BusinessProfileForm } from "@/components/settings/BusinessProfileForm";
import { STATE_LABELS } from "@/lib/hr/state-codes";
import type { BusinessRow } from "@/lib/settings/business";
import { settingsClasses } from "@/lib/settings/theme";
import { cn } from "@/lib/utils/cn";

export interface BusinessProfileViewProps {
  business: BusinessRow;
  canEdit: boolean;
}

function profileChecks(business: BusinessRow) {
  return {
    hasName: Boolean(business.name?.trim()),
    hasState: Boolean(business.state_code),
    hasSsm: Boolean(business.registration_no?.trim()),
    hasContact: Boolean(business.contact_line?.trim()),
  };
}

export function BusinessProfileView({ business, canEdit }: BusinessProfileViewProps) {
  const stateLabel = business.state_code
    ? (STATE_LABELS[business.state_code] ?? business.state_code)
    : null;
  const checks = profileChecks(business);
  const filledCount = [
    checks.hasName,
    checks.hasState,
    checks.hasSsm,
    checks.hasContact,
  ].filter(Boolean).length;

  const heroHeadline = !checks.hasState
    ? "Pick your state to unlock HR holidays"
    : checks.hasSsm && checks.hasContact
      ? "Profile complete"
      : stateLabel
        ? `Based in ${stateLabel}`
        : business.name;

  const heroSub = !checks.hasState
    ? "Your state decides which Malaysian public holidays apply to leave."
    : `${business.idcompany} · ${filledCount} of 4 details on file`;

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "relative overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5",
          settingsClasses.heroBorder,
          settingsClasses.heroBg,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-widest",
                settingsClasses.textMuted,
              )}
            >
              Settings · Business profile
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
              {heroHeadline}
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
              {heroSub}
            </p>
          </div>
          {checks.hasState ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                settingsClasses.chip,
              )}
            >
              <MapPin className="h-3.5 w-3.5" />
              {stateLabel}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
              <MapPin className="h-3.5 w-3.5" />
              State not set
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: "Company",
              value: business.name,
              sub: "legal name",
            },
            {
              label: "State",
              value: stateLabel ?? "—",
              sub: checks.hasState ? "holiday calendar" : "required",
              warn: !checks.hasState,
            },
            {
              label: "SSM",
              value: checks.hasSsm ? "On file" : "—",
              sub: business.registration_no ?? "optional",
            },
            {
              label: "Contact",
              value: checks.hasContact ? "On file" : "—",
              sub: business.contact_line ?? "optional",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-lg border px-3 py-2",
                stat.warn
                  ? "border-amber-200/90 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
                  : "border-brand-100/80 bg-white/70 dark:border-brand-900/30 dark:bg-panel-dark/60",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-500">
                {stat.label}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-ink dark:text-cream-100">
                {stat.value}
              </p>
              <p className="truncate text-[10px] text-ink-muted dark:text-cream-400">
                {stat.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <BusinessProfileForm
          canEdit={canEdit}
          initial={{
            name: business.name,
            state_code: business.state_code,
            registration_no: business.registration_no,
            contact_line: business.contact_line,
          }}
        />

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-sm dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-xs font-semibold text-ink dark:text-cream-100">
              Related settings
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/settings/branding"
                  className="group flex items-center gap-2.5 rounded-lg border border-cream-200 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-hairline-dark dark:hover:border-brand-800 dark:hover:bg-brand-950/20"
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                      settingsClasses.iconBox,
                    )}
                  >
                    <Palette className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-ink dark:text-cream-100">
                      Branding
                    </span>
                    <span className="block text-[10px] text-ink-muted dark:text-cream-400">
                      Logo, colours, receipts
                    </span>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/hr/holidays"
                  className="group flex items-center gap-2.5 rounded-lg border border-cream-200 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-hairline-dark dark:hover:border-brand-800 dark:hover:bg-brand-950/20"
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                      settingsClasses.iconBox,
                    )}
                  >
                    <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-ink dark:text-cream-100">
                      Public holidays
                    </span>
                    <span className="block text-[10px] text-ink-muted dark:text-cream-400">
                      {checks.hasState
                        ? `Import ${stateLabel} calendar`
                        : "Set state first"}
                    </span>
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4",
              settingsClasses.heroBorder,
              "bg-brand-50/40 dark:bg-brand-950/20",
            )}
          >
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                settingsClasses.iconBox,
              )}
            >
              <Building2 className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-500">
                Company ID
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-ink dark:text-cream-100">
                {business.idcompany}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
