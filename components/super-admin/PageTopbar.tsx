import type { ReactNode } from "react";

export function PageTopbar({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-cream-300 bg-white px-6 py-4">
      <div className="leading-tight">
        <h1 className="text-lg font-bold text-ink">{title}</h1>
        {subtitle ? (
          <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
