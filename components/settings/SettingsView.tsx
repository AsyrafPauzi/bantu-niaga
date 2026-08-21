"use client";

import Link from "next/link";
import {
  Building2,
  ChevronRight,
  CreditCard,
  Crown,
  Image as ImageIcon,
  MapPin,
  Plug,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SunMoon,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Role } from "@/lib/permissions";
import type { SettingsIconName, SettingsNavGroup } from "@/lib/settings/nav";

const SETTINGS_ICON_MAP: Record<SettingsIconName, LucideIcon> = {
  Crown,
  CreditCard,
  ShieldCheck,
  Plug,
  ShieldAlert,
  Building2,
  Users,
  Image: ImageIcon,
  SunMoon,
  Sparkles,
};
import { settingsClasses } from "@/lib/settings/theme";
import { cn } from "@/lib/utils/cn";
import {
  settingsGroupMessageKey,
  settingsNavMessageKeys,
} from "@/lib/i18n/nav-labels";

function roleLabel(role: Role, ownerLabel: string): string {
  if (role === "owner") return ownerLabel;
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
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
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
              {t("accountSettings")}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
              {businessName}
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
              {roleLabel(role, t("owner"))}
              {planLabel && showPlan
                ? ` · ${t("planLabel", { plan: planLabel })}`
                : ""}
            </p>
          </div>
          <Link
            href="/settings/business"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition",
              settingsClasses.btnPrimary,
            )}
          >
            {t("editBusiness")}
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            {
              label: t("state"),
              value: stateLabel ?? tCommon("notSet"),
              sub: stateMissing ? t("stateNeeded") : t("stateForHr"),
              warn: stateMissing,
            },
            {
              label: t("plan"),
              value: showPlan && planLabel ? planLabel : "—",
              sub: showPlan ? t("subscription") : t("managedLocally"),
            },
            {
              label: t("companyId"),
              value: companyId ?? "—",
              sub: t("yourBusinessCode"),
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
              {t("editBusiness")}
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {t("stateNeeded")}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-amber-700 transition group-hover:translate-x-0.5 dark:text-amber-300" />
        </Link>
      ) : null}

      {groups.map((group) => {
        const groupKey = settingsGroupMessageKey(group.title);
        return (
          <section key={group.title}>
            <h2
              className={cn(
                "mb-3 text-[11px] font-bold uppercase tracking-widest",
                settingsClasses.textMuted,
              )}
            >
              {groupKey ? t(groupKey) : group.title}
            </h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              {group.items.map((item) => {
                const Icon = SETTINGS_ICON_MAP[item.iconName];
                const highlight =
                  item.href === "/settings/business" && stateMissing;
                const keys = settingsNavMessageKeys(item.href);

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
                          {keys ? t(keys.title) : item.label}
                        </h3>
                        <p className="text-xs text-ink-muted dark:text-cream-400">
                          {keys ? t(keys.desc) : item.description}
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
        );
      })}
    </div>
  );
}
