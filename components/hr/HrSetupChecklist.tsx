"use client";

import { ArrowRight, Check } from "lucide-react";
import type { SetupChecklistItem } from "@/lib/hr/profile-completion";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

export function HrSetupChecklist({
  items,
  onAddNow,
  welcome = false,
}: {
  items: SetupChecklistItem[];
  onAddNow: (item: SetupChecklistItem) => void;
  welcome?: boolean;
}) {
  const doneCount = items.filter((i) => i.done).length;
  const pending = items.filter((i) => !i.done);
  const total = items.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 100;

  if (pending.length === 0) return null;

  return (
    <section className="rounded-lg border border-teal-200/70 bg-white/70 p-3 backdrop-blur-sm dark:border-teal-900/50 dark:bg-panel-dark/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            {welcome ? "Welcome — finish setup" : "Setup not finished"}
          </p>
          <p className="text-[11px] text-ink-muted dark:text-cream-400">
            {doneCount} of {total} ready for payroll
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 shrink-0">
            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-teal-100 dark:stroke-teal-950"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-[#0D9488] transition-all duration-500"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${pct} 100`}
                pathLength={100}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-[#0D9488] dark:text-teal-400">
              {doneCount}/{total}
            </span>
          </div>
        </div>
      </div>

      <ul className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
        {pending.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onAddNow(item)}
              className={cn(
                "inline-flex w-full items-center justify-between gap-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-1.5 text-left text-xs font-medium text-ink transition hover:border-[#0D9488]/40 hover:bg-teal-50/80 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-cream-100 dark:hover:bg-teal-950/30 sm:w-auto",
              )}
            >
              {item.label}
              <span className={cn("inline-flex items-center gap-0.5 text-xs", hrClasses.link)}>
                Add
                <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {doneCount > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-ink-muted dark:text-cream-500">
          {items
            .filter((i) => i.done)
            .map((item) => (
              <span key={item.id} className="inline-flex items-center gap-1">
                <Check className="h-3 w-3 text-[#0D9488]" strokeWidth={3} />
                {item.label}
              </span>
            ))}
        </p>
      ) : null}
    </section>
  );
}
