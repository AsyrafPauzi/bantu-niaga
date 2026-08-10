"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { HR_ADDON_ROUTES } from "@/lib/hr/addon-nav";
import { useHrNavAddonStates } from "@/components/hr/layout/hr-nav-addon-context";

const HR_LINKS = [
  { href: "/hr", label: "Overview", exact: true },
  { href: "/hr/employees", label: "Employees", exact: false },
  { href: "/hr/leave", label: "Leave", exact: false },
  { href: "/hr/payslips", label: "Payslips", exact: false },
  { href: "/hr/reports/worker-cost", label: "Worker cost", exact: false },
  { href: "/hr/staff-portal", label: "Staff portal", exact: false },
  { href: "/hr/holidays", label: "Holidays", exact: false },
  { href: "/hr/appraisals", label: "Appraisals", exact: false },
  { href: "/hr/attendance", label: "Attendance", exact: false },
  { href: "/hr/documents", label: "Documents", exact: false },
] as const;

const HR_LEAVE_LINKS = [
  { href: "/hr/leave", label: "Inbox", exact: true },
  { href: "/hr/leave/calendar", label: "Calendar", exact: false },
  { href: "/hr/leave/history", label: "History", exact: false },
  { href: "/hr/leave/record", label: "Record", exact: false },
] as const;

function addonSlugForHref(href: string): string | null {
  return HR_ADDON_ROUTES.find((row) => row.href === href)?.addonSlug ?? null;
}

export function HrMobileSubnav({ className }: { className?: string }) {
  const pathname = usePathname();
  const addonStates = useHrNavAddonStates();

  return (
    <nav
      className={cn(
        "flex gap-2 overflow-x-auto py-2 pb-1 lg:hidden",
        className,
      )}
    >
      {HR_LINKS.map(({ href, label, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        const slug = addonSlugForHref(href);
        const navDisabled = slug ? addonStates[slug]?.navDisabled === true : false;

        if (navDisabled) {
          return (
            <span
              key={href}
              title="Coming soon in Marketplace"
              className="shrink-0 cursor-not-allowed rounded-full border border-[#E5E0D8] bg-cream-100 px-3.5 py-1.5 text-xs font-semibold text-ink-subtle dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-500"
            >
              {label}
              <span className="ml-1 text-[10px] uppercase">Soon</span>
            </span>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-brand-700 text-white dark:bg-brand-500"
                : "border border-[#E5E0D8] bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HrLeaveMobileSubnav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 lg:hidden",
        className,
      )}
    >
      {HR_LEAVE_LINKS.map(({ href, label, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-[#0D9488] text-white dark:bg-teal-500"
                : "border border-[#E5E0D8] bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
