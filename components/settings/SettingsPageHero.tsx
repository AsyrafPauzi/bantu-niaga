import type { ReactNode } from "react";
import { settingsClasses } from "@/lib/settings/theme";
import { cn } from "@/lib/utils/cn";

interface SettingsPageHeroProps {
  title: string;
  subcopy?: string;
  eyebrow?: string;
  cta?: ReactNode;
  children?: ReactNode;
}

/** Standardized settings sub-page hero — matches pillar module layout. */
export function SettingsPageHero({
  title,
  subcopy,
  eyebrow = "Settings",
  cta,
  children,
}: SettingsPageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5",
        settingsClasses.heroBorder,
        settingsClasses.heroBg,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-widest",
              settingsClasses.textMuted,
            )}
          >
            {eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
            {title}
          </h1>
          {subcopy ? (
            <p className="mt-0.5 max-w-xl text-sm text-ink-muted dark:text-cream-400">
              {subcopy}
            </p>
          ) : null}
        </div>
        {cta ? <div className="shrink-0">{cta}</div> : null}
      </div>
      {children}
    </section>
  );
}
