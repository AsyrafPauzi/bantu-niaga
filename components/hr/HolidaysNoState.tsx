import Link from "next/link";
import { MapPin, Settings } from "lucide-react";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

export function HolidaysNoState() {
  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
          )}
        >
          <MapPin className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            Business state required
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            Add your state in Settings so we can import the correct Malaysia
            public holiday calendar.
          </p>
          <Link
            href="/settings/business"
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition",
              hrClasses.btnPrimary,
            )}
          >
            <Settings className="h-3.5 w-3.5" />
            Open business profile
          </Link>
        </div>
      </div>
    </div>
  );
}
