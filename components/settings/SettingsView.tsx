import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import type { Role } from "@/lib/permissions";
import type { SettingsNavGroup } from "@/lib/settings/nav";
import { settingsClasses } from "@/lib/settings/theme";
import { cn } from "@/lib/utils/cn";

function roleLabel(role: Role): string {
  if (role === "owner") return "Owner";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface SettingsViewProps {
  businessName: string;
  companyId: string | null;
  stateLabel: string | null;
  planLabel: string | null;
  showPlan: boolean;
  role: Role;
  groups: SettingsNavGroup[];
}

export function SettingsView({
  businessName,
  companyId,
  stateLabel,
  planLabel,
  showPlan,
  role,
  groups,
}: SettingsViewProps) {
  const stateMissing = !stateLabel;

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "relative overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5",
          settingsClasses.heroBorder,
          settingsClasses.heroBg,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-widest",
                settingsClasses.textMuted,
              )}
            >
              Account settings
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
              {businessName}
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
              {roleLabel(role)}
              {planLabel && showPlan ? ` · ${planLabel} plan` : ""}
            </p>
          </div>
          <Link
            href="/settings/business"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition",
              settingsClasses.btnPrimary,
            )}
          >
            Edit business profile
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            {
              label: "State",
              value: stateLabel ?? "Not set",
              sub: stateMissing ? "needed for holidays" : "for HR calendar",
              warn: stateMissing,
            },
            {
              label: "Plan",
              value: showPlan && planLabel ? planLabel : "—",
              sub: showPlan ? "subscription" : "managed locally",
            },
            {
              label: "Company ID",
              value: companyId ?? "—",
              sub: "your business code",
              wide: true,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-lg border px-3 py-2",
                stat.warn
                  ? "border-amber-200/90 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
                  : "border-brand-100/80 bg-white/70 dark:border-brand-900/30 dark:bg-panel-dark/60",
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

      {stateMissing ? (
        <Link
          href="/settings/business"
          className="group flex items-center gap-3 rounded-xl border border-amber-200/90 bg-amber-50/50 p-4 transition hover:border-amber-300 dark:border-amber-900/50 dark:bg-amber-950/20"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <MapPin className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Set your business state
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Required to import Malaysian public holidays in HR and calculate
              working days for leave.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-amber-700 transition group-hover:translate-x-0.5 dark:text-amber-300" />
        </Link>
      ) : null}

      {groups.map((group) => (
        <section key={group.title}>
          <h2
            className={cn(
              "mb-3 text-[11px] font-bold uppercase tracking-widest",
              settingsClasses.textMuted,
            )}
          >
            {group.title}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              const highlight =
                item.href === "/settings/business" && stateMissing;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <div
                    className={cn(
                      "flex h-full items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-panel-dark",
                      highlight
                        ? "border-amber-300/80 hover:border-amber-400 dark:border-amber-800/60"
                        : "border-cream-200 hover:border-brand-200 dark:border-hairline-dark dark:hover:border-brand-800",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                        highlight
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                          : settingsClasses.iconBox,
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
                        {item.label}
                      </h3>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 dark:text-cream-400"
                      strokeWidth={2}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
