import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

export function HrPublicHolidaysGate() {
  return (
    <div className="space-y-6">
      <HrMobileSubnav />

      <section
        className={cn(
          "flex flex-col items-center rounded-xl border px-6 py-14 text-center shadow-sm sm:py-16",
          hrClasses.heroBorder,
          hrClasses.heroBg,
        )}
      >
        <div
          className={cn(
            "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
            hrClasses.iconBox,
          )}
        >
          <CalendarDays className="h-6 w-6" strokeWidth={2} />
        </div>
        <h1 className="text-xl font-bold text-ink dark:text-cream-100">
          Public holiday calendar
        </h1>
        <p className="mt-2 max-w-md text-sm text-ink-muted dark:text-cream-400">
          Enable the holiday calendar for your business to import Malaysian
          federal and state days for leave planning.
        </p>
        <Link
          href="/marketplace"
          className={cn(
            "mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition",
            hrClasses.btnPrimary,
          )}
        >
          Open Marketplace
        </Link>
      </section>
    </div>
  );
}
