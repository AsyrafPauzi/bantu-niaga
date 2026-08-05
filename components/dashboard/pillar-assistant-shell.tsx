import type { ReactNode } from "react";
import type { Pillar } from "@/lib/permissions";
import { getPillarClasses } from "@/lib/pillars/theme";
import { cn } from "@/lib/utils/cn";

interface PillarAssistantShellProps {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Full-height assistant layout for any pillar — no negative margins. */
export function PillarAssistantShell({
  header,
  children,
  className,
}: PillarAssistantShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-light dark:bg-surface-dark",
        className,
      )}
    >
      {header}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

interface PillarAssistantHeaderProps {
  pillar: Pillar;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  prefix?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Pillar-colored assistant page header. */
export function PillarAssistantHeader({
  pillar,
  title,
  subtitle,
  eyebrow = "AI Assistant",
  prefix,
  action,
  className,
}: PillarAssistantHeaderProps) {
  const classes = getPillarClasses(pillar);

  return (
    <div
      className={cn(
        "shrink-0 border-b px-4 py-4 dark:border-hairline-dark lg:px-8",
        classes.heroBorder,
        classes.heroBg,
        className,
      )}
    >
      {prefix}
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
          prefix ? "mt-2" : undefined,
        )}
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-widest",
              classes.eyebrow,
            )}
          >
            {eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 max-w-2xl text-sm text-ink-muted dark:text-cream-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

/** Standard assistant chat body padding. */
export const PILLAR_ASSISTANT_BODY =
  "flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-8 lg:py-4";
